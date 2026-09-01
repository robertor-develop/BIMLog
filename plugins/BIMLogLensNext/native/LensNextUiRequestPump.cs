using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
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
            public string Fingerprint;
        }

        private readonly object _sync = new object();
        private readonly Queue<WorkItem> _queue = new Queue<WorkItem>();
        private readonly Dictionary<string, WorkItem> _applyOperations = new Dictionary<string, WorkItem>(StringComparer.Ordinal);
        private readonly Queue<string> _applyOperationOrder = new Queue<string>();
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

            WorkItem work;
            var joinedExistingApply = false;
            lock (_sync)
            {
                if (request != null && request.Command == LensNextBridgeCommands.ApplyWorkingView && !string.IsNullOrWhiteSpace(request.RequestId))
                {
                    var fingerprint = Fingerprint(request);
                    WorkItem existing;
                    if (_applyOperations.TryGetValue(request.RequestId, out existing))
                    {
                        if (!string.Equals(existing.Fingerprint, fingerprint, StringComparison.Ordinal))
                            return LensNextBridgeResponse.Blocked("idempotency_conflict", "The apply request ID was reused with a different payload.");
                        work = existing;
                        joinedExistingApply = true;
                    }
                    else
                    {
                        work = new WorkItem { Request = request, Fingerprint = fingerprint };
                        _applyOperations[request.RequestId] = work;
                        _applyOperationOrder.Enqueue(request.RequestId);
                        TrimCompletedApplyOperations();
                        _queue.Enqueue(work);
                    }
                }
                else
                {
                    work = new WorkItem { Request = request };
                    _queue.Enqueue(work);
                }
            }
            if (joinedExistingApply)
            {
                LensNextNativeLog.Info("Apply lifecycle. Stage=idempotent-join Request=" + request.RequestId);
                return AwaitResponse(work, timeoutMilliseconds);
            }
            LensNextNativeLog.Info("UI dispatch queued. Request=" + (request == null ? "null" : request.Command) + " Correlation=" + (request == null ? "null" : request.RequestId) + " OwnerThread=" + _ownerThreadId + " CallerThread=" + Thread.CurrentThread.ManagedThreadId);
            try { _uiDispatcher.BeginInvoke(new Action(DrainQueue)); }
            catch (Exception ex)
            {
                work.Expired = true;
                LensNextNativeLog.Error("UI dispatch BeginInvoke failed.", ex);
                work.Response = LensNextBridgeResponse.Blocked("ui_dispatch_failed", "Navisworks rejected the UI operation.");
                work.Completed.Set();
                return work.Response;
            }
            return AwaitResponse(work, timeoutMilliseconds);
        }

        private LensNextBridgeResponse AwaitResponse(WorkItem work, int timeoutMilliseconds)
        {
            var completed = timeoutMilliseconds == Timeout.Infinite
                ? WaitUntilCompleted(work)
                : work.Completed.Wait(Math.Max(250, timeoutMilliseconds));
            if (!completed)
            {
                work.Expired = true;
                LensNextNativeLog.Error("UI dispatch timed out. OwnerThread=" + _ownerThreadId + " CallerThread=" + Thread.CurrentThread.ManagedThreadId + " TimeoutMs=" + timeoutMilliseconds);
                return LensNextBridgeResponse.Blocked("ui_dispatch_timeout", "Navisworks did not execute the requested UI operation before the bridge timeout.");
            }
            return work.Response ?? LensNextBridgeResponse.Blocked("ui_dispatch_failed", "Navisworks did not return a bridge response.");
        }

        private void TrimCompletedApplyOperations()
        {
            while (_applyOperationOrder.Count > 256)
            {
                var oldest = _applyOperationOrder.Peek();
                WorkItem candidate;
                if (!_applyOperations.TryGetValue(oldest, out candidate) || candidate.Completed.IsSet)
                {
                    _applyOperationOrder.Dequeue();
                    _applyOperations.Remove(oldest);
                    continue;
                }
                break;
            }
        }

        private static string Fingerprint(LensNextBridgeRequest request)
        {
            var canonical = new StringBuilder()
                .Append(request.ProtocolVersion).Append('\u001f')
                .Append(request.Command ?? "").Append('\u001f');
            foreach (var pair in (request.Fields ?? new Dictionary<string, string>()).OrderBy(value => value.Key, StringComparer.Ordinal))
                canonical.Append(pair.Key).Append('\u001e').Append(pair.Value ?? "<null>").Append('\u001f');
            using (var sha = SHA256.Create())
                return string.Concat(sha.ComputeHash(Encoding.UTF8.GetBytes(canonical.ToString())).Select(value => value.ToString("x2")));
        }

        private static bool WaitUntilCompleted(WorkItem work)
        {
            work.Completed.Wait();
            return true;
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
                try
                {
                    LensNextNativeLog.Info("Apply lifecycle. Stage=ui-execution-started Request=" + (work.Request == null ? "null" : work.Request.RequestId) + " Command=" + (work.Request == null ? "null" : work.Request.Command));
                    work.Response = _bridge.Execute(work.Request);
                    LensNextNativeLog.Info("Apply lifecycle. Stage=ui-execution-finished Request=" + (work.Request == null ? "null" : work.Request.RequestId) + " Command=" + (work.Request == null ? "null" : work.Request.Command));
                }
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
