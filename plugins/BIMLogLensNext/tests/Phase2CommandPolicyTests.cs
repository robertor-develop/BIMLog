using System;
using System.Collections.Generic;

namespace BIMLogLensNext.Tests
{
    public static class Phase2CommandPolicyTests
    {
        private static readonly DateTimeOffset Now =
            new DateTimeOffset(2026, 8, 12, 20, 30, 0, TimeSpan.Zero);
        private const string ActorId = "11111111-1111-4111-8111-111111111111";
        private const string IssueFamilyId = "44444444-4444-4444-8444-444444444444";
        private static int _passed;

#if PHASE2_POLICY_STANDALONE
        public static int Main()
        {
            try
            {
                Run("status_contract_ready_but_held", () => ContractReadyHeld(LensNextPhase2Commands.UpdateStatus));
                Run("comment_contract_ready_but_held", () => ContractReadyHeld(LensNextPhase2Commands.AddComment));
                Run("assignment_contract_ready_but_held", () => ContractReadyHeld(LensNextPhase2Commands.UpdateAssignment));
                Run("action_command_translation_is_closed", TranslationIsClosed);
                Run("canonical_flags_and_wrong_flag_denial", CanonicalFlagsAndWrongFlagDenial);
                Run("production_or_unvalidated_environment_denies", EnvironmentBindingDenies);
                Run("inactive_or_mismatched_session_denies", SessionDenies);
                Run("project_or_model_mismatch_denies", ProjectOrModelDenies);
                Run("identity_and_preconditions_are_exact", IdentityAndPreconditionDenies);
                Run("actor_action_project_server_revision_idempotency", IdempotencyDenies);
                Run("current_receipted_capability_is_required", CapabilityDenies);
                Run("receipted_pilot_policy_is_required", PilotPolicyDenies);
                Run("execution_requirements_are_explicit", ExecutionRequirementsAreExplicit);
                Run("visual_payload_change_denies_all_commands", VisualInvariantDenies);
                Run("fallback_and_auto_resolution_deny", ResolverDenies);
                Run("unsupported_and_phase1_commands_deny", UnsupportedCommandsDeny);
                Run("evaluation_is_deterministic_pure_and_non_authorizing", DeterministicAndPure);
                Console.WriteLine("PASS " + _passed + "/17");
                return 0;
            }
            catch (Exception exception)
            {
                Console.Error.WriteLine("FAIL " + exception.Message);
                return 1;
            }
        }
#endif

        private static void ContractReadyHeld(string command)
        {
            var decision = Evaluate(Valid(command));
            True(decision.ContractReady);
            False(decision.Allowed);
            False(decision.MutationAllowed);
            False(decision.AuthorityGranted);
            Equal("phase2_contract_ready_held", decision.Code);
        }

        private static void TranslationIsClosed()
        {
            Equal(LensNextPhase2Commands.StatusAction,
                LensNextPhase2Commands.ActionForCommand(LensNextPhase2Commands.UpdateStatus));
            Equal(LensNextPhase2Commands.CommentAction,
                LensNextPhase2Commands.ActionForCommand(LensNextPhase2Commands.AddComment));
            Equal(LensNextPhase2Commands.AssignmentAction,
                LensNextPhase2Commands.ActionForCommand(LensNextPhase2Commands.UpdateAssignment));
            Equal(LensNextPhase2Commands.UpdateStatus,
                LensNextPhase2Commands.CommandForAction(LensNextPhase2Commands.StatusAction));
            Equal(LensNextPhase2Commands.AddComment,
                LensNextPhase2Commands.CommandForAction(LensNextPhase2Commands.CommentAction));
            Equal(LensNextPhase2Commands.UpdateAssignment,
                LensNextPhase2Commands.CommandForAction(LensNextPhase2Commands.AssignmentAction));

            var mismatch = Valid(LensNextPhase2Commands.UpdateStatus);
            mismatch.Action = LensNextPhase2Commands.CommentAction;
            Denied(mismatch, "phase2_action_or_command_unsupported");
        }

