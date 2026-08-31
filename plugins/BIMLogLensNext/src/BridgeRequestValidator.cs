using System;
using System.Collections.Generic;
using System.Linq;

namespace BIMLogLensNext
{
    public sealed class BridgeRequestValidation
    {
        private BridgeRequestValidation(bool accepted, string code)
        {
            Accepted = accepted;
            Code = code;
        }

        public bool Accepted { get; }
        public string Code { get; }

        public static BridgeRequestValidation Accept() => new BridgeRequestValidation(true, "accepted");
        public static BridgeRequestValidation Reject(string code) => new BridgeRequestValidation(false, code);
    }

    public sealed class BridgeRequestValidator
    {
        private static readonly HashSet<string> ForbiddenResolverFields = new HashSet<string>(
            new[]
            {
                "label",
                "displayName",
                "displayId",
                "folderPath",
                "treePosition",
                "activeView",
                "firstMatch",
                "bestGuess"
            },
            StringComparer.OrdinalIgnoreCase);

        private static readonly HashSet<string> OpenFields = new HashSet<string>(
            new[]
            {
                "sessionId",
                "projectId",
                "serverId",
                "viewpointId",
                "lifecycleStatus",
                "revisionNumber",
                "modelFingerprint",
                "bimlogPhysicalId",
                "navisworksGuid"
            },
            StringComparer.Ordinal);

        private static readonly HashSet<string> VisualFields = new HashSet<string>(
            new[]
            {
                "sessionId", "projectId", "serverId", "viewpointId", "lifecycleStatus",
                "revisionNumber", "modelFingerprint", "includeScreenshot", "visualStateJson"
            },
            StringComparer.Ordinal);

        private static readonly HashSet<string> LocalCaptureFields = new HashSet<string>(
            new[] { "sessionId", "projectId", "navisworksGuid", "modelFingerprint", "includeScreenshot" },
            StringComparer.Ordinal);

        private static readonly HashSet<string> NewCaptureFields = new HashSet<string>(
            new[] { "sessionId", "projectId", "viewpointId", "modelFingerprint", "includeScreenshot" },
            StringComparer.Ordinal);

        private static readonly HashSet<string> PublishFields = new HashSet<string>(
            new[]
            {
                "sessionId", "projectId", "serverId", "viewpointId",
                "lifecycleStatus", "revisionNumber", "modelFingerprint",
                "displayName", "confirmationReason", "operationId",
                "expectedVisualDigest", "updateExisting",
                "publishedRecordId", "publishedNavisworksGuid", "publishVersion"
            },
            StringComparer.Ordinal);
        private static readonly HashSet<string> LayoutFields = new HashSet<string>(new[] { "sessionId", "projectId", "modelFingerprint", "layoutJson", "confirmationReason" }, StringComparer.Ordinal);

        private string _sessionToken;
        private DateTimeOffset _sessionExpiresAt;
        private readonly object _sessionSync = new object();
        private readonly string _approvedBridgeOrigin;
        private readonly bool _viewpointPublishingEnabled;

        public BridgeRequestValidator(
            string sessionToken,
            DateTimeOffset sessionExpiresAt,
            bool viewpointPublishingEnabled = false,
            string approvedBridgeOrigin = null)
        {
            if (string.IsNullOrWhiteSpace(sessionToken))
            {
                throw new ArgumentException("A non-empty per-session token is required.", nameof(sessionToken));
            }

            var maximumExpiry = DateTimeOffset.UtcNow.AddMinutes(LensNextConstants.BridgeMaximumTokenLifetimeMinutes);
            if (sessionExpiresAt <= DateTimeOffset.UtcNow || sessionExpiresAt > maximumExpiry)
            {
                throw new ArgumentOutOfRangeException(
                    nameof(sessionExpiresAt),
                    "The bridge session must expire within the bounded token lifetime.");
            }

            _sessionToken = sessionToken;
            _sessionExpiresAt = sessionExpiresAt;
            _approvedBridgeOrigin = approvedBridgeOrigin ?? "http://127.0.0.1:" + LensNextConstants.BridgeMinimumPort;
            _viewpointPublishingEnabled = viewpointPublishingEnabled;
        }

