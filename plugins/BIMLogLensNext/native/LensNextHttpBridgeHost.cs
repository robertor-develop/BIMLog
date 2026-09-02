using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

namespace BIMLogLensNext.Native
{
    public sealed class LensNextHttpBridgeHost : IDisposable
    {
        private readonly HttpListener _listener = new HttpListener();
        private readonly LensNextUiRequestPump _pump;
        private readonly HashSet<string> _allowedOrigins;
        private readonly JavaScriptSerializer _json = new JavaScriptSerializer();
        private readonly string _sessionToken;
        private readonly string _sessionId;
        private DateTimeOffset _expiresAt;
        private readonly string _bridgeOrigin;
        private Thread _thread;
        private volatile bool _running;

        public LensNextHttpBridgeHost(
            LensNextUiRequestPump pump,
            IEnumerable<string> allowedOrigins,
            string sessionToken,
            string sessionId,
            DateTimeOffset expiresAt,
            string bridgeOrigin)
        {
            _pump = pump ?? throw new ArgumentNullException(nameof(pump));
            _allowedOrigins = new HashSet<string>(allowedOrigins ?? Enumerable.Empty<string>(), StringComparer.OrdinalIgnoreCase);
            _sessionToken = sessionToken ?? throw new ArgumentNullException(nameof(sessionToken));
            _sessionId = sessionId ?? throw new ArgumentNullException(nameof(sessionId));
            _expiresAt = expiresAt;
            _bridgeOrigin = bridgeOrigin ?? throw new ArgumentNullException(nameof(bridgeOrigin));
            _listener.Prefixes.Add(_bridgeOrigin + "/");
        }

        public bool IsRunning => _running && _listener.IsListening;
        public string SessionId => _sessionId;
        public DateTimeOffset ExpiresAt => _expiresAt;

        public void Start()
        {
            if (_running) return;
            _listener.Start();
            _running = true;
            LensNextNativeLog.Info("HTTP bridge listening at " + _bridgeOrigin + ".");
            _thread = new Thread(ListenLoop) { IsBackground = true, Name = "BIMLogLensNextBridge" };
            _thread.Start();
        }

        private void ListenLoop()
        {
            while (_running)
            {
                try
                {
                    var context = _listener.GetContext();
                    ThreadPool.QueueUserWorkItem(_ => Handle(context));
                }
                catch (Exception ex)
                {
                    if (!_running) return;
                    LensNextNativeLog.Error("HTTP listener loop error.", ex);
                }
            }
        }

        private void Handle(HttpListenerContext context)
        {
            try
            {
                var request = context.Request;
                var response = context.Response;
                var origin = (request.Headers["Origin"] ?? "").TrimEnd('/');
                if (!string.IsNullOrEmpty(origin) && !_allowedOrigins.Contains(origin))
                {
                    Write(response, 403, new Dictionary<string, object> { { "success", false }, { "code", "origin_not_allowed" }, { "message", "Origin is not authorized for Lens Next." } });
                    return;
                }
                AddCors(request, response, origin);
                if (string.Equals(request.HttpMethod, "OPTIONS", StringComparison.OrdinalIgnoreCase))
                {
                    response.StatusCode = 204;
                    response.Close();
                    return;
                }

                var path = request.Url.AbsolutePath.TrimEnd('/').ToLowerInvariant();
                if (path == "/v1/session" && request.HttpMethod == "GET")
                {
                    if (string.IsNullOrEmpty(origin))
                    {
                        Write(response, 403, ErrorEnvelope("session_origin_required", "Lens Next bridge session bootstrap requires an authorized BIMLog web origin."));
                        return;
                    }
                    _expiresAt = DateTimeOffset.UtcNow.AddMinutes(LensNextConstants.BridgeMaximumTokenLifetimeMinutes);
                    _pump.RenewSession(_sessionToken, _expiresAt);
                    Write(response, 200, new Dictionary<string, object>
                    {
                        { "success", true }, { "code", "session" },
                        { "payload", new Dictionary<string, object>
                            {
                                { "protocolVersion", LensNextConstants.BridgeProtocolVersion },
                                { "source", "lens-next-native-host" },
                                { "token", _sessionToken }, { "sessionId", _sessionId },
                                { "issuedAt", DateTimeOffset.UtcNow.ToString("o") },
                                { "expiresAt", _expiresAt.ToString("o") }
                            }
                        }
                    });
                    return;
                }

                var command = CommandFor(request, path);
                if (command == null)
                {
                    Write(response, 404, ErrorEnvelope("not_found", "Lens Next bridge route was not found."));
                    return;
                }
                var token = BearerToken(request.Headers["Authorization"]);
                if (!string.Equals(token, _sessionToken, StringComparison.Ordinal))
                {
                    Write(response, 401, ErrorEnvelope("session_token_invalid", "Lens Next bridge session token is invalid."));
                    return;
                }

                LensNextBridgeRequest bridgeRequest;
                if (request.HttpMethod == "POST") bridgeRequest = ParsePost(request, command);
                else bridgeRequest = CreateGetRequest(request, command);
                bridgeRequest.SessionToken = token;
                bridgeRequest.Origin = _bridgeOrigin;

                LensNextNativeLog.Info("Apply lifecycle. Stage=request-received Request=" + bridgeRequest.RequestId + " Command=" + command);
                var result = _pump.Execute(bridgeRequest, TimeoutFor(command));
                LensNextNativeLog.Info("Apply lifecycle. Stage=request-completed Request=" + bridgeRequest.RequestId + " Command=" + command + " Success=" + result.Success + " Code=" + result.Code);
                Write(response, result.Success ? 200 : 409, WireEnvelope(result));
            }
            catch (Exception ex)
            {
                if (!_running) return;
                LensNextNativeLog.Error("Bridge request failed.", ex);
                try { Write(context.Response, 500, ErrorEnvelope("bridge_host_error", ex.Message)); } catch { }
            }
        }

