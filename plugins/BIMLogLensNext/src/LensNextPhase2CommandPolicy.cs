using System;
using System.Collections.Generic;

namespace BIMLogLensNext
{
    public static class LensNextPhase2Commands
    {
        public const string StatusAction = "status";
        public const string CommentAction = "comment";
        public const string AssignmentAction = "assignment";

        public const string UpdateStatus = "phase2-update-status";
        public const string AddComment = "phase2-add-comment";
        public const string UpdateAssignment = "phase2-update-assignment";

        public const string StatusFeatureFlag = "lens_next.status_updates";
        public const string CommentFeatureFlag = "lens_next.comments";
        public const string AssignmentFeatureFlag = "lens_next.platform_metadata_writes";

        public static string ActionForCommand(string command)
        {
            switch (command)
            {
                case UpdateStatus:
                    return StatusAction;
                case AddComment:
                    return CommentAction;
                case UpdateAssignment:
                    return AssignmentAction;
                default:
                    return null;
            }
        }

        public static string CommandForAction(string action)
        {
            switch (action)
            {
                case StatusAction:
                    return UpdateStatus;
                case CommentAction:
                    return AddComment;
                case AssignmentAction:
                    return UpdateAssignment;
                default:
                    return null;
            }
        }

        public static string RequiredFeatureFlag(string command)
        {
            switch (command)
            {
                case UpdateStatus:
                    return StatusFeatureFlag;
                case AddComment:
                    return CommentFeatureFlag;
                case UpdateAssignment:
                    return AssignmentFeatureFlag;
                default:
                    return null;
            }
        }
    }

    public sealed class LensNextPhase2WriteContext
    {
        public string EnvironmentBinding { get; set; }
        public bool EnvironmentBindingValidated { get; set; }
        public string ActiveSessionId { get; set; }
        public string RequestSessionId { get; set; }
        public DateTimeOffset SessionExpiresAt { get; set; }
        public int ActiveProjectId { get; set; }
        public int RequestProjectId { get; set; }
        public string ActiveModelFingerprint { get; set; }
        public string RequestModelFingerprint { get; set; }
    }

    public sealed class LensNextPhase2ImmutableIdentity
    {
        public int ProjectId { get; set; }
        public int ServerId { get; set; }
        public string ViewpointId { get; set; }
        public string IssueFamilyId { get; set; }
        public string LifecycleStatus { get; set; }
        public int RevisionNumber { get; set; }
        public string ExpectedStatus { get; set; }
        public int ExpectedVersion { get; set; }
        public int ExpectedRevisionNumber { get; set; }
    }

    public sealed class LensNextPhase2IdempotencyEvidence
    {
        public string Key { get; set; }
        public string ActorId { get; set; }
        public string Action { get; set; }
        public string Command { get; set; }
        public int ProjectId { get; set; }
        public int ServerId { get; set; }
        public int RevisionNumber { get; set; }
    }

    public sealed class LensNextPhase2WriteCapabilityEvidence
    {
        public string EvidenceId { get; set; }
        public string ReceiptSha256 { get; set; }
        public string ActorId { get; set; }
        public string Action { get; set; }
        public string Command { get; set; }
        public int ProjectId { get; set; }
        public int ServerId { get; set; }
        public string SessionId { get; set; }
        public string ModelFingerprint { get; set; }
        public DateTimeOffset IssuedAt { get; set; }
        public DateTimeOffset ExpiresAt { get; set; }
        public bool Current { get; set; }
        public bool WriteCapabilityGranted { get; set; }
    }

    public sealed class LensNextPhase2PilotPolicyEvidence
    {
        public string ReceiptId { get; set; }
        public string ReceiptSha256 { get; set; }
        public string Environment { get; set; }
        public int ProjectId { get; set; }
        public string PilotActorId { get; set; }
        public string FeatureFlag { get; set; }
        public bool Enabled { get; set; }
        public bool ProductionWriteAllowed { get; set; }
        public DateTimeOffset ExpiresAt { get; set; }
    }

    public sealed class LensNextPhase2CommandRequest
    {
        public string Action { get; set; }
        public string Command { get; set; }
        public string ActorId { get; set; }
        public IReadOnlyDictionary<string, bool> FeatureFlags { get; set; }
        public LensNextPhase2WriteContext Context { get; set; }
        public LensNextPhase2ImmutableIdentity Identity { get; set; }
        public LensNextPhase2IdempotencyEvidence Idempotency { get; set; }
        public LensNextPhase2WriteCapabilityEvidence Capability { get; set; }
        public LensNextPhase2PilotPolicyEvidence PilotPolicy { get; set; }
        public string VisualStateBeforeDigest { get; set; }
        public string VisualStateAfterDigest { get; set; }
        public bool UsesFallbackResolver { get; set; }
        public bool AutoResolveConflict { get; set; }
    }