        public BridgeRequestValidation Validate(LensNextBridgeRequest request)
        {
            if (request == null)
            {
                return BridgeRequestValidation.Reject("request_required");
            }

            if (request.ProtocolVersion != LensNextConstants.BridgeProtocolVersion)
            {
                return BridgeRequestValidation.Reject("protocol_version_unsupported");
            }

            if (!string.Equals(request.Origin, _approvedBridgeOrigin, StringComparison.Ordinal))
            {
                return BridgeRequestValidation.Reject("origin_not_approved");
            }

            lock (_sessionSync)
            {
                if (!ConstantTimeEquals(request.SessionToken, _sessionToken))
                    return BridgeRequestValidation.Reject("session_token_invalid");
                if (DateTimeOffset.UtcNow >= _sessionExpiresAt)
                    return BridgeRequestValidation.Reject("session_token_expired");
            }

            if (string.IsNullOrWhiteSpace(request.RequestId) || request.RequestId.Length > 128)
            {
                return BridgeRequestValidation.Reject("request_id_invalid");
            }

            if (string.IsNullOrWhiteSpace(request.IdempotencyKey) || request.IdempotencyKey.Length > 128)
            {
                return BridgeRequestValidation.Reject("idempotency_key_invalid");
            }
            if (!string.Equals(request.RequestId, request.IdempotencyKey, StringComparison.Ordinal))
            {
                return BridgeRequestValidation.Reject("idempotency_key_mismatch");
            }

            var isPublishing =
                request.Command == LensNextBridgeCommands.PublishWorkingView;
            var isLayout = request.Command == LensNextBridgeCommands.MaterializeMyView;

            if (
                !LensNextBridgeCommands.ReadOnlyCommands.Contains(request.Command) &&
                !((isPublishing || isLayout) && _viewpointPublishingEnabled)
            )
            {
                return BridgeRequestValidation.Reject(
                    (isPublishing || isLayout)
                        ? "viewpoint_publishing_disabled"
                        : "command_not_allowed"
                );
            }

            var fields = request.Fields ?? new Dictionary<string, string>();
            if (fields.Count > LensNextConstants.BridgeMaximumFieldCount ||
                fields.Any(pair => pair.Key == null || pair.Key.Length > 128 ||
                                   pair.Value != null && pair.Value.Length > LensNextConstants.BridgeMaximumFieldLength))
            {
                return BridgeRequestValidation.Reject("request_fields_too_large");
            }
            if (
                !isPublishing && !isLayout &&
                fields.Keys.Any(key => ForbiddenResolverFields.Contains(key))
            )
            {
                return BridgeRequestValidation.Reject(
                    "fallback_resolver_forbidden"
                );
            }

            if (request.Command == LensNextBridgeCommands.OpenWorkingView &&
                fields.Keys.Any(key => !OpenFields.Contains(key)))
            {
                return BridgeRequestValidation.Reject("unknown_open_field");
            }

            if ((request.Command == LensNextBridgeCommands.CaptureVisualState ||
                 request.Command == LensNextBridgeCommands.ApplyWorkingView) &&
                fields.Keys.Any(key => !VisualFields.Contains(key)))
            {
                return BridgeRequestValidation.Reject("unknown_visual_field");
            }
            if (request.Command == LensNextBridgeCommands.CaptureLocalViewpoint &&
                fields.Keys.Any(key => !LocalCaptureFields.Contains(key)))
                return BridgeRequestValidation.Reject("unknown_local_capture_field");
            if (request.Command == LensNextBridgeCommands.CaptureLocalViewpoint)
            {
                foreach (var required in new[] { "sessionId", "projectId", "navisworksGuid", "modelFingerprint" })
                {
                    string value;
                    if (!fields.TryGetValue(required, out value) || string.IsNullOrWhiteSpace(value))
                        return BridgeRequestValidation.Reject("local_capture_field_required");
                }
                Guid parsedGuid;
                if (!Guid.TryParse(fields["navisworksGuid"], out parsedGuid) || parsedGuid == Guid.Empty)
                    return BridgeRequestValidation.Reject("local_capture_guid_invalid");
            }
            if (request.Command == LensNextBridgeCommands.CaptureNewViewpoint &&
                fields.Keys.Any(key => !NewCaptureFields.Contains(key)))
                return BridgeRequestValidation.Reject("unknown_new_capture_field");
            if (request.Command == LensNextBridgeCommands.CaptureNewViewpoint)
            {
                foreach (var required in new[] { "sessionId", "projectId", "viewpointId", "modelFingerprint" })
                {
                    string value;
                    if (!fields.TryGetValue(required, out value) || string.IsNullOrWhiteSpace(value))
                        return BridgeRequestValidation.Reject("new_capture_field_required");
                }
            }
            if (request.Command == LensNextBridgeCommands.ApplyWorkingView &&
                (!fields.ContainsKey("visualStateJson") || string.IsNullOrWhiteSpace(fields["visualStateJson"])))
            {
                return BridgeRequestValidation.Reject("visual_state_required");
            }

            if (isPublishing)
            {
                if (fields.Keys.Any(key => !PublishFields.Contains(key)))
                    return BridgeRequestValidation.Reject(
                        "unknown_publish_field"
                    );

                foreach (var required in new[]
                {
                    "sessionId", "projectId", "serverId", "viewpointId",
                    "lifecycleStatus", "revisionNumber", "modelFingerprint",
                    "displayName", "confirmationReason", "operationId",
                    "expectedVisualDigest", "updateExisting"
                })
                {
                    string value;
                    if (
                        !fields.TryGetValue(required, out value) ||
                        string.IsNullOrWhiteSpace(value)
                    )
                        return BridgeRequestValidation.Reject(
                            "publish_field_required"
                        );
                }

                if (!IsSha256(fields["expectedVisualDigest"]))
                    return BridgeRequestValidation.Reject(
                        "publish_visual_digest_invalid"
                    );

                var update = fields["updateExisting"];

                if (
                    !string.Equals(update, "true", StringComparison.Ordinal) &&
                    !string.Equals(update, "false", StringComparison.Ordinal)
                )
                    return BridgeRequestValidation.Reject(
                        "publish_mode_invalid"
                    );

                if (string.Equals(update, "true", StringComparison.Ordinal))
                {
                    foreach (var required in new[]
                    {
                        "publishedRecordId",
                        "publishedNavisworksGuid",
                        "publishVersion"
                    })
                    {
                        string value;
                        if (
                            !fields.TryGetValue(required, out value) ||
                            string.IsNullOrWhiteSpace(value)
                        )
                            return BridgeRequestValidation.Reject(
                                "published_identity_required"
                            );
                    }
                }
                else if (
                    fields.ContainsKey("publishedRecordId") ||
                    fields.ContainsKey("publishedNavisworksGuid") ||
                    fields.ContainsKey("publishVersion")
                )
                {
                    return BridgeRequestValidation.Reject(
                        "unexpected_published_identity"
                    );
                }
            }
            if (isLayout)
            {
                if (fields.Keys.Any(key => !LayoutFields.Contains(key))) return BridgeRequestValidation.Reject("unknown_layout_field");
                foreach (var required in new[] { "sessionId", "projectId", "modelFingerprint", "layoutJson", "confirmationReason" })
                {
                    string value;
                    if (!fields.TryGetValue(required, out value) || string.IsNullOrWhiteSpace(value)) return BridgeRequestValidation.Reject("layout_field_required");
                }
            }

            return BridgeRequestValidation.Accept();
        }

