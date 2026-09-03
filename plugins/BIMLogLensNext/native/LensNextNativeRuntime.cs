using System;
using System.Security.Cryptography;
using System.Net;
using System.Net.Sockets;
using Autodesk.Navisworks.Api;
using System.Windows.Forms;
using NavisworksApplication = Autodesk.Navisworks.Api.Application;

namespace BIMLogLensNext.Native
{
    public sealed class LensNextNativeRuntime : IDisposable
    {
        private LensNextUiRequestPump _pump;
        private LensNextHttpBridgeHost _host;
        private string _documentFile;
        private readonly Control _uiDispatcher;

        public LensNextNativeRuntime(Control uiDispatcher)
        {
            _uiDispatcher = uiDispatcher ?? throw new ArgumentNullException(nameof(uiDispatcher));
        }

        public bool IsRunning => _host != null && _host.IsRunning;
        public string Status { get; private set; } = "Stopped";
        public string SessionId => _host == null ? null : _host.SessionId;
        public string BridgeOrigin { get; private set; }
        public DateTimeOffset? SessionExpiresAt => _host == null ? (DateTimeOffset?)null : _host.ExpiresAt;
        public bool SessionExpired => _host != null && DateTimeOffset.UtcNow >= _host.ExpiresAt;
        public string ModelFingerprint { get; private set; }
        public LensNextNativeConfig Config { get; private set; }
        public string LastError { get; private set; }

        public string ReadinessMessage()
        {
            var document = NavisworksApplication.ActiveDocument;
            if (document == null || document.IsDisposed || document.IsClear)
                return "Open a Navisworks model before starting Lens Next.";

            if (string.IsNullOrWhiteSpace(document.FileName))
                return "Save or open a named NWF/NWD before starting Lens Next.";

            return "Ready";
        }

        public void StartOrRestart()
        {
            Stop();
            LastError = null;
            LensNextNativeLog.Info("Starting Lens Next native runtime.");
            try
            {
                Config = LensNextNativeConfig.Load();
                var document = NavisworksApplication.ActiveDocument;
                if (document == null || document.IsDisposed || document.IsClear || string.IsNullOrWhiteSpace(document.FileName))
                    throw new InvalidOperationException("Open a named Navisworks NWF/NWD before starting Lens Next.");

                _documentFile = System.IO.Path.GetFullPath(document.FileName);
                ModelFingerprint = LensNextModelFingerprint.ComputeContextFingerprint(_documentFile);
                var detectedProjectId = AutodeskLensNextReadOnlyAdapter.DetectManagedProjectId(document);
                int exactProjectId;
                var authoritativeProjectId = int.TryParse(detectedProjectId, out exactProjectId) && exactProjectId > 0
                    ? exactProjectId.ToString()
                    : null;
                if (authoritativeProjectId == null && Config.ProjectId > 0)
                    LensNextNativeLog.Info("Configured Project=" + Config.ProjectId + " is a legacy candidate only and was ignored because the model has no authoritative managed marker.");

                var token = CreateToken();
                var sessionId = "lens-next-session-" + Guid.NewGuid().ToString("N");
                var expires = DateTimeOffset.UtcNow.AddMinutes(LensNextConstants.BridgeMaximumTokenLifetimeMinutes);
                var bridgePort = AllocateBridgePort();
                BridgeOrigin = "http://127.0.0.1:" + bridgePort;
                var adapter = new AutodeskLensNextReadOnlyAdapter(
                    document,
                    authoritativeProjectId,
                    ModelFingerprint);

                var bridge = new LensNextReadOnlyBridge(
                    token,
                    sessionId,
                    expires,
                    adapter,
                    new InlineUiThreadDispatcher(),
                    new ImmutableIdentityResolver(),
                    Config.ViewpointPublishingEnabled,
                    BridgeOrigin);

                _pump = new LensNextUiRequestPump(bridge, _uiDispatcher);
                _host = new LensNextHttpBridgeHost(
                    _pump,
                    Config.EffectiveAllowedOrigins(),
                    token,
                    sessionId,
                    expires,
                    BridgeOrigin);

                _host.Start();
                Status = "Running on " + BridgeOrigin;
                LensNextNativeLog.Info(
                    "Bridge started. Project=" + (authoritativeProjectId ?? "unbound") +
                    " BindingSource=" + (authoritativeProjectId == null ? "unbound" : "managed-marker") +
                    " Model=" + ModelFingerprint.Substring(0, 12) +
                    " Session=" + sessionId);
            }
            catch (Exception ex)
            {
                LastError = ex.Message;
                Status = "Stopped";
                LensNextNativeLog.Error("Lens Next runtime start failed.", ex);
                throw;
            }
        }

        public bool ActiveDocumentMatches()
        {
            var document = NavisworksApplication.ActiveDocument;
            if (document == null || document.IsDisposed || document.IsClear || string.IsNullOrWhiteSpace(document.FileName))
                return false;

            return string.Equals(
                System.IO.Path.GetFullPath(document.FileName),
                _documentFile,
                StringComparison.OrdinalIgnoreCase);
        }

        private static string CreateToken()
        {
            var bytes = new byte[32];
            using (var rng = RandomNumberGenerator.Create())
                rng.GetBytes(bytes);

            return Convert.ToBase64String(bytes)
                .TrimEnd('=')
                .Replace('+', '-')
                .Replace('/', '_');
        }

        internal static int AllocateBridgePort()
        {
            for (var port = LensNextConstants.BridgeMinimumPort; port <= LensNextConstants.BridgeMaximumPort; port++)
            {
                TcpListener probe = null;
                try
                {
                    probe = new TcpListener(IPAddress.Loopback, port);
                    probe.Start();
                    return port;
                }
                catch (SocketException) { }
                finally { if (probe != null) probe.Stop(); }
            }
            throw new InvalidOperationException("No approved Lens Next loopback port is available.");
        }

        public void Stop()
        {
            if (_host != null || _pump != null)
                LensNextNativeLog.Info("Stopping Lens Next native runtime.");

            if (_host != null)
            {
                _host.Dispose();
                _host = null;
            }

            if (_pump != null)
            {
                _pump.Dispose();
                _pump = null;
            }

            Status = "Stopped";
        }

        public void Dispose()
        {
            Stop();
        }
    }
}