        private static void CanonicalFlagsAndWrongFlagDenial()
        {
            Equal("lens_next.status_updates", LensNextPhase2Commands.StatusFeatureFlag);
            Equal("lens_next.comments", LensNextPhase2Commands.CommentFeatureFlag);
            Equal("lens_next.platform_metadata_writes", LensNextPhase2Commands.AssignmentFeatureFlag);

            var disabled = Valid(LensNextPhase2Commands.UpdateStatus);
            disabled.FeatureFlags = new Dictionary<string, bool>
            {
                [LensNextPhase2Commands.StatusFeatureFlag] = false
            };
            Denied(disabled, "separate_feature_flag_disabled");

            var wrong = Valid(LensNextPhase2Commands.UpdateAssignment);
            wrong.FeatureFlags = new Dictionary<string, bool>
            {
                [LensNextPhase2Commands.StatusFeatureFlag] = true
            };
            Denied(wrong, "separate_feature_flag_disabled");
        }

        private static void EnvironmentBindingDenies()
        {
            var production = Valid(LensNextPhase2Commands.AddComment);
            production.Context.EnvironmentBinding = "production";
            Denied(production, "sandbox_or_pilot_binding_required");

            var unvalidated = Valid(LensNextPhase2Commands.AddComment);
            unvalidated.Context.EnvironmentBindingValidated = false;
            Denied(unvalidated, "sandbox_or_pilot_binding_required");
        }

        private static void SessionDenies()
        {
            var mismatch = Valid(LensNextPhase2Commands.UpdateStatus);
            mismatch.Context.RequestSessionId = "other-session";
            Denied(mismatch, "active_session_context_invalid");

            var expired = Valid(LensNextPhase2Commands.UpdateStatus);
            expired.Context.SessionExpiresAt = Now;
            Denied(expired, "active_session_context_invalid");
        }

        private static void ProjectOrModelDenies()
        {
            var project = Valid(LensNextPhase2Commands.UpdateAssignment);
            project.Context.RequestProjectId = 8;
            Denied(project, "project_or_model_context_invalid");

            var model = Valid(LensNextPhase2Commands.UpdateAssignment);
            model.Context.RequestModelFingerprint = "other-model";
            Denied(model, "project_or_model_context_invalid");
        }

        private static void IdentityAndPreconditionDenies()
        {
            var stale = Valid(LensNextPhase2Commands.UpdateStatus);
            stale.Identity.ExpectedRevisionNumber = 6;
            Denied(stale, "immutable_identity_or_precondition_invalid");

            var family = Valid(LensNextPhase2Commands.UpdateStatus);
            family.Identity.IssueFamilyId = "not-a-uuid";
            Denied(family, "immutable_identity_or_precondition_invalid");

            var status = Valid(LensNextPhase2Commands.UpdateStatus);
            status.Identity.ExpectedStatus = " ";
            Denied(status, "immutable_identity_or_precondition_invalid");

            var version = Valid(LensNextPhase2Commands.UpdateStatus);
            version.Identity.ExpectedVersion = 0;
            Denied(version, "immutable_identity_or_precondition_invalid");
        }

        private static void IdempotencyDenies()
        {
            var actor = Valid(LensNextPhase2Commands.AddComment);
            actor.Idempotency.ActorId = "22222222-2222-4222-8222-222222222222";
            Denied(actor, "actor_scoped_idempotency_invalid");

            var weakKey = Valid(LensNextPhase2Commands.AddComment);
            weakKey.Idempotency.Key = ActorId + ":request-00000001";
            Denied(weakKey, "actor_scoped_idempotency_invalid");

            var revision = Valid(LensNextPhase2Commands.AddComment);
            revision.Idempotency.RevisionNumber = 3;
            Denied(revision, "actor_scoped_idempotency_invalid");
        }

