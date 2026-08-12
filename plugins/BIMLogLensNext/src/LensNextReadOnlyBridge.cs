using System;
using System.Collections.Generic;

namespace BIMLogLensNext
{
    public sealed class LensNextReadOnlyBridge
    {
        private readonly BridgeRequestValidator _validator;
        private readonly ILensNextReadOnlyNavisworksAdapter _adapter;
        private readonly INavisworksUiThreadDispatcher _dispatcher;
        private readonly ImmutableIdentityResolver _resolver;
        private readonly string _sessionId;

        public LensNextReadOnlyBridge(
            string sessionToken,
            string sessionId,
            DateTimeOffset sessionExpiresAt,
            ILensNextReadOnlyNavisworksAdapter adapter,
            INavisworksUiThreadDispatcher dispatcher,
            ImmutableIdentityResolver resolver)
        {
            if (string.IsNullOrWhiteSpace(sessionId))
            {
                throw new ArgumentException("A non-empty bridge session ID is required.", nameof(sessionId));
            }
            _validator = new BridgeRequestValidator(sessionToken, sessionExpiresAt);
            _sessionId = sessionId;
            _adapter = adapter ?? throw new ArgumentNullException(nameof(adapter));
            _dispatcher = dispatcher ?? throw new ArgumentNullException(nameof(dispatcher));
            _resolver = resolver ?? throw new ArgumentNullException(nameof(resolver));
        }

        public LensNextBridgeResponse Execute(LensNextBridgeRequest request)
        {
            var validation = _validator.Validate(request);
            if (!validation.Accepted)
            {
                return LensNextBridgeResponse.Blocked(validation.Code, "Request blocked by the read-only bridge contract.");
            }

            switch (request.Command)
            {
                case LensNextBridgeCommands.Ping:
                    return LensNextBridgeResponse.Ok("pong", new LensNextPingPayload());
                case LensNextBridgeCommands.Capabilities:
                    return LensNextBridgeResponse.Ok("capabilities", new LensNextCapabilities());
                case LensNextBridgeCommands.ProjectContext:
                    return ReadProjectContext();
                case LensNextBridgeCommands.OpenWorkingView:
                    return OpenWorkingView(request);
                default:
                    return LensNextBridgeResponse.Blocked("command_not_allowed_read_only", "Command is unavailable.");
            }
        }

        private LensNextBridgeResponse ReadProjectContext()
        {
            var context = _dispatcher.Invoke(() => _adapter.ReadProjectContext());
            if (context != null)
            {
                context.SessionId = _sessionId;
            }
            return context == null
                ? LensNextBridgeResponse.Blocked("project_context_unavailable", "No exact project context is available.")
                : LensNextBridgeResponse.Ok("project_context", context);
        }

        private LensNextBridgeResponse OpenWorkingView(LensNextBridgeRequest request)
        {
            var fields = request.Fields;
            var identity = new ImmutableWorkingViewIdentity
            {
                SessionId = Value(fields, "sessionId"),
                ProjectId = Value(fields, "projectId"),
                ServerId = Value(fields, "serverId"),
                ViewpointId = Value(fields, "viewpointId"),
                LifecycleStatus = Value(fields, "lifecycleStatus"),
                RevisionNumber = Value(fields, "revisionNumber"),
                ModelFingerprint = Value(fields, "modelFingerprint"),
                BimlogPhysicalId = Value(fields, "bimlogPhysicalId"),
                NavisworksGuid = Value(fields, "navisworksGuid")
            };

            var identityErrors = identity.Validate();
            if (identityErrors.Count != 0)
            {
                return LensNextBridgeResponse.Blocked("identity_invalid", string.Join("; ", identityErrors));
            }
            if (!string.Equals(identity.SessionId, _sessionId, StringComparison.Ordinal))
            {
                return LensNextBridgeResponse.Blocked(
                    "session_context_mismatch",
                    "The working-view request does not belong to the active bridge session.");
            }

            var candidates = _dispatcher.Invoke(() => _adapter.FindExistingWorkingViews(identity));
            var resolution = _resolver.Resolve(identity, candidates);
            if (resolution.Status != ImmutableResolutionStatus.Resolved)
            {
                return LensNextBridgeResponse.Blocked(
                    resolution.Status == ImmutableResolutionStatus.Ambiguous
                        ? "identity_ambiguous"
                        : resolution.Status == ImmutableResolutionStatus.Missing
                            ? "identity_not_found"
                            : "identity_invalid",
                    resolution.Reason);
            }

            var opened = _dispatcher.Invoke(() => _adapter.OpenExistingWorkingView(resolution.Candidate));
            return opened
                ? LensNextBridgeResponse.Ok("working_view_opened", new LensNextOpenWorkingViewPayload
                {
                    RequestId = request.RequestId,
                    Identity = new LensNextWireIdentity
                    {
                        ProjectId = PositiveInteger(identity.ProjectId, "projectId"),
                        ServerId = PositiveInteger(identity.ServerId, "serverId"),
                        ViewpointId = identity.ViewpointId,
                        LifecycleStatus = identity.LifecycleStatus,
                        RevisionNumber = PositiveInteger(identity.RevisionNumber, "revisionNumber")
                    }
                })
                : LensNextBridgeResponse.Blocked("working_view_open_failed", "The exact existing working view could not be opened.");
        }

        private static int PositiveInteger(string value, string field)
        {
            int parsed;
            if (!int.TryParse(value, out parsed) || parsed <= 0)
            {
                throw new InvalidOperationException(field + " must be a positive integer after validation.");
            }
            return parsed;
        }

        private static string Value(IReadOnlyDictionary<string, string> fields, string key)
        {
            if (fields == null)
            {
                return null;
            }

            string value;
            return fields.TryGetValue(key, out value) ? value : null;
        }
    }
}