        private static int TimeoutFor(string command)
        {
            if (command == LensNextBridgeCommands.RestoreExactVisualState)
                return Timeout.Infinite;
            return command == LensNextBridgeCommands.CaptureVisualState ||
                   command == LensNextBridgeCommands.CaptureLocalViewpoint ||
                   command == LensNextBridgeCommands.CaptureNewViewpoint
                ? LensNextConstants.BridgeCaptureRequestTimeoutMilliseconds
                : LensNextConstants.BridgeRequestTimeoutMilliseconds;
        }

        private static string CommandFor(HttpListenerRequest request, string path)
        {
            if (request.HttpMethod == "GET" && path == "/v1/ping") return LensNextBridgeCommands.Ping;
            if (request.HttpMethod == "GET" && path == "/v1/capabilities") return LensNextBridgeCommands.Capabilities;
            if (request.HttpMethod == "GET" && path == "/v1/project-context") return LensNextBridgeCommands.ProjectContext;
            if (request.HttpMethod == "GET" && path == "/v1/local-inventory") return LensNextBridgeCommands.LocalInventory;
            if (request.HttpMethod == "POST" && path == "/v1/project-binding") return LensNextBridgeCommands.BindProject;
            if (request.HttpMethod == "POST" && path == "/v1/open-working-view") return LensNextBridgeCommands.OpenWorkingView;
            if (request.HttpMethod == "POST" && path == "/v1/capture-visual-state") return LensNextBridgeCommands.CaptureVisualState;
            if (request.HttpMethod == "POST" && path == "/v1/capture-local-viewpoint") return LensNextBridgeCommands.CaptureLocalViewpoint;
            if (request.HttpMethod == "POST" && path == "/v1/capture-new-viewpoint") return LensNextBridgeCommands.CaptureNewViewpoint;
            if (request.HttpMethod == "POST" && path == "/v1/apply-working-view") return LensNextBridgeCommands.ApplyWorkingView;
            if (request.HttpMethod == "POST" && path == "/v1/restore-exact-visual-state") return LensNextBridgeCommands.RestoreExactVisualState;
            if (request.HttpMethod == "POST" && path == "/v1/publish-working-view") return LensNextBridgeCommands.PublishWorkingView;
            if (request.HttpMethod == "POST" && path == "/v1/materialize-my-view") return LensNextBridgeCommands.MaterializeMyView;
            return null;
        }