    public sealed class LensNextPhase2ExecutionRequirements
    {
        public bool AuthenticatedWritePermission { get; internal set; }
        public bool AtomicExpectedVersionAndStatusPredicate { get; internal set; }
        public bool ZeroUpdatedRowsReturn409 { get; internal set; }
        public bool MutationAuditAndIdempotencyReceiptSingleTransaction { get; internal set; }
        public bool ExactResultingIdentityAndVersionResponse { get; internal set; }
        public bool VisualStateDigestMustRemainUnchanged { get; internal set; }
        public bool FallbackResolutionForbidden { get; internal set; }
        public bool AutomaticConflictResolutionForbidden { get; internal set; }

        internal static LensNextPhase2ExecutionRequirements Required()
        {
            return new LensNextPhase2ExecutionRequirements
            {
                AuthenticatedWritePermission = true,
                AtomicExpectedVersionAndStatusPredicate = true,
                ZeroUpdatedRowsReturn409 = true,
                MutationAuditAndIdempotencyReceiptSingleTransaction = true,
                ExactResultingIdentityAndVersionResponse = true,
                VisualStateDigestMustRemainUnchanged = true,
                FallbackResolutionForbidden = true,
                AutomaticConflictResolutionForbidden = true
            };
        }
    }

    public sealed class LensNextPhase2PolicyDecision
    {
        private LensNextPhase2PolicyDecision(
            bool contractReady,
            string code,
            LensNextPhase2ExecutionRequirements executionRequirements)
        {
            ContractReady = contractReady;
            Code = code;
            ExecutionRequirements = executionRequirements;
        }

        public bool ContractReady { get; }
        public bool Allowed { get { return false; } }
        public bool MutationAllowed { get { return false; } }
        public bool AuthorityGranted { get { return false; } }
        public string Code { get; }
        public LensNextPhase2ExecutionRequirements ExecutionRequirements { get; }

        public static LensNextPhase2PolicyDecision ContractReadyHeld()
        {
            return new LensNextPhase2PolicyDecision(
                true,
                "phase2_contract_ready_held",
                LensNextPhase2ExecutionRequirements.Required());
        }

        public static LensNextPhase2PolicyDecision Deny(string code)
        {
            return new LensNextPhase2PolicyDecision(false, code, null);
        }
    }