        public void RenewSession(string sessionToken, DateTimeOffset sessionExpiresAt)
        {
            if (string.IsNullOrWhiteSpace(sessionToken)) throw new ArgumentException("Session token required.", nameof(sessionToken));
            var now = DateTimeOffset.UtcNow;
            if (sessionExpiresAt <= now || sessionExpiresAt > now.AddMinutes(LensNextConstants.BridgeMaximumTokenLifetimeMinutes))
                throw new ArgumentOutOfRangeException(nameof(sessionExpiresAt));
            lock (_sessionSync)
            {
                _sessionToken = sessionToken;
                _sessionExpiresAt = sessionExpiresAt;
            }
        }

        private static bool IsSha256(string value)
        {
            if (string.IsNullOrWhiteSpace(value) || value.Length != 64)
                return false;

            foreach (var character in value)
            {
                var hexadecimal =
                    character >= '0' && character <= '9' ||
                    character >= 'a' && character <= 'f' ||
                    character >= 'A' && character <= 'F';

                if (!hexadecimal) return false;
            }

            return true;
        }

        private static bool ConstantTimeEquals(string supplied, string expected)
        {
            if (supplied == null || expected == null)
            {
                return false;
            }

            var difference = supplied.Length ^ expected.Length;
            var count = Math.Max(supplied.Length, expected.Length);
            for (var index = 0; index < count; index++)
            {
                var left = index < supplied.Length ? supplied[index] : '\0';
                var right = index < expected.Length ? expected[index] : '\0';
                difference |= left ^ right;
            }

            return difference == 0;
        }
    }
}