        private LensNextBridgeRequest ParsePost(HttpListenerRequest request, string command)
        {
            var body = ReadUtf8JsonBody(request.InputStream);
            if (body.Length > 8 * 1024 * 1024) throw new InvalidOperationException("Lens Next bridge request body is too large.");
            var raw = _json.Deserialize<Dictionary<string, object>>(body) ?? new Dictionary<string, object>();
            var requestId = StringValue(raw, "requestId") ?? request.Headers["X-Request-Id"] ?? Guid.NewGuid().ToString("N");
            var idempotency = StringValue(raw, "idempotencyKey") ?? requestId;
            var protocol = IntValue(raw, "protocolVersion", 0);
            var bodyCommand = StringValue(raw, "command");
            if (!string.Equals(bodyCommand, command, StringComparison.Ordinal)) throw new InvalidOperationException("Bridge route and command do not match.");
            var fields = new Dictionary<string, string>(StringComparer.Ordinal);
            object fieldsObject;
            var fieldMap = raw.TryGetValue("fields", out fieldsObject) ? fieldsObject as Dictionary<string, object> : null;
            if (fieldMap != null)
                foreach (var pair in fieldMap) fields[pair.Key] = pair.Value == null ? null : Convert.ToString(pair.Value, System.Globalization.CultureInfo.InvariantCulture);
            return new LensNextBridgeRequest { ProtocolVersion = protocol, RequestId = requestId, IdempotencyKey = idempotency, Command = command, Fields = fields };
        }

        private static string ReadUtf8JsonBody(Stream input)
        {
            if (input == null) throw new ArgumentNullException(nameof(input));
            var strictUtf8 = new UTF8Encoding(false, true);
            using (var reader = new StreamReader(input, strictUtf8, false, 4096, true))
                return reader.ReadToEnd();
        }

        private static LensNextBridgeRequest CreateGetRequest(HttpListenerRequest request, string command)
        {
            var requestId = request.Headers["X-Request-Id"] ?? ("lens-next-" + Guid.NewGuid().ToString("N"));
            return new LensNextBridgeRequest
            {
                ProtocolVersion = LensNextConstants.BridgeProtocolVersion,
                RequestId = requestId,
                IdempotencyKey = requestId,
                Command = command,
                Fields = new Dictionary<string, string>()
            };
        }

        private static string BearerToken(string header)
        {
            if (string.IsNullOrWhiteSpace(header)) return null;
            const string prefix = "Bearer ";
            return header.StartsWith(prefix, StringComparison.OrdinalIgnoreCase) ? header.Substring(prefix.Length).Trim() : null;
        }

        private static string StringValue(Dictionary<string, object> source, string key)
        {
            object value;
            return source.TryGetValue(key, out value) && value != null ? Convert.ToString(value, System.Globalization.CultureInfo.InvariantCulture) : null;
        }

        private static int IntValue(Dictionary<string, object> source, string key, int fallback)
        {
            object value;
            int parsed;
            return source.TryGetValue(key, out value) && int.TryParse(Convert.ToString(value, System.Globalization.CultureInfo.InvariantCulture), out parsed) ? parsed : fallback;
        }

        private static Dictionary<string, object> WireEnvelope(LensNextBridgeResponse response)
        {
            var wireCode =
                response.Success &&
                response.Payload is LensNextPublishedViewpointPayload
                    ? "working_view_published"
                    : response.Code;

            return new Dictionary<string, object>
            {
                { "success", response.Success },
                { "code", wireCode },
                { "message", response.Message },
                { "payload", WirePayload(response.Payload) }
            };
        }