    public sealed class LensNextPhase2CommandPolicy
    {
        public LensNextPhase2PolicyDecision Evaluate(
            LensNextPhase2CommandRequest request,
            DateTimeOffset evaluatedAt)
        {
            if (request == null)
            {
                return LensNextPhase2PolicyDecision.Deny("request_required");
            }

            var action = LensNextPhase2Commands.ActionForCommand(request.Command);
            if (action == null || !Exact(request.Action, action) ||
                !Exact(LensNextPhase2Commands.CommandForAction(request.Action), request.Command))
            {
                return LensNextPhase2PolicyDecision.Deny("phase2_action_or_command_unsupported");
            }

            var requiredFlag = LensNextPhase2Commands.RequiredFeatureFlag(request.Command);
            bool enabled;
            if (request.FeatureFlags == null ||
                !request.FeatureFlags.TryGetValue(requiredFlag, out enabled) ||
                !enabled)
            {
                return LensNextPhase2PolicyDecision.Deny("separate_feature_flag_disabled");
            }

            var context = request.Context;
            if (context == null || !context.EnvironmentBindingValidated ||
                !IsSandboxOrPilot(context.EnvironmentBinding))
            {
                return LensNextPhase2PolicyDecision.Deny("sandbox_or_pilot_binding_required");
            }
            if (!NonEmpty(context.ActiveSessionId) ||
                !Exact(context.ActiveSessionId, context.RequestSessionId) ||
                context.SessionExpiresAt <= evaluatedAt)
            {
                return LensNextPhase2PolicyDecision.Deny("active_session_context_invalid");
            }
            if (context.ActiveProjectId <= 0 ||
                context.RequestProjectId != context.ActiveProjectId ||
                !NonEmpty(context.ActiveModelFingerprint) ||
                !Exact(context.ActiveModelFingerprint, context.RequestModelFingerprint))
            {
                return LensNextPhase2PolicyDecision.Deny("project_or_model_context_invalid");
            }

            var identity = request.Identity;
            if (identity == null || identity.ProjectId != context.ActiveProjectId ||
                identity.ServerId <= 0 || !NonEmpty(identity.ViewpointId) ||
                !ValidUuid(identity.IssueFamilyId) || !IsLifecycleStatus(identity.LifecycleStatus) ||
                identity.RevisionNumber <= 0 || identity.ExpectedRevisionNumber != identity.RevisionNumber ||
                !ValidStatus(identity.ExpectedStatus) || identity.ExpectedVersion <= 0)
            {
                return LensNextPhase2PolicyDecision.Deny("immutable_identity_or_precondition_invalid");
            }

            if (!ValidUuid(request.ActorId))
            {
                return LensNextPhase2PolicyDecision.Deny("actor_required");
            }

            var idempotency = request.Idempotency;
            var expectedIdempotencyPrefix = request.ActorId + ":" + action + ":" +
                identity.ProjectId + ":" + identity.ServerId + ":" + identity.RevisionNumber + ":";
            if (idempotency == null || !ValidIdempotencyKey(idempotency.Key) ||
                !idempotency.Key.StartsWith(expectedIdempotencyPrefix, StringComparison.Ordinal) ||
                !Exact(idempotency.ActorId, request.ActorId) || !Exact(idempotency.Action, action) ||
                !Exact(idempotency.Command, request.Command) ||
                idempotency.ProjectId != identity.ProjectId || idempotency.ServerId != identity.ServerId ||
                idempotency.RevisionNumber != identity.RevisionNumber)
            {
                return LensNextPhase2PolicyDecision.Deny("actor_scoped_idempotency_invalid");
            }

            var capability = request.Capability;
            if (capability == null || !ValidReceiptId(capability.EvidenceId) ||
                !ValidSha256(capability.ReceiptSha256) || !capability.Current ||
                !capability.WriteCapabilityGranted || capability.IssuedAt > evaluatedAt ||
                capability.ExpiresAt <= evaluatedAt || !Exact(capability.ActorId, request.ActorId) ||
                !Exact(capability.Action, action) || !Exact(capability.Command, request.Command) ||
                capability.ProjectId != identity.ProjectId || capability.ServerId != identity.ServerId ||
                !Exact(capability.SessionId, context.ActiveSessionId) ||
                !Exact(capability.ModelFingerprint, context.ActiveModelFingerprint))
            {
                return LensNextPhase2PolicyDecision.Deny("current_write_capability_evidence_invalid");
            }

            var pilot = request.PilotPolicy;
            if (pilot == null || !ValidReceiptId(pilot.ReceiptId) ||
                !ValidSha256(pilot.ReceiptSha256) ||
                !Exact(pilot.Environment, context.EnvironmentBinding) ||
                !IsSandboxOrPilot(pilot.Environment) || pilot.ProjectId != identity.ProjectId ||
                !Exact(pilot.PilotActorId, request.ActorId) ||
                !Exact(pilot.FeatureFlag, requiredFlag) || !pilot.Enabled ||
                pilot.ProductionWriteAllowed || pilot.ExpiresAt <= evaluatedAt)
            {
                return LensNextPhase2PolicyDecision.Deny("pilot_policy_evidence_invalid");
            }

            if (!NonEmpty(request.VisualStateBeforeDigest) ||
                !Exact(request.VisualStateBeforeDigest, request.VisualStateAfterDigest))
            {
                return LensNextPhase2PolicyDecision.Deny("visual_payload_must_remain_invariant");
            }
            if (request.UsesFallbackResolver)
            {
                return LensNextPhase2PolicyDecision.Deny("fallback_resolution_forbidden");
            }
            if (request.AutoResolveConflict)
            {
                return LensNextPhase2PolicyDecision.Deny("automatic_conflict_resolution_forbidden");
            }

            return LensNextPhase2PolicyDecision.ContractReadyHeld();
        }

        private static bool IsSandboxOrPilot(string value)
        {
            return Exact(value, "sandbox") || Exact(value, "pilot");
        }

        private static bool IsLifecycleStatus(string value)
        {
            return Exact(value, "active") || Exact(value, "superseded") || Exact(value, "voided");
        }

        private static bool ValidUuid(string value)
        {
            Guid parsed;
            return value != null && value.Length == 36 && Guid.TryParseExact(value, "D", out parsed);
        }

        private static bool ValidStatus(string value)
        {
            return NonEmpty(value) && value.Length <= 64 && value.Trim() == value;
        }

        private static bool ValidReceiptId(string value)
        {
            return ValidToken(value, 16, 128);
        }

        private static bool ValidIdempotencyKey(string value)
        {
            return ValidToken(value, 16, 256);
        }

        private static bool ValidToken(string value, int minimum, int maximum)
        {
            if (string.IsNullOrEmpty(value) || value.Length < minimum || value.Length > maximum)
            {
                return false;
            }

            for (var index = 0; index < value.Length; index++)
            {
                var character = value[index];
                if (!(char.IsLetterOrDigit(character) || character == '.' || character == '_' ||
                      character == ':' || character == '-'))
                {
                    return false;
                }
            }

            return true;
        }

        private static bool ValidSha256(string value)
        {
            if (value == null || value.Length != 64)
            {
                return false;
            }

            for (var index = 0; index < value.Length; index++)
            {
                var character = value[index];
                if (!((character >= '0' && character <= '9') ||
                      (character >= 'a' && character <= 'f') ||
                      (character >= 'A' && character <= 'F')))
                {
                    return false;
                }
            }

            return true;
        }

        private static bool NonEmpty(string value)
        {
            return !string.IsNullOrWhiteSpace(value);
        }

        private static bool Exact(string left, string right)
        {
            return string.Equals(left, right, StringComparison.Ordinal);
        }
    }
}
