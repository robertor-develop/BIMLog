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
        private readonly bool _viewpointPublishingEnabled;

        public LensNextReadOnlyBridge(
            string sessionToken,
            string sessionId,
            DateTimeOffset sessionExpiresAt,
            ILensNextReadOnlyNavisworksAdapter adapter,
            INavisworksUiThreadDispatcher dispatcher,
            ImmutableIdentityResolver resolver,
            bool viewpointPublishingEnabled = false,
            string approvedBridgeOrigin = null)
        {
            if (string.IsNullOrWhiteSpace(sessionId))
            {
                throw new ArgumentException("A non-empty bridge session ID is required.", nameof(sessionId));
            }
            _validator = new BridgeRequestValidator(
                sessionToken,
                sessionExpiresAt,
                viewpointPublishingEnabled,
                approvedBridgeOrigin
            );
            _sessionId = sessionId;
            _viewpointPublishingEnabled = viewpointPublishingEnabled;
            _adapter = adapter ?? throw new ArgumentNullException(nameof(adapter));
            _dispatcher = dispatcher ?? throw new ArgumentNullException(nameof(dispatcher));
            _resolver = resolver ?? throw new ArgumentNullException(nameof(resolver));
        }

        public LensNextBridgeResponse Execute(LensNextBridgeRequest request)
        {
            var validation = _validator.Validate(request);
            if (!validation.Accepted)
            {
                return LensNextBridgeResponse.Blocked(
                    validation.Code,
                    "Request blocked by the bridge contract. Code=" + validation.Code + ".");
            }

            switch (request.Command)
            {
                case LensNextBridgeCommands.Ping:
                    return LensNextBridgeResponse.Ok("pong", new LensNextPingPayload());
                case LensNextBridgeCommands.Capabilities:
                    return LensNextBridgeResponse.Ok("capabilities", new LensNextCapabilities(_viewpointPublishingEnabled));
                case LensNextBridgeCommands.ProjectContext:
                    return ReadProjectContext();
                case LensNextBridgeCommands.LocalInventory:
                    return ReadLocalInventory();
                case LensNextBridgeCommands.BindProject:
                    return BindProject(request);
                case LensNextBridgeCommands.OpenWorkingView:
                    return OpenWorkingView(request);
                case LensNextBridgeCommands.CaptureVisualState:
                    return CaptureVisualState(request);
                case LensNextBridgeCommands.CaptureLocalViewpoint:
                    return CaptureLocalViewpoint(request);
                case LensNextBridgeCommands.CaptureNewViewpoint:
                    return CaptureNewViewpoint(request);
                case LensNextBridgeCommands.ApplyWorkingView:
                    return ApplyWorkingView(request);
                case LensNextBridgeCommands.RestoreExactVisualState:
                    return RestoreExactVisualState(request);
                case LensNextBridgeCommands.PublishWorkingView:
                    return PublishWorkingView(request);
                case LensNextBridgeCommands.MaterializeMyView:
                    return MaterializeMyView(request);
                default:
                    return LensNextBridgeResponse.Blocked("command_not_allowed_read_only", "Command is unavailable.");
            }
        }

        public void RenewSession(string sessionToken, DateTimeOffset sessionExpiresAt)
        {
            _validator.RenewSession(sessionToken, sessionExpiresAt);
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

        private LensNextBridgeResponse ReadLocalInventory()
        {
            var inventory = _dispatcher.Invoke(() => _adapter.ReadLocalInventory());
            return inventory == null
                ? LensNextBridgeResponse.Blocked("local_inventory_unavailable", "No BIMLog-managed Navisworks inventory is available.")
                : LensNextBridgeResponse.Ok("local_inventory", inventory);
        }

        private LensNextBridgeResponse BindProject(LensNextBridgeRequest request)
        {
            var projectId = Value(request.Fields, "projectId");
            var bindingSource = Value(request.Fields, "bindingSource");
            var context = _dispatcher.Invoke(() => _adapter.BindProject(projectId, bindingSource));
            if (context == null) return LensNextBridgeResponse.Blocked("project_binding_refused", "Navisworks refused the BIMLog project binding.");
            context.SessionId = _sessionId;
            return LensNextBridgeResponse.Ok("project_bound", context);
        }

        private LensNextBridgeResponse CaptureVisualState(LensNextBridgeRequest request)
        {
            var visualAdapter = _adapter as ILensNextVisualNavisworksAdapter;
            if (visualAdapter == null)
                return LensNextBridgeResponse.Blocked("visual_capture_unsupported", "This Navisworks adapter does not support Lens Next visual capture.");
            var identity = IdentityFromFields(request.Fields);
            var validation = ValidateSessionIdentity(identity);
            if (validation != null) return validation;
            var includeScreenshot = string.Equals(Value(request.Fields, "includeScreenshot"), "true", StringComparison.OrdinalIgnoreCase);
            var state = _dispatcher.Invoke(() => visualAdapter.CaptureCurrentVisualState(identity, includeScreenshot));
            if (state == null)
                return LensNextBridgeResponse.Blocked("visual_capture_failed", "Navisworks did not return a visual state.");
            return LensNextBridgeResponse.Ok("visual_state_captured", new LensNextVisualCapturePayload
            {
                RequestId = request.RequestId,
                Identity = WireIdentity(identity),
                VisualState = state
            });
        }

        private LensNextBridgeResponse CaptureLocalViewpoint(LensNextBridgeRequest request)
        {
            var visualAdapter = _adapter as ILensNextVisualNavisworksAdapter;
            if (visualAdapter == null)
                return LensNextBridgeResponse.Blocked("visual_capture_unsupported", "This Navisworks adapter does not support Lens Next visual capture.");
            var projectId = Value(request.Fields, "projectId");
            var fingerprint = Value(request.Fields, "modelFingerprint");
            if (!string.Equals(Value(request.Fields, "sessionId"), _sessionId, StringComparison.Ordinal) ||
                string.IsNullOrWhiteSpace(projectId) || string.IsNullOrWhiteSpace(fingerprint))
                return LensNextBridgeResponse.Blocked("local_capture_context_invalid", "The exact local capture context is invalid.");
            var local = _dispatcher.Invoke(() => _adapter.OpenExactManagedLocalViewpoint(projectId, Value(request.Fields, "navisworksGuid")));
            if (local == null || !local.ExactManagedIdentity || !string.IsNullOrWhiteSpace(local.ServerId))
                return LensNextBridgeResponse.Blocked("local_viewpoint_not_uploadable", "Only an exact BIMLog-managed local-only viewpoint can be captured for upload.");
            var identity = new ImmutableWorkingViewIdentity
            {
                SessionId = _sessionId, ProjectId = projectId, ServerId = "1", ViewpointId = local.ViewpointId,
                LifecycleStatus = "active", RevisionNumber = "1", ModelFingerprint = fingerprint,
                BimlogPhysicalId = local.BimlogPhysicalId, NavisworksGuid = local.NavisworksGuid
            };
            var includeScreenshot = string.Equals(Value(request.Fields, "includeScreenshot"), "true", StringComparison.OrdinalIgnoreCase);
            var state = _dispatcher.Invoke(() => visualAdapter.CaptureCurrentVisualState(identity, includeScreenshot));
            if (state == null) return LensNextBridgeResponse.Blocked("visual_capture_failed", "Navisworks did not return a visual state.");
            return LensNextBridgeResponse.Ok("local_viewpoint_captured", new { RequestId = request.RequestId, LocalViewpoint = local, VisualState = state });
        }

        private LensNextBridgeResponse CaptureNewViewpoint(LensNextBridgeRequest request)
        {
            var visualAdapter = _adapter as ILensNextVisualNavisworksAdapter;
            if (visualAdapter == null)
                return LensNextBridgeResponse.Blocked("visual_capture_unsupported", "This Navisworks adapter does not support Lens Next visual capture.");
            var projectId = Value(request.Fields, "projectId");
            var viewpointId = Value(request.Fields, "viewpointId");
            var fingerprint = Value(request.Fields, "modelFingerprint");
            if (!string.Equals(Value(request.Fields, "sessionId"), _sessionId, StringComparison.Ordinal) ||
                string.IsNullOrWhiteSpace(projectId) || string.IsNullOrWhiteSpace(viewpointId) || string.IsNullOrWhiteSpace(fingerprint))
                return LensNextBridgeResponse.Blocked("new_capture_context_invalid", "The exact new-viewpoint capture context is invalid.");
            var identity = new ImmutableWorkingViewIdentity
            {
                SessionId = _sessionId, ProjectId = projectId, ServerId = "1", ViewpointId = viewpointId,
                LifecycleStatus = "active", RevisionNumber = "1", ModelFingerprint = fingerprint
            };
            var includeScreenshot = string.Equals(Value(request.Fields, "includeScreenshot"), "true", StringComparison.OrdinalIgnoreCase);
            var navigation = _dispatcher.Invoke(() => visualAdapter.CaptureCurrentNavigationView(identity, includeScreenshot));
            if (navigation == null) return LensNextBridgeResponse.Blocked("navigation_capture_failed", "Navisworks did not return a navigation view.");
            return LensNextBridgeResponse.Ok("new_viewpoint_captured", new LensNextNavigationCapturePayload
            {
                RequestId = request.RequestId,
                Identity = WireIdentity(identity),
                NavigationView = navigation
            });
        }

        private LensNextBridgeResponse ApplyWorkingView(LensNextBridgeRequest request)
        {
            var visualAdapter = _adapter as ILensNextVisualNavisworksAdapter;
            if (visualAdapter == null)
                return LensNextBridgeResponse.Blocked("working_view_reconstruction_unsupported", "This Navisworks adapter cannot reconstruct a temporary working view.");
            var identity = IdentityFromFields(request.Fields);
            var validation = ValidateSessionIdentity(identity);
            if (validation != null) return validation;
            var visualStateJson = Value(request.Fields, "visualStateJson");
            if (string.IsNullOrWhiteSpace(visualStateJson))
                return LensNextBridgeResponse.Blocked("visual_state_required", "A BIMLog visual-state payload is required.");
            var storedVisualStateDigest = Value(request.Fields, "visualStateDigest");
            if (string.IsNullOrWhiteSpace(storedVisualStateDigest))
                return LensNextBridgeResponse.Blocked("visual_state_digest_required", "The authoritative BIMLog visual-state digest is required.");
            var result = _dispatcher.Invoke(() => visualAdapter.ApplyNavigationViewJson(identity, visualStateJson, storedVisualStateDigest, request.RequestId));
            if (result == null || !result.Applied)
                return LensNextBridgeResponse.Blocked("working_view_apply_failed", result == null ? "Working-view navigation failed." : result.Message);
            return LensNextBridgeResponse.Ok("working_view_applied", new LensNextNavigationAppliedPayload
            {
                RequestId = request.RequestId,
                Identity = WireIdentity(identity),
                Result = result
            });
        }

        private LensNextBridgeResponse RestoreExactVisualState(LensNextBridgeRequest request)
        {
            var visualAdapter = _adapter as ILensNextVisualNavisworksAdapter;
            if (visualAdapter == null) return LensNextBridgeResponse.Blocked("exact_visual_restore_unsupported", "This Navisworks adapter cannot restore exact visual state.");
            var identity = IdentityFromFields(request.Fields);
            var validation = ValidateSessionIdentity(identity);
            if (validation != null) return validation;
            var visualStateJson = Value(request.Fields, "visualStateJson");
            var digest = Value(request.Fields, "visualStateDigest");
            if (string.IsNullOrWhiteSpace(visualStateJson) || string.IsNullOrWhiteSpace(digest)) return LensNextBridgeResponse.Blocked("visual_state_required", "A full BIMLog Visual Package and digest are required.");
            var result = _dispatcher.Invoke(() => visualAdapter.ApplyWorkingVisualStateJson(identity, visualStateJson, digest, request.RequestId));
            if (result == null || !result.Applied) return LensNextBridgeResponse.Blocked("exact_visual_restore_failed", result == null ? "Exact visual-state restoration failed." : result.Message);
            return LensNextBridgeResponse.Ok("exact_visual_state_restored", new LensNextWorkingViewAppliedPayload { RequestId = request.RequestId, Identity = WireIdentity(identity), Result = result });
        }

        private LensNextBridgeResponse PublishWorkingView(
            LensNextBridgeRequest bridgeRequest)
        {
            if (!_viewpointPublishingEnabled)
                return LensNextBridgeResponse.Blocked(
                    "viewpoint_publishing_disabled",
                    "M7 viewpoint publishing is disabled."
                );

            var publishAdapter =
                _adapter as ILensNextPublishNavisworksAdapter;

            if (publishAdapter == null)
                return LensNextBridgeResponse.Blocked(
                    "viewpoint_publishing_unsupported",
                    "This Navisworks adapter does not support publishing."
                );

            var fields = bridgeRequest.Fields;
            var identity = IdentityFromFields(fields);
            var identityValidation = ValidateSessionIdentity(identity);

            if (identityValidation != null)
                return identityValidation;

            var updateExisting = string.Equals(
                Value(fields, "updateExisting"),
                "true",
                StringComparison.Ordinal
            );

            LensNextPublishedIdentity existing = null;

            if (updateExisting)
            {
                existing = new LensNextPublishedIdentity
                {
                    ProjectId = PositiveInteger(
                        identity.ProjectId,
                        "projectId"
                    ),
                    ServerId = PositiveInteger(
                        identity.ServerId,
                        "serverId"
                    ),
                    ViewpointId = identity.ViewpointId,
                    LifecycleStatus = identity.LifecycleStatus,
                    RevisionNumber = PositiveInteger(
                        identity.RevisionNumber,
                        "revisionNumber"
                    ),
                    ModelFingerprint = identity.ModelFingerprint,
                    PublishedRecordId = Value(
                        fields,
                        "publishedRecordId"
                    ),
                    NavisworksGuid = Value(
                        fields,
                        "publishedNavisworksGuid"
                    ),
                    PublishVersion = PositiveInteger(
                        Value(fields, "publishVersion"),
                        "publishVersion"
                    )
                };
            }

            var request = new LensNextPublishRequest
            {
                IssueIdentity = identity,
                ExistingPublishedIdentity = existing,
                DisplayName = Value(fields, "displayName"),
                ConfirmationReason = Value(
                    fields,
                    "confirmationReason"
                ),
                OperationId = Value(fields, "operationId"),
                ExpectedVisualDigest = Value(
                    fields,
                    "expectedVisualDigest"
                ),
                UpdateExisting = updateExisting
            };

            var policyErrors = LensNextPublishPolicy.Validate(request);

            if (policyErrors.Count != 0)
                return LensNextBridgeResponse.Blocked(
                    "publish_request_invalid",
                    string.Join("; ", policyErrors)
                );

            var result = _dispatcher.Invoke(
                () => publishAdapter.PublishCurrentWorkingView(request)
            );

            if (result == null || !result.Published)
                return LensNextBridgeResponse.Blocked(
                    "viewpoint_publish_failed",
                    result == null
                        ? "Navisworks returned no publishing result."
                        : result.Message
                );

            return LensNextBridgeResponse.Ok(
                "viewpoint_published",
                new LensNextPublishedViewpointPayload
                {
                    RequestId = bridgeRequest.RequestId,
                    Identity = WireIdentity(identity),
                    Result = result
                }
            );
        }

        private LensNextBridgeResponse ValidateSessionIdentity(ImmutableWorkingViewIdentity identity)
        {
            var errors = identity.Validate();
            if (errors.Count != 0) return LensNextBridgeResponse.Blocked("identity_invalid", string.Join("; ", errors));
            if (!string.Equals(identity.SessionId, _sessionId, StringComparison.Ordinal))
                return LensNextBridgeResponse.Blocked("session_context_mismatch", "The visual-state request does not belong to the active bridge session.");
            return null;
        }

        private LensNextBridgeResponse MaterializeMyView(LensNextBridgeRequest request)
        {
            if (!_viewpointPublishingEnabled) return LensNextBridgeResponse.Blocked("viewpoint_publishing_disabled", "Controlled local layout is disabled.");
            if (!string.Equals(Value(request.Fields, "sessionId"), _sessionId, StringComparison.Ordinal)) return LensNextBridgeResponse.Blocked("session_context_mismatch", "The layout request does not belong to the active bridge session.");
            var adapter = _adapter as ILensNextLayoutNavisworksAdapter;
            if (adapter == null) return LensNextBridgeResponse.Blocked("layout_unsupported", "This Navisworks adapter does not support governed My View layout.");
            var result = _dispatcher.Invoke(() => adapter.MaterializeMyView(new LensNextLayoutRequest { ProjectId = Value(request.Fields, "projectId"), ModelFingerprint = Value(request.Fields, "modelFingerprint"), LayoutJson = Value(request.Fields, "layoutJson"), ConfirmationReason = Value(request.Fields, "confirmationReason") }));
            return LensNextBridgeResponse.Ok("my_view_materialized", result);
        }

        private static ImmutableWorkingViewIdentity IdentityFromFields(IReadOnlyDictionary<string, string> fields)
        {
            return new ImmutableWorkingViewIdentity
            {
                SessionId = Value(fields, "sessionId"), ProjectId = Value(fields, "projectId"),
                ServerId = Value(fields, "serverId"), ViewpointId = Value(fields, "viewpointId"),
                LifecycleStatus = Value(fields, "lifecycleStatus"), RevisionNumber = Value(fields, "revisionNumber"),
                ModelFingerprint = Value(fields, "modelFingerprint")
            };
        }

        private static LensNextWireIdentity WireIdentity(ImmutableWorkingViewIdentity identity)
        {
            return new LensNextWireIdentity
            {
                ProjectId = PositiveInteger(identity.ProjectId, "projectId"), ServerId = PositiveInteger(identity.ServerId, "serverId"),
                ViewpointId = identity.ViewpointId, LifecycleStatus = identity.LifecycleStatus,
                RevisionNumber = PositiveInteger(identity.RevisionNumber, "revisionNumber")
            };
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
                        ? (string.IsNullOrWhiteSpace(identity.NavisworksGuid) ? "legacy_viewpoint_name_ambiguous" : "identity_ambiguous")
                        : resolution.Status == ImmutableResolutionStatus.Missing
                            ? (string.IsNullOrWhiteSpace(identity.NavisworksGuid) ? "legacy_viewpoint_name_not_found" : "saved_viewpoint_source_missing")
                            : "identity_invalid",
                    resolution.Status == ImmutableResolutionStatus.Missing
                        ? (string.IsNullOrWhiteSpace(identity.NavisworksGuid)
                            ? "No Saved Viewpoint DisplayName exactly equals the historical platform viewpointId."
                            : "The original Navisworks Saved Viewpoint is not present in this model and BIMLog has no stored visual-state package. Open a model version that contains the exact Saved Viewpoint, then retry once to recover it into BIMLog.")
                        : resolution.Status == ImmutableResolutionStatus.Ambiguous && string.IsNullOrWhiteSpace(identity.NavisworksGuid)
                            ? "More than one Saved Viewpoint DisplayName exactly equals the historical platform viewpointId; no view was opened."
                            : resolution.Reason);
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