        private static void CapabilityDenies()
        {
            var expired = Valid(LensNextPhase2Commands.UpdateAssignment);
            expired.Capability.ExpiresAt = Now;
            Denied(expired, "current_write_capability_evidence_invalid");

            var receipt = Valid(LensNextPhase2Commands.UpdateAssignment);
            receipt.Capability.ReceiptSha256 = "bad";
            Denied(receipt, "current_write_capability_evidence_invalid");

            var server = Valid(LensNextPhase2Commands.UpdateAssignment);
            server.Capability.ServerId = 102;
            Denied(server, "current_write_capability_evidence_invalid");

            var notCurrent = Valid(LensNextPhase2Commands.UpdateAssignment);
            notCurrent.Capability.Current = false;
            Denied(notCurrent, "current_write_capability_evidence_invalid");
        }

        private static void PilotPolicyDenies()
        {
            var wrongFlag = Valid(LensNextPhase2Commands.UpdateAssignment);
            wrongFlag.PilotPolicy.FeatureFlag = LensNextPhase2Commands.StatusFeatureFlag;
            Denied(wrongFlag, "pilot_policy_evidence_invalid");

            var production = Valid(LensNextPhase2Commands.UpdateAssignment);
            production.PilotPolicy.ProductionWriteAllowed = true;
            Denied(production, "pilot_policy_evidence_invalid");

            var receipt = Valid(LensNextPhase2Commands.UpdateAssignment);
            receipt.PilotPolicy.ReceiptSha256 = "bad";
            Denied(receipt, "pilot_policy_evidence_invalid");

            var expired = Valid(LensNextPhase2Commands.UpdateAssignment);
            expired.PilotPolicy.ExpiresAt = Now;
            Denied(expired, "pilot_policy_evidence_invalid");
        }

        private static void ExecutionRequirementsAreExplicit()
        {
            var decision = Evaluate(Valid(LensNextPhase2Commands.UpdateStatus));
            var requirements = decision.ExecutionRequirements;
            True(requirements != null);
            True(requirements.AuthenticatedWritePermission);
            True(requirements.AtomicExpectedVersionAndStatusPredicate);
            True(requirements.ZeroUpdatedRowsReturn409);
            True(requirements.MutationAuditAndIdempotencyReceiptSingleTransaction);
            True(requirements.ExactResultingIdentityAndVersionResponse);
            True(requirements.VisualStateDigestMustRemainUnchanged);
            True(requirements.FallbackResolutionForbidden);
            True(requirements.AutomaticConflictResolutionForbidden);
        }

        private static void VisualInvariantDenies()
        {
            foreach (var command in Commands())
            {
                var request = Valid(command);
                request.VisualStateAfterDigest = "visual-sha256-changed";
                Denied(request, "visual_payload_must_remain_invariant");
            }
        }

        private static void ResolverDenies()
        {
            var fallback = Valid(LensNextPhase2Commands.UpdateStatus);
            fallback.UsesFallbackResolver = true;
            Denied(fallback, "fallback_resolution_forbidden");

            var conflict = Valid(LensNextPhase2Commands.AddComment);
            conflict.AutoResolveConflict = true;
            Denied(conflict, "automatic_conflict_resolution_forbidden");
        }

        private static void UnsupportedCommandsDeny()
        {
            foreach (var command in new[] { "open-working-view", "ping", "publish", "migrate", "status-write" })
            {
                var request = Valid(LensNextPhase2Commands.UpdateStatus);
                request.Command = command;
                Denied(request, "phase2_action_or_command_unsupported");
            }
        }

        private static void DeterministicAndPure()
        {
            var request = Valid(LensNextPhase2Commands.UpdateStatus);
            var first = Evaluate(request);
            var second = Evaluate(request);
            True(first.ContractReady);
            False(first.Allowed);
            False(first.MutationAllowed);
            False(first.AuthorityGranted);
            Equal(first.Code, second.Code);
            Equal("visual-sha256-unchanged", request.VisualStateBeforeDigest);
            Equal("visual-sha256-unchanged", request.VisualStateAfterDigest);
            Equal(5, request.Identity.RevisionNumber);
        }

