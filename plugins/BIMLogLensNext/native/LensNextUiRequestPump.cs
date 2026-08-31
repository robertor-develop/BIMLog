using System;
using System.Collections.Generic;
using System.Threading;
using System.Windows.Forms;

namespace BIMLogLensNext.Native
{
    public sealed class LensNextUiRequestPump : IDisposable
    {
        private sealed class WorkItem
        {
            public LensNextBridgeRequest Request;
            public LensNextBridgeResponse Response;
            public readonly ManualResetEventSlim Completed = new ManualResetEventSlim(false);
            public volatile bool Expired;
        }

        private readonly object _sync = new object();
        private readonly Queue<WorkItem> _queue = new Queue<WorkItem>();
        private readonly LensNextReadOnlyBridge _bridge;
        private readonly int _ownerThreadId;
        private readonly Control _uiDispatcher;
        private bool _disposed;

        public LensNextUiRequestPump(LensNextReadOnlyBridge bridge, Control uiDispatcher)
        {
            _bridge = bridge ?? throw new ArgumentNullException(nameof(bridge));
            _ownerThreadId = Thread.CurrentThread.ManagedThreadId;
            _uiDispatcher = uiDispatcher ?? throw new ArgumentNullException(nameof(uiDispatcher));
            if (_uiDispatcher.IsDisposed || !_uiDispatcher.IsHandleCreated)
                throw new InvalidOperationException("Lens Next UI dispatcher is not ready.");
        }

        public LensNextBridgeResponse Execute(LensNextBridgeRequest request, int timeoutMilliseconds)
        {
            if (_disposed) return LensNextBridgeResponse.Blocked("bridge_stopped", "Lens Next bridge is stopped.");
            if (request != null && (request.Command == LensNextBridgeCommands.Ping || request.Command == LensNextBridgeCommands.Capabilities))
                return _bridge.Execute(request);
            if (Thread.CurrentThread.ManagedThreadId == _ownerThreadId) return _bridge.Execute(request);

            var work = new WorkItem { Request = request };
            lock (_sync) _queue.Enqueue(work);
            LensNextNativeLog.Info("UI dispatch queued. Request=" + (request == null ? "null" : request.Command) + " OwnerThread=" + _ownerThreadId + " CallerThread=" + Thread.CurrentThread.ManagedThreadId);
            try { _uiDispatcher.BeginInvoke(new Action(DrainQueue)); }
            catch (Exception ex)
            {
                work.Expired = true;
                LensNextNativeLog.Error("UI dispatch BeginInvoke failed.", ex);
                return LensNextBridgeResponse.Blocked("ui_dispatch_failed", "Navisworks rejected the UI operation.");
            }
            if (!work.Completed.Wait(Math.Max(250, timeoutMilliseconds)))
            {
                work.Expired = true;
                LensNextNativeLog.Error("UI dispatch timed out. OwnerThread=" + _ownerThreadId + " CallerThread=" + Thread.CurrentThread.ManagedThreadId + " TimeoutMs=" + timeoutMilliseconds);
                return LensNextBridgeResponse.Blocked("ui_dispatch_timeout", "Navisworks did not execute the requested UI operation before the bridge timeout.");
            }
            return work.Response ?? LensNextBridgeResponse.Blocked("ui_dispatch_failed", "Navisworks did not return a bridge response.");
        }

        public void RenewSession(string sessionToken, DateTimeOffset sessionExpiresAt)
        {
            if (_disposed) throw new ObjectDisposedException(nameof(LensNextUiRequestPump));
            _bridge.RenewSession(sessionToken, sessionExpiresAt);
        }

        private void DrainQueue()
        {
            LensNextNativeLog.Info("UI dispatch executing. OwnerThread=" + _ownerThreadId + " CurrentThread=" + Thread.CurrentThread.ManagedThreadId);
            if (Thread.CurrentThread.ManagedThreadId != _ownerThreadId)
                throw new InvalidOperationException("Lens Next UI work was dispatched to the wrong thread.");
            for (var count = 0; count < 32; count++)
            {
                WorkItem work = null;
                lock (_sync)
                {
                    if (_queue.Count == 0) return;
                    work = _queue.Dequeue();
                }
                if (work.Expired)
                {
                    work.Completed.Set();
                    continue;
                }
                try { work.Response = _bridge.Execute(work.Request); }
                catch (Exception ex) { work.Response = LensNextBridgeResponse.Blocked("bridge_exception", ex.Message); }
                finally { work.Completed.Set(); }
            }
        }

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            lock (_sync)
            {
                while (_queue.Count > 0)
                {
                    var work = _queue.Dequeue();
                    work.Response = LensNextBridgeResponse.Blocked("bridge_stopped", "Lens Next bridge stopped before this request could run.");
                    work.Completed.Set();
                }
            }
        }
    }
}