        private static object WirePayload(object payload)
        {
            if (payload == null) return null;
            var ping = payload as LensNextPingPayload;
            if (ping != null) return new Dictionary<string, object> { { "protocolVersion", ping.ProtocolVersion } };
            var caps = payload as LensNextCapabilities;
            if (caps != null) return new Dictionary<string, object>
            {
                { "protocolVersion", caps.ProtocolVersion }, { "mode", caps.Mode }, { "commands", caps.Commands },
                { "writesEnabled", caps.WritesEnabled }, { "savedViewpointMutationEnabled", caps.SavedViewpointMutationEnabled },
                { "viewpointPublishingEnabled", caps.ViewpointPublishingEnabled }, { "productionWritesEnabled", caps.ProductionWritesEnabled },
                { "visualCaptureEnabled", caps.VisualCaptureEnabled }, { "workingViewReconstructionEnabled", caps.WorkingViewReconstructionEnabled }, { "platformVisualWriteEnabled", caps.PlatformVisualWriteEnabled }
            };
            var context = payload as LensNextProjectContext;
            if (context != null) return new Dictionary<string, object>
            {
                { "sessionId", context.SessionId }, { "projectId", string.IsNullOrWhiteSpace(context.ProjectId) ? (object)null : int.Parse(context.ProjectId) },
                { "modelFingerprint", context.ModelFingerprint }, { "displayName", context.DisplayName },
                { "bindingSource", context.BindingSource }, { "modelBindingKey", context.ModelBindingKey }, { "managedViewpointCount", context.ManagedViewpointCount }
            };
            var inventory = payload as LensNextLocalInventory;
            if (inventory != null) return new Dictionary<string, object>
            {
                { "projectId", string.IsNullOrWhiteSpace(inventory.ProjectId) ? (object)null : int.Parse(inventory.ProjectId) },
                { "modelFingerprint", inventory.ModelFingerprint },
                { "modelBindingKey", inventory.ModelBindingKey },
                { "viewpoints", inventory.Viewpoints }
            };
            var opened = payload as LensNextOpenWorkingViewPayload;
            if (opened != null) return new Dictionary<string, object>
            {
                { "opened", true }, { "requestId", opened.RequestId },
                { "identity", new Dictionary<string, object>
                    {
                        { "projectId", opened.Identity.ProjectId }, { "serverId", opened.Identity.ServerId },
                        { "viewpointId", opened.Identity.ViewpointId }, { "lifecycleStatus", opened.Identity.LifecycleStatus },
                        { "revisionNumber", opened.Identity.RevisionNumber }
                    }
                }
            };
            var captured = payload as LensNextVisualCapturePayload;
            if (captured != null) return new Dictionary<string, object>
            {
                { "requestId", captured.RequestId }, { "identity", captured.Identity }, { "visualState", captured.VisualState }
            };
            var navigationCaptured = payload as LensNextNavigationCapturePayload;
            if (navigationCaptured != null) return new Dictionary<string, object>
            {
                { "requestId", navigationCaptured.RequestId }, { "identity", navigationCaptured.Identity }, { "navigationView", navigationCaptured.NavigationView }
            };
            var navigationApplied = payload as LensNextNavigationAppliedPayload;
            if (navigationApplied != null) return new Dictionary<string, object>
            {
                { "requestId", navigationApplied.RequestId },
                { "identity", new Dictionary<string, object>
                    {
                        { "projectId", navigationApplied.Identity.ProjectId },
                        { "serverId", navigationApplied.Identity.ServerId },
                        { "viewpointId", navigationApplied.Identity.ViewpointId },
                        { "lifecycleStatus", navigationApplied.Identity.LifecycleStatus },
                        { "revisionNumber", navigationApplied.Identity.RevisionNumber }
                    }
                },
                { "result", navigationApplied.Result }
            };
            var applied = payload as LensNextWorkingViewAppliedPayload;
            if (applied != null) return new Dictionary<string, object>
            {
                { "requestId", applied.RequestId }, { "identity", applied.Identity }, { "result", applied.Result }
            };
            var published = payload as LensNextPublishedViewpointPayload;
            if (published != null) return new Dictionary<string, object>
            {
                { "requestId", published.RequestId },
                { "identity", published.Identity },
                { "result", published.Result }
            };
            return payload;
        }

        private static Dictionary<string, object> ErrorEnvelope(string code, string message)
        {
            return new Dictionary<string, object> { { "success", false }, { "code", code }, { "message", message }, { "payload", null } };
        }

        private void AddCors(HttpListenerRequest request, HttpListenerResponse response, string origin)
        {
            if (!string.IsNullOrEmpty(origin) && _allowedOrigins.Contains(origin))
                response.Headers["Access-Control-Allow-Origin"] = origin;
            response.Headers["Vary"] = "Origin, Access-Control-Request-Private-Network";
            response.Headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
            response.Headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, X-BIMLog-Lens-Next-Protocol, X-Request-Id";
            response.Headers["Access-Control-Max-Age"] = "600";
            if (string.Equals(request.Headers["Access-Control-Request-Private-Network"], "true", StringComparison.OrdinalIgnoreCase))
                response.Headers["Access-Control-Allow-Private-Network"] = "true";
            response.Headers["Cache-Control"] = "no-store";
        }

        private void Write(HttpListenerResponse response, int status, object body)
        {
            var json = _json.Serialize(body);
            var bytes = Encoding.UTF8.GetBytes(json);
            response.StatusCode = status;
            response.ContentType = "application/json; charset=utf-8";
            response.ContentLength64 = bytes.Length;
            response.OutputStream.Write(bytes, 0, bytes.Length);
            response.Close();
        }

        public void Dispose()
        {
            _running = false;
            try { _listener.Stop(); } catch { }
            try { _listener.Close(); } catch { }
            try
            {
                if (_thread != null && _thread.IsAlive && !ReferenceEquals(Thread.CurrentThread, _thread))
                    _thread.Join(1000);
            }
            catch { }
        }
    }
}