        private static LensNextPhase2CommandRequest Valid(string command)
        {
            var action = LensNextPhase2Commands.ActionForCommand(command);
            var requiredFlag = LensNextPhase2Commands.RequiredFeatureFlag(command);
            return new LensNextPhase2CommandRequest
            {
                Action = action,
                Command = command,
                ActorId = ActorId,
                FeatureFlags = new Dictionary<string, bool> { [requiredFlag] = true },
                Context = new LensNextPhase2WriteContext
                {
                    EnvironmentBinding = "sandbox",
                    EnvironmentBindingValidated = true,
                    ActiveSessionId = "session-9",
                    RequestSessionId = "session-9",
                    SessionExpiresAt = Now.AddMinutes(10),
                    ActiveProjectId = 7,
                    RequestProjectId = 7,
                    ActiveModelFingerprint = "model-sha256-7",
                    RequestModelFingerprint = "model-sha256-7"
                },
                Identity = new LensNextPhase2ImmutableIdentity
                {
                    ProjectId = 7,
                    ServerId = 101,
                    ViewpointId = "viewpoint-immutable-101",
                    IssueFamilyId = IssueFamilyId,
                    LifecycleStatus = "active",
                    RevisionNumber = 5,
                    ExpectedStatus = "Open",
                    ExpectedVersion = 12,
                    ExpectedRevisionNumber = 5
                },
                Idempotency = new LensNextPhase2IdempotencyEvidence
                {
                    Key = ActorId + ":" + action + ":7:101:5:request-00000001",
                    ActorId = ActorId,
                    Action = action,
                    Command = command,
                    ProjectId = 7,
                    ServerId = 101,
                    RevisionNumber = 5
                },
                Capability = new LensNextPhase2WriteCapabilityEvidence
                {
                    EvidenceId = "capability-receipt-101",
                    ReceiptSha256 = new string('a', 64),
                    ActorId = ActorId,
                    Action = action,
                    Command = command,
                    ProjectId = 7,
                    ServerId = 101,
                    SessionId = "session-9",
                    ModelFingerprint = "model-sha256-7",
                    IssuedAt = Now.AddMinutes(-1),
                    ExpiresAt = Now.AddMinutes(4),
                    Current = true,
                    WriteCapabilityGranted = true
                },
                PilotPolicy = new LensNextPhase2PilotPolicyEvidence
                {
                    ReceiptId = "pilot-policy-receipt-01",
                    ReceiptSha256 = new string('b', 64),
                    Environment = "sandbox",
                    ProjectId = 7,
                    PilotActorId = ActorId,
                    FeatureFlag = requiredFlag,
                    Enabled = true,
                    ProductionWriteAllowed = false,
                    ExpiresAt = Now.AddMinutes(4)
                },
                VisualStateBeforeDigest = "visual-sha256-unchanged",
                VisualStateAfterDigest = "visual-sha256-unchanged",
                UsesFallbackResolver = false,
                AutoResolveConflict = false
            };
        }

        private static IEnumerable<string> Commands()
        {
            yield return LensNextPhase2Commands.UpdateStatus;
            yield return LensNextPhase2Commands.AddComment;
            yield return LensNextPhase2Commands.UpdateAssignment;
        }

        private static LensNextPhase2PolicyDecision Evaluate(LensNextPhase2CommandRequest request)
        {
            return new LensNextPhase2CommandPolicy().Evaluate(request, Now);
        }

        private static void Denied(LensNextPhase2CommandRequest request, string code)
        {
            var decision = Evaluate(request);
            False(decision.ContractReady);
            False(decision.Allowed);
            False(decision.MutationAllowed);
            False(decision.AuthorityGranted);
            True(decision.ExecutionRequirements == null);
            Equal(code, decision.Code);
        }

        private static void Run(string name, Action action)
        {
            action();
            _passed++;
            Console.WriteLine("PASS " + name);
        }

        private static void True(bool value)
        {
            if (!value) throw new InvalidOperationException("Expected true.");
        }

        private static void False(bool value)
        {
            if (value) throw new InvalidOperationException("Expected false.");
        }

        private static void Equal<T>(T expected, T actual)
        {
            if (!EqualityComparer<T>.Default.Equals(expected, actual))
            {
                throw new InvalidOperationException("Expected " + expected + ", received " + actual + ".");
            }
        }
    }
}
