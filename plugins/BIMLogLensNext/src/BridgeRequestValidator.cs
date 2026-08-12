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

        private readonly string _sessionToken;
        private readonly DateTimeOffset _sessionExpiresAt;

        public BridgeRequestValidator(string sessionToken, DateTimeOffset sessionExpiresAt)
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

            if (!string.Equals(request.Origin, LensNextConstants.BridgeOrigin, StringComparison.Ordinal))
            {
                return BridgeRequestValidation.Reject("origin_not_approved");
            }

            if (!ConstantTimeEquals(request.SessionToken, _sessionToken))
            {
                return BridgeRequestValidation.Reject("session_token_invalid");
            }

            if (DateTimeOffset.UtcNow >= _sessionExpiresAt)
            {
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

            if (!LensNextBridgeCommands.ReadOnlyCommands.Contains(request.Command))
            {
                return BridgeRequestValidation.Reject("command_not_allowed_read_only");
            }

            var fields = request.Fields ?? new Dictionary<string, string>();
            if (fields.Count > LensNextConstants.BridgeMaximumFieldCount ||
                fields.Any(pair => pair.Key == null || pair.Key.Length > 128 ||
                                   pair.Value != null && pair.Value.Length > LensNextConstants.BridgeMaximumFieldLength))
            {
                return BridgeRequestValidation.Reject("request_fields_too_large");
            }
            if (fields.Keys.Any(key => ForbiddenResolverFields.Contains(key)))
            {
                return BridgeRequestValidation.Reject("fallback_resolver_forbidden");
            }

            if (request.Command == LensNextBridgeCommands.OpenWorkingView &&
                fields.Keys.Any(key => !OpenFields.Contains(key)))
            {
                return BridgeRequestValidation.Reject("unknown_open_field");
            }

            return BridgeRequestValidation.Accept();
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
