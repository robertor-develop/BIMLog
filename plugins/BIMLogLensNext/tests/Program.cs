using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Web.Script.Serialization;

namespace BIMLogLensNext.Tests
{
    internal static class Program
    {
        private const string Token = "short-lived-test-session-token";
        private static int _passed;

        private static int Main()
        {
            try
            {
                Run("identifiers_are_isolated", IdentifiersAreIsolated);
                Run("native_registration_provenance_is_exact", NativeRegistrationProvenanceIsExact);
                Run("write_flags_default_off", WriteFlagsDefaultOff);
                Run("only_read_commands_are_exposed", OnlyReadCommandsAreExposed);
                Run("invalid_origin_or_token_blocks", InvalidOriginOrTokenBlocks);
                Run("bridge_collision_never_falls_back_to_legacy_or_alternate_port", BridgeCollisionNeverFallsBack);
                Run("idempotency_mismatch_blocks", IdempotencyMismatchBlocks);
                Run("fallback_fields_block", FallbackFieldsBlock);
                Run("session_context_mismatch_blocks_before_native_read", SessionContextMismatchBlocksBeforeNativeRead);
                Run("invalid_wire_identity_blocks_before_native_read", InvalidWireIdentityBlocksBeforeNativeRead);
                Run("unique_identity_opens_once", UniqueIdentityOpensOnce);
                Run("repeated_exact_open_remains_read_only", RepeatedExactOpenRemainsReadOnly);
                Run("synthetic_document_reopen_requires_new_session", SyntheticDocumentReopenRequiresNewSession);
                Run("success_response_matches_web_contract", SuccessResponseMatchesWebContract);
                Run("project_context_matches_web_contract", ProjectContextMatchesWebContract);
                Run("missing_identity_blocks", MissingIdentityBlocks);
                Run("ambiguous_identity_blocks", AmbiguousIdentityBlocks);
                Run("all_supplied_identity_fields_intersect", AllSuppliedIdentityFieldsIntersect);
                Run("stale_navisworks_guid_blocks_without_exact_fallback", StaleNavisworksGuidBlocksWithoutExactFallback);
                Run("stale_navisworks_guid_uses_explicit_exact_fallback", StaleNavisworksGuidUsesExplicitExactFallback);
                Run("ui_dispatcher_wraps_native_calls", UiDispatcherWrapsNativeCalls);
                Run("legacy_and_saved_viewpoints_never_touched", LegacyAndSavedViewpointsNeverTouched);
                Run("state_roots_are_isolated", StateRootsAreIsolated);
                Run("published_layouts_keep_identity_out_of_folder_structure", PublishedLayoutsKeepIdentityOutOfFolderStructure);
                Run("role_policy_blocks_viewer_resolution", RolePolicyBlocksViewerResolution);
                Run("optimistic_concurrency_detects_version_conflict", OptimisticConcurrencyDetectsVersionConflict);
                Run("m7_publishing_defaults_off", M7PublishingDefaultsOff);
                Run("apply_working_view_allowed_when_viewpoint_publishing_disabled", ApplyWorkingViewAllowedWhenViewpointPublishingDisabled);
                Run("apply_working_view_requires_authoritative_digest", ApplyWorkingViewRequiresAuthoritativeDigest);
                Run("bridge_command_effect_matrix_is_explicit", BridgeCommandEffectMatrixIsExplicit);
                Run("m7_pilot_capabilities_are_explicit", M7PilotCapabilitiesAreExplicit);
                Run("m7_confirmation_is_required", M7ConfirmationIsRequired);
                Run("m7_publish_dispatches_exactly_once", M7PublishDispatchesExactlyOnce);
                Run("new_viewpoint_capture_uses_minimal_navigation_payload", NewViewpointCaptureUsesCanonicalTypedPayload);
                Run("navigation_digest_matches_platform_float_vector", NavigationDigestMatchesPlatformFloatVector);
                Run("visual_state_digest_matches_platform_null_token_contract", VisualStateDigestMatchesPlatformNullTokenContract);
                Run("visual_state_digest_v2_float_tokens_match_platform", VisualStateDigestV2FloatTokensMatchPlatform);
                Run("visual_state_digest_v1_remains_backward_compatible", VisualStateDigestV1RemainsBackwardCompatible);
                Run("visual_state_digest_diagnostics_are_exact_and_non_recursive", VisualStateDigestDiagnosticsAreExactAndNonRecursive);
                Run("visual_state_digest_v3_shared_vectors_A_through_L", VisualStateDigestV3SharedVectorsAThroughL);
                Run("readiness_A_camera_only_opens", ReadinessACameraOnly);
                Run("readiness_B_camera_selection_opens", ReadinessBCameraSelection);
                Run("readiness_C_camera_hidden_opens", ReadinessCCameraHidden);
                Run("readiness_D_camera_appearance_opens", ReadinessDCameraAppearance);
                Run("readiness_E_active_supported_sectioning_opens", ReadinessEActiveSectioning);
                Run("readiness_F_inactive_sectioning_opens", ReadinessFInactiveSectioning);
                Run("readiness_G_empty_selection_is_complete", ReadinessGEmptySelection);
                Run("readiness_H_empty_appearance_is_complete", ReadinessHEmptyAppearance);
                Run("readiness_I_empty_hidden_is_complete", ReadinessIEmptyHidden);
                Run("readiness_J_unsupported_inactive_does_not_block", ReadinessJUnsupportedInactive);
                Run("readiness_K_unsupported_active_names_component", ReadinessKUnsupportedActive);
                Run("readiness_L_truncated_active_names_component", ReadinessLTruncatedActive);
                Run("readiness_M_current_capture_claim_reopens", ReadinessMCurrentCaptureRoundTrip);

                Console.WriteLine("PASS " + _passed + "/" + _passed);
                return 0;
            }
            catch (Exception exception)
            {
                Console.Error.WriteLine("FAIL " + exception.Message);
                return 1;
            }
        }

        private static void IdempotencyMismatchBlocks()
        {
            var request = Request(LensNextBridgeCommands.Ping);
            request.IdempotencyKey = request.RequestId + "-other";
            var response = Bridge(new FakeAdapter(), new RecordingDispatcher()).Execute(request);
            False(response.Success);
            Equal("idempotency_key_mismatch", response.Code);
        }

        private static void IdentifiersAreIsolated()
        {
            Equal("BIMLogLensNext", LensNextConstants.AssemblyName);
            Equal("BIMLogLensNext.dll", LensNextConstants.DllName);
            Equal("BIMLogLensNext.IgniteSmart", LensNextConstants.DockPluginId);
            Equal("BIMLogLensNextButton.IgniteSmart", LensNextConstants.ButtonPluginId);
            Equal("http://127.0.0.1:8766", LensNextConstants.BridgeOrigin);
            NotEqual("BIMLogNavisPlugin", LensNextConstants.AssemblyName);
            NotEqual("BIMLogLens.IgniteSmart", LensNextConstants.DockPluginId);
            NotEqual("BIMLogLensButton.IgniteSmart", LensNextConstants.ButtonPluginId);
            NotEqual("http://localhost:8765", LensNextConstants.BridgeOrigin);
        }


        private static void NativeRegistrationProvenanceIsExact()
        {
            var contract = new PluginRegistrationContract();
            Equal("BIMLogLensNext", contract.CoreAssemblyName);
            Equal("BIMLogLensNext.dll", contract.CoreDllName);
            Equal("BIMLogLensNext.Native2021", contract.NativePluginAssemblyName2021);
            Equal("BIMLogLensNext.Native2021.dll", contract.NativePluginDllName2021);
            Equal("BIMLogLensNext.IgniteSmart", contract.DockPluginId);
            Equal("BIMLogLensNextButton.IgniteSmart", contract.ButtonPluginId);
        }

        private static void WriteFlagsDefaultOff()
        {
            var flags = LensNextFeatureFlags.Phase1ReadOnly();
            Equal(8, flags.Values.Count);
            False(flags.AnyWriteEnabled);
            True(flags.Values.All(pair => pair.Key.StartsWith("lens_next.", StringComparison.Ordinal)));
        }

        private static void OnlyReadCommandsAreExposed()
        {
            var capabilities = new LensNextCapabilities();
            Equal(11, capabilities.Commands.Count);
            True(capabilities.VisualCaptureEnabled);
            True(capabilities.WorkingViewReconstructionEnabled);
            False(capabilities.PlatformVisualWriteEnabled);
            False(capabilities.WritesEnabled);
            False(capabilities.SavedViewpointMutationEnabled);
            False(capabilities.Commands.Any(command => command.IndexOf("write", StringComparison.OrdinalIgnoreCase) >= 0));
            False(capabilities.Commands.Any(command => command.IndexOf("publish", StringComparison.OrdinalIgnoreCase) >= 0));
            False(capabilities.Commands.Any(command => command.IndexOf("migrate", StringComparison.OrdinalIgnoreCase) >= 0));
        }

        private static void InvalidOriginOrTokenBlocks()
        {
            var bridge = Bridge(new FakeAdapter(), new RecordingDispatcher());
            var badOrigin = Request(LensNextBridgeCommands.Ping);
            badOrigin.Origin = "http://localhost:8765";
            False(bridge.Execute(badOrigin).Success);

            var badToken = Request(LensNextBridgeCommands.Ping);
            badToken.SessionToken = "wrong";
            False(bridge.Execute(badToken).Success);

            var write = Request("status-write");
            False(bridge.Execute(write).Success);
        }

        private static void FallbackFieldsBlock()
        {
            var bridge = Bridge(new FakeAdapter(), new RecordingDispatcher());
            foreach (var field in new[] { "label", "displayId", "folderPath", "treePosition", "activeView", "firstMatch", "bestGuess" })
            {
                var request = OpenRequest();
                request.Fields = CopyWith(request.Fields, field, "forbidden");
                var response = bridge.Execute(request);
                False(response.Success);
                Equal("fallback_resolver_forbidden", response.Code);
            }
        }

        private static void SessionContextMismatchBlocksBeforeNativeRead()
        {
            var adapter = new FakeAdapter();
            var dispatcher = new RecordingDispatcher();
            var request = OpenRequest();
            request.Fields = CopyWith(request.Fields, "sessionId", "other-session");
            var response = Bridge(adapter, dispatcher).Execute(request);
            False(response.Success);
            Equal("session_context_mismatch", response.Code);
            Equal(0, adapter.FindCalls);
            Equal(0, adapter.OpenCalls);
            Equal(0, dispatcher.InvokeCalls);
        }

        private static void InvalidWireIdentityBlocksBeforeNativeRead()
        {
            foreach (var invalid in new[]
            {
                new KeyValuePair<string, string>("projectId", "not-a-number"),
                new KeyValuePair<string, string>("serverId", "0"),
                new KeyValuePair<string, string>("revisionNumber", "-1"),
                new KeyValuePair<string, string>("lifecycleStatus", "deleted")
            })
            {
                var adapter = new FakeAdapter();
                var dispatcher = new RecordingDispatcher();
                var request = OpenRequest();
                request.Fields = CopyWith(request.Fields, invalid.Key, invalid.Value);
                var response = Bridge(adapter, dispatcher).Execute(request);
                False(response.Success);
                Equal("identity_invalid", response.Code);
                Equal(0, adapter.FindCalls);
                Equal(0, adapter.OpenCalls);
                Equal(0, dispatcher.InvokeCalls);
            }
        }

        private static void UniqueIdentityOpensOnce()
        {
            var adapter = new FakeAdapter();
            adapter.Candidates.Add(Candidate("physical-1", "nav-guid-1"));
            var bridge = Bridge(adapter, new RecordingDispatcher());
            var response = bridge.Execute(OpenRequest());
            True(response.Success);
            Equal("working_view_opened", response.Code);
            Equal(1, adapter.OpenCalls);
        }

        private static void BridgeCollisionNeverFallsBack()
        {
            var bridge = Bridge(new FakeAdapter(), new RecordingDispatcher());
            foreach (var origin in new[] { "http://localhost:8765", "http://127.0.0.1:8765", "http://127.0.0.1:8767", "http://0.0.0.0:8766" })
            {
                var request = Request(LensNextBridgeCommands.Ping);
                request.Origin = origin;
                var response = bridge.Execute(request);
                False(response.Success);
                Equal("origin_not_approved", response.Code);
            }
            Equal(8766, LensNextConstants.BridgePort);
            Equal("127.0.0.1", LensNextConstants.BridgeHost);
        }

        private static void RepeatedExactOpenRemainsReadOnly()
        {
            var adapter = new FakeAdapter();
            adapter.Candidates.Add(Candidate("physical-1", "nav-guid-1"));
            var bridge = Bridge(adapter, new RecordingDispatcher());
            True(bridge.Execute(OpenRequest()).Success);
            True(bridge.Execute(OpenRequest()).Success);
            Equal(2, adapter.FindCalls);
            Equal(2, adapter.OpenCalls);
            Equal(0, adapter.LegacyReads);
            Equal(0, adapter.SavedViewpointWrites);
            Equal(0, adapter.PlatformWrites);
        }

        private static void SyntheticDocumentReopenRequiresNewSession()
        {
            var closedAdapter = new FakeAdapter();
            closedAdapter.Candidates.Add(Candidate("physical-1", "nav-guid-1"));
            var stale = OpenRequest();
            stale.Fields = CopyWith(stale.Fields, "sessionId", "closed-session");
            var denied = Bridge(closedAdapter, new RecordingDispatcher()).Execute(stale);
            False(denied.Success);
            Equal("session_context_mismatch", denied.Code);
            Equal(0, closedAdapter.FindCalls);
            Equal(0, closedAdapter.OpenCalls);

            var reopenedAdapter = new FakeAdapter();
            reopenedAdapter.Candidates.Add(Candidate("physical-1", "nav-guid-1"));
            True(Bridge(reopenedAdapter, new RecordingDispatcher()).Execute(OpenRequest()).Success);
            Equal(1, reopenedAdapter.FindCalls);
            Equal(1, reopenedAdapter.OpenCalls);
            Equal(0, reopenedAdapter.SavedViewpointWrites);
        }

        private static void SuccessResponseMatchesWebContract()
        {
            var adapter = new FakeAdapter();
            adapter.Candidates.Add(Candidate("physical-1", "nav-guid-1"));
            var request = OpenRequest();
            var response = Bridge(adapter, new RecordingDispatcher()).Execute(request);
            var payload = response.Payload as LensNextOpenWorkingViewPayload;
            True(response.Success);
            True(payload != null);
            True(payload.Opened);
            Equal(request.RequestId, payload.RequestId);
            Equal(1, payload.Identity.ProjectId);
            Equal(101, payload.Identity.ServerId);
            Equal("viewpoint-1", payload.Identity.ViewpointId);
            Equal("active", payload.Identity.LifecycleStatus);
            Equal(2, payload.Identity.RevisionNumber);
        }

        private static void ProjectContextMatchesWebContract()
        {
            var response = Bridge(new FakeAdapter(), new RecordingDispatcher())
                .Execute(Request(LensNextBridgeCommands.ProjectContext));
            var context = response.Payload as LensNextProjectContext;
            True(response.Success);
            True(context != null);
            Equal("session-1", context.SessionId);
            Equal("1", context.ProjectId);
            Equal("model-sha256-1", context.ModelFingerprint);
        }

        private static void MissingIdentityBlocks()
        {
            var adapter = new FakeAdapter();
            var response = Bridge(adapter, new RecordingDispatcher()).Execute(OpenRequest());
            False(response.Success);
            Equal("saved_viewpoint_source_missing", response.Code);
            Equal(0, adapter.OpenCalls);
        }

        private static void AmbiguousIdentityBlocks()
        {
            var adapter = new FakeAdapter();
            adapter.Candidates.Add(Candidate("physical-1", "nav-guid-1"));
            adapter.Candidates.Add(Candidate("physical-1", "nav-guid-1"));
            var response = Bridge(adapter, new RecordingDispatcher()).Execute(OpenRequest());
            False(response.Success);
            Equal("identity_ambiguous", response.Code);
            Equal(0, adapter.OpenCalls);
        }

        private static void AllSuppliedIdentityFieldsIntersect()
        {
            var adapter = new FakeAdapter();
            adapter.Candidates.Add(Candidate("physical-other", "nav-guid-1"));
            var response = Bridge(adapter, new RecordingDispatcher()).Execute(OpenRequest());
            False(response.Success);
            Equal("saved_viewpoint_source_missing", response.Code);
            Equal(0, adapter.OpenCalls);
        }

        private static void StaleNavisworksGuidBlocksWithoutExactFallback()
        {
            var adapter = new FakeAdapter();
            adapter.Candidates.Add(Candidate("physical-1", "nav-guid-current"));
            var response = Bridge(adapter, new RecordingDispatcher()).Execute(OpenRequest());
            False(response.Success);
            Equal("saved_viewpoint_source_missing", response.Code);
            Equal(0, adapter.OpenCalls);
        }

        private static void StaleNavisworksGuidUsesExplicitExactFallback()
        {
            var adapter = new FakeAdapter();
            var candidate = Candidate("physical-1", "nav-guid-current");
            candidate.AllowsStaleNavisworksGuidReplacement = true;
            adapter.Candidates.Add(candidate);
            var response = Bridge(adapter, new RecordingDispatcher()).Execute(OpenRequest());
            True(response.Success);
            Equal(1, adapter.OpenCalls);
        }

        private static void UiDispatcherWrapsNativeCalls()
        {
            var adapter = new FakeAdapter();
            adapter.Candidates.Add(Candidate("physical-1", "nav-guid-1"));
            var dispatcher = new RecordingDispatcher();
            var bridge = Bridge(adapter, dispatcher);
            True(bridge.Execute(OpenRequest()).Success);
            Equal(2, dispatcher.InvokeCalls);
            True(bridge.Execute(Request(LensNextBridgeCommands.ProjectContext)).Success);
            Equal(3, dispatcher.InvokeCalls);
        }

        private static void LegacyAndSavedViewpointsNeverTouched()
        {
            var adapter = new FakeAdapter();
            adapter.Candidates.Add(Candidate("physical-1", "nav-guid-1"));
            var bridge = Bridge(adapter, new RecordingDispatcher());
            bridge.Execute(Request(LensNextBridgeCommands.Ping));
            bridge.Execute(Request(LensNextBridgeCommands.Capabilities));
            bridge.Execute(Request(LensNextBridgeCommands.ProjectContext));
            bridge.Execute(OpenRequest());
            Equal(0, adapter.LegacyReads);
            Equal(0, adapter.SavedViewpointWrites);
            Equal(0, adapter.PlatformWrites);
        }

        private static void StateRootsAreIsolated()
        {
            var state = new LensNextStateContract();
            Equal(@"%LOCALAPPDATA%\BIMLog\LensNext", state.ConfigurationRoot);
            True(state.IsLegacyPath(@"F:\Profiles\Example\AppData\Roaming\BIMLog"));
            True(state.IsLegacyPath(@"F:\Profiles\Example\AppData\Roaming\BIMLog\config.json"));
            True(state.IsLegacyPath(@"f:/profiles/example/appdata/roaming/bimlog/cache/item.json"));
            True(state.IsLegacyPath(@"F:\Profiles\Example\AppData\Roaming\BIMLog\"));
            True(state.IsLegacyPath(@"%APPDATA%\BIMLog"));
            True(state.IsLegacyPath(@"%APPDATA%\BIMLog\config.json"));
            True(state.IsLegacyPath(@"%appdata%/bimlog/cache/item.json"));
            True(state.IsLegacyPath(@"%APPDATA%\BIMLog\"));
            False(state.IsLegacyPath(@"F:\Profiles\Example\AppData\Roaming\BIMLogger"));
            False(state.IsLegacyPath(@"F:\Profiles\Example\AppData\Roaming\BIMLogger\config.json"));
            False(state.IsLegacyPath(@"%APPDATA%\BIMLogger"));
            False(state.IsLegacyPath(@"%APPDATA%\BIMLogger\config.json"));
            False(state.IsLegacyPath(@"F:\Sandbox\BIMLog\LensNext"));
            Equal(@"F:\LocalState\BIMLog\LensNext", state.ResolveConfigurationRoot(@"F:\LocalState"));
        }

        private static void M7PublishingDefaultsOff()
        {
            var adapter = new FakeAdapter();
            var response = Bridge(
                adapter,
                new RecordingDispatcher()
            ).Execute(PublishRequest());

            False(response.Success);
            Equal("viewpoint_publishing_disabled", response.Code);
            Equal(0, adapter.PublishCalls);
            Equal(0, adapter.SavedViewpointWrites);
        }

        private static void ReadinessACameraOnly() => Full(CameraOnly());

        private static void ReadinessBCameraSelection()
        {
            var state = CameraOnly();
            state.SelectedElements.Add(Element("selected-1"));
            state.Completeness.Selection = Component(true, true, true, false, 1, "captured");
            Full(state);
        }

        private static void ReadinessCCameraHidden()
        {
            var state = CameraOnly();
            state.HiddenElements.Add(Element("hidden-1"));
            state.Completeness.Visibility = Component(true, true, true, false, 1, "captured");
            Full(state);
        }

        private static void ReadinessDCameraAppearance()
        {
            var state = CameraOnly();
            state.AppearanceOverrides.Add(new LensNextAppearanceOverride { Element = Element("appearance-1"), Red = 1, Green = 2, Blue = 3 });
            state.Completeness.AppearanceOverrides = Component(true, true, true, false, 1, "captured");
            Full(state);
        }

        private static void ReadinessEActiveSectioning()
        {
            var state = CameraOnly();
            state.SectioningJson = "{\"enabled\":true}";
            state.Completeness.Sectioning = Component(true, true, true, false, 1, "captured");
            Full(state);
        }

        private static void ReadinessFInactiveSectioning() => Full(CameraOnly());
        private static void ReadinessGEmptySelection() => Full(CameraOnly());
        private static void ReadinessHEmptyAppearance() => Full(CameraOnly());
        private static void ReadinessIEmptyHidden() => Full(CameraOnly());

        private static void ReadinessJUnsupportedInactive()
        {
            var state = CameraOnly();
            state.Completeness.Sectioning = Component(false, false, true, false, 0, "inactive");
            Full(state);
        }

        private static void ReadinessKUnsupportedActive()
        {
            var state = CameraOnly();
            state.SectioningJson = "{\"enabled\":true}";
            state.Completeness.Sectioning = Component(false, true, false, false, 1, "unsupported");
            var report = LensNextVisualReadiness.Evaluate(state);
            False(report.CanApplyFullRestore);
            True(report.BlockingDiagnostic.Contains("Component=sectioning"));
            True(report.BlockingDiagnostic.Contains("Supported=false"));
        }

        private static void ReadinessLTruncatedActive()
        {
            var state = CameraOnly();
            state.HiddenElements.Add(Element("hidden-1"));
            state.Completeness.Visibility = Component(true, true, false, true, 5001, "truncated");
            var report = LensNextVisualReadiness.Evaluate(state);
            False(report.CanApplyFullRestore);
            True(report.BlockingDiagnostic.Contains("Component=visibility"));
            True(report.BlockingDiagnostic.Contains("Truncated=true"));
            Throws<InvalidOperationException>(() => LensNextVisualReadiness.EnsureCaptureCanReopen(state));
        }

        private static void ReadinessMCurrentCaptureRoundTrip()
        {
            var state = CameraOnly();
            state.SelectedElements.Add(Element("selected-1"));
            state.HiddenElements.Add(Element("hidden-1"));
            state.AppearanceOverrides.Add(new LensNextAppearanceOverride { Element = Element("appearance-1"), Transparency = 0.5 });
            state.SectioningJson = "{\"enabled\":true}";
            state.Completeness.Selection = Component(true, true, true, false, 1, "captured");
            state.Completeness.Visibility = Component(true, true, true, false, 1, "captured");
            state.Completeness.AppearanceOverrides = Component(true, true, true, false, 1, "captured");
            state.Completeness.Sectioning = Component(true, true, true, false, 1, "captured");
            var before = LensNextVisualStateDigest.Compute(state);
            LensNextVisualReadiness.EnsureCaptureCanReopen(state);
            Full(state);
            state.Completeness.Visibility.Status = "verified-after-roundtrip";
            state.Completeness.Visibility.Message = "Readiness metadata changed without changing authoritative visual content.";
            Equal(before, LensNextVisualStateDigest.Compute(state));
        }

        private static LensNextVisualState CameraOnly()
        {
            return new LensNextVisualState
            {
                Camera = new LensNextCameraState
                {
                    Position = new LensNextPointState { X = 1, Y = 2, Z = 3 },
                    Rotation = new LensNextRotationState { A = 0, B = 0, C = 0, D = 1 },
                    WorldUpVector = new LensNextPointState { X = 0, Y = 1, Z = 0 },
                    Projection = "Perspective"
                },
                Completeness = new LensNextVisualCompleteness
                {
                    Camera = Component(true, true, true, false, null, "captured"),
                    Selection = Component(true, false, true, false, 0, "captured"),
                    Visibility = Component(true, false, true, false, 0, "captured"),
                    AppearanceOverrides = Component(true, false, true, false, 0, "captured"),
                    ModelReferences = Component(true, true, true, false, 0, "captured"),
                    Sectioning = Component(true, false, true, false, 0, "inactive"),
                    Redlines = Component(true, false, true, false, 0, "inactive"),
                    Screenshot = Component(true, false, true, false, 0, "omitted")
                }
            };
        }

        private static LensNextVisualComponentState Component(bool supported, bool active, bool complete, bool truncated, int? count, string status)
        {
            return new LensNextVisualComponentState
            {
                Supported = supported,
                Captured = complete,
                RequiredForReconstruction = active,
                Active = active,
                Complete = complete,
                Truncated = truncated,
                Count = count,
                Status = status,
                Message = status
            };
        }

        private static LensNextElementReference Element(string guid) => new LensNextElementReference { InstanceGuid = guid, ModelSource = "model.nwd" };
        private static void Full(LensNextVisualState state)
        {
            var report = LensNextVisualReadiness.Evaluate(state);
            True(report.CanApplyFullRestore);
            Equal("full", report.Outcome);
        }

        private static void ApplyWorkingViewAllowedWhenViewpointPublishingDisabled()
        {
            var adapter = new FakeAdapter();
            var dispatcher = new RecordingDispatcher();
            var response = Bridge(adapter, dispatcher, false).Execute(ApplyRequest());

            True(response.Success);
            Equal("working_view_applied", response.Code);
            Equal(1, adapter.ApplyCalls);
            Equal(1, dispatcher.InvokeCalls);
            Equal(0, adapter.PublishCalls);
            Equal(0, adapter.SavedViewpointWrites);
        }

        private static void ApplyWorkingViewRequiresAuthoritativeDigest()
        {
            var adapter = new FakeAdapter();
            var dispatcher = new RecordingDispatcher();
            var request = ApplyRequest();
            request.Fields = request.Fields
                .Where(pair => pair.Key != "visualStateDigest")
                .ToDictionary(pair => pair.Key, pair => pair.Value, StringComparer.Ordinal);

            var response = Bridge(adapter, dispatcher, false).Execute(request);

            False(response.Success);
            Equal("visual_state_digest_invalid", response.Code);
            Equal(0, adapter.ApplyCalls);
            Equal(0, dispatcher.InvokeCalls);
        }

        private static void BridgeCommandEffectMatrixIsExplicit()
        {
            True(LensNextBridgeCommands.AllowedWithoutSavedViewpointPublishing.Contains(
                LensNextBridgeCommands.ApplyWorkingView));
            True(LensNextBridgeCommands.TemporaryWorkingStateCommands.Contains(
                LensNextBridgeCommands.ApplyWorkingView));
            False(LensNextBridgeCommands.PersistentSavedViewpointWriteCommands.Contains(
                LensNextBridgeCommands.ApplyWorkingView));
            True(LensNextBridgeCommands.PersistentSavedViewpointWriteCommands.Contains(
                LensNextBridgeCommands.PublishWorkingView));
            False(LensNextBridgeCommands.AllowedWithoutSavedViewpointPublishing.Contains(
                LensNextBridgeCommands.PublishWorkingView));
        }

        private static void M7PilotCapabilitiesAreExplicit()
        {
            var capabilities = new LensNextCapabilities(true);

            Equal("m7_local_pilot", capabilities.Mode);
            Equal(13, capabilities.Commands.Count);
            True(capabilities.Commands.Contains(
                LensNextBridgeCommands.PublishWorkingView
            ));
            True(capabilities.WritesEnabled);
            True(capabilities.SavedViewpointMutationEnabled);
            True(capabilities.ViewpointPublishingEnabled);
            False(capabilities.ProductionWritesEnabled);
            False(capabilities.PlatformVisualWriteEnabled);
        }

        private static void M7ConfirmationIsRequired()
        {
            var adapter = new FakeAdapter();
            var request = PublishRequest();

            request.Fields = request.Fields
                .Where(pair => pair.Key != "confirmationReason")
                .ToDictionary(
                    pair => pair.Key,
                    pair => pair.Value,
                    StringComparer.Ordinal
                );

            var response = Bridge(
                adapter,
                new RecordingDispatcher(),
                true
            ).Execute(request);

            False(response.Success);
            Equal("publish_field_required", response.Code);
            Equal(0, adapter.PublishCalls);
            Equal(0, adapter.SavedViewpointWrites);
        }

        private static void M7PublishDispatchesExactlyOnce()
        {
            var adapter = new FakeAdapter();
            var dispatcher = new RecordingDispatcher();
            var request = PublishRequest();

            var response = Bridge(
                adapter,
                dispatcher,
                true
            ).Execute(request);

            var payload =
                response.Payload as LensNextPublishedViewpointPayload;

            True(response.Success);
            Equal("viewpoint_published", response.Code);
            True(payload != null);
            Equal(request.RequestId, payload.RequestId);
            Equal(1, payload.Identity.ProjectId);
            Equal(101, payload.Identity.ServerId);
            Equal(1, adapter.PublishCalls);
            Equal(1, adapter.SavedViewpointWrites);
            Equal(1, dispatcher.InvokeCalls);
            True(adapter.LastPublishRequest != null);
            Equal(
                "intentional M7 test publish",
                adapter.LastPublishRequest.ConfirmationReason
            );
            Equal(
                new string('a', 64),
                adapter.LastPublishRequest.ExpectedVisualDigest
            );
            False(adapter.LastPublishRequest.UpdateExisting);
        }

        private static LensNextReadOnlyBridge Bridge(
            FakeAdapter adapter,
            RecordingDispatcher dispatcher,
            bool viewpointPublishingEnabled = false) =>
            new LensNextReadOnlyBridge(
                Token,
                "session-1",
                DateTimeOffset.UtcNow.AddMinutes(5),
                adapter,
                dispatcher,
                new ImmutableIdentityResolver(),
                viewpointPublishingEnabled);

        private static LensNextBridgeRequest Request(string command)
        {
            var requestId = Guid.NewGuid().ToString("N");
            return new LensNextBridgeRequest
            {
                ProtocolVersion = LensNextConstants.BridgeProtocolVersion,
                RequestId = requestId,
                IdempotencyKey = requestId,
                SessionToken = Token,
                Origin = LensNextConstants.BridgeOrigin,
                Command = command,
                Fields = new Dictionary<string, string>()
            };
        }

        private static LensNextBridgeRequest OpenRequest()
        {
            var request = Request(LensNextBridgeCommands.OpenWorkingView);
            request.Fields = new Dictionary<string, string>
            {
                ["sessionId"] = "session-1",
                ["projectId"] = "1",
                ["serverId"] = "101",
                ["viewpointId"] = "viewpoint-1",
                ["lifecycleStatus"] = "active",
                ["revisionNumber"] = "2",
                ["modelFingerprint"] = "model-sha256-1",
                ["bimlogPhysicalId"] = "physical-1",
                ["navisworksGuid"] = "nav-guid-1"
            };
            return request;
        }

        private static LensNextBridgeRequest ApplyRequest()
        {
            var request = Request(LensNextBridgeCommands.ApplyWorkingView);
            request.Fields = new Dictionary<string, string>
            {
                ["sessionId"] = "session-1",
                ["projectId"] = "1",
                ["serverId"] = "101",
                ["viewpointId"] = "viewpoint-1",
                ["lifecycleStatus"] = "active",
                ["revisionNumber"] = "2",
                ["modelFingerprint"] = "model-sha256-1",
                ["visualStateJson"] = "{}",
                ["visualStateDigest"] = new string('a', 64)
            };
            return request;
        }

        private static void NewViewpointCaptureUsesCanonicalTypedPayload()
        {
            var request = Request(LensNextBridgeCommands.CaptureNewViewpoint);
            request.Fields = new Dictionary<string, string>
            {
                ["sessionId"] = "session-1",
                ["projectId"] = "1",
                ["viewpointId"] = "viewpoint-new-1",
                ["modelFingerprint"] = "model-sha256-1",
                ["includeScreenshot"] = "false"
            };

            var response = Bridge(new FakeAdapter(), new RecordingDispatcher()).Execute(request);
            True(response.Success);
            Equal("new_viewpoint_captured", response.Code);
            var payload = response.Payload as LensNextNavigationCapturePayload;
            True(payload != null);
            Equal(request.RequestId, payload.RequestId);
            Equal(1, payload.Identity.ProjectId);
            Equal("viewpoint-new-1", payload.Identity.ViewpointId);
            True(payload.NavigationView != null);
            Equal(LensNextNavigationSchema.ContractVersion, payload.NavigationView.ContractVersion);
            True(payload.NavigationView.Camera != null);
            Equal(0, payload.NavigationView.SelectedElements.Count);
        }

        private static void VisualStateDigestMatchesPlatformNullTokenContract()
        {
            var state = new LensNextVisualState
            {
                ProjectId = 28,
                ServerId = 1,
                ViewpointId = "local-viewpoint-1",
                LifecycleStatus = "active",
                RevisionNumber = 1,
                ModelFingerprint = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                Camera = null,
                SectioningJson = null,
                RedlinesJson = null,
                ScreenshotSha256 = null
            };

            Equal(
                "a2f9dae5c4bfb18073d72775318fdd2d70c1a24bdbafbfc9b3df5f7d2fc4407a",
                LensNextVisualStateDigest.Compute(state));
        }

        private static void VisualStateDigestV2FloatTokensMatchPlatform()
        {
            var state = NumericDigestState("local-viewpoint-v2");

            Equal(
                "55bad86cd7f9d4fb5f935b8b8aef597348322a15fd4f439557af357dc55ff918",
                LensNextVisualStateDigest.Compute(state));
        }

        private static void VisualStateDigestV1RemainsBackwardCompatible()
        {
            var state = NumericDigestState("local-viewpoint-numeric");
            state.DigestDiagnostics = new LensNextDigestDiagnostics
            {
                ContractVersion = LensNextVisualStateDigest.LegacyContractVersion
            };

            Equal(
                "ab7839da83846b1d0d76d03215a958c5cb76045e65ddcdf22e29cf04ae959023",
                LensNextVisualStateDigest.Compute(state));
        }

        private static LensNextVisualState NumericDigestState(string viewpointId)
        {
            return new LensNextVisualState
            {
                ProjectId = 28,
                ServerId = 1,
                ViewpointId = viewpointId,
                LifecycleStatus = "active",
                RevisionNumber = 1,
                ModelFingerprint = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                Camera = new LensNextCameraState
                {
                    Position = new LensNextPointState { X = 370.12345678901235d, Y = -42.125d, Z = -0d },
                    Rotation = new LensNextRotationState { A = 0d, B = 0d, C = 0d, D = 1d },
                    WorldUpVector = new LensNextPointState { X = 0d, Y = 1d, Z = 0d },
                    Projection = "Perspective",
                    FocalDistance = 250.5d,
                    HorizontalExtentAtFocalDistance = 400.25d,
                    VerticalExtentAtFocalDistance = 300.125d
                }
            };
        }

        private static void VisualStateDigestDiagnosticsAreExactAndNonRecursive()
        {
            var state = new LensNextVisualState
            {
                ProjectId = 28,
                ServerId = 1,
                ViewpointId = "local-viewpoint-1",
                LifecycleStatus = "active",
                RevisionNumber = 1,
                ModelFingerprint = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
            };
            var diagnostics = LensNextVisualStateDigest.Diagnose(state, true);
            Equal("SHA-256", diagnostics.Algorithm);
            Equal("lens-next-visual-digest.v2", diagnostics.ContractVersion);
            Equal(LensNextVisualStateDigest.Compute(state), diagnostics.ComputedDigest);
            True(diagnostics.Truncated);
            True(diagnostics.CanonicalLength > 0);
            True(Convert.FromBase64String(diagnostics.CanonicalInputBase64).Length > 0);
            state.DigestDiagnostics = diagnostics;
            Equal(diagnostics.ComputedDigest, LensNextVisualStateDigest.Compute(state));
        }

        private static void NavigationDigestMatchesPlatformFloatVector()
        {
            var navigation = new LensNextNavigationView
            {
                ContractVersion = LensNextNavigationSchema.ContractVersion,
                SchemaVersion = LensNextNavigationSchema.Version,
                ProjectId = 29,
                ServerId = 1,
                ViewpointId = "local-nav-1",
                LifecycleStatus = "active",
                RevisionNumber = 1,
                ModelFingerprint = string.Concat(Enumerable.Repeat("0123456789abcdef", 4)),
                Camera = NumericDigestState("ignored").Camera,
                SectioningJson = null,
                SelectedElements = new List<LensNextElementReference>()
            };
            Equal("d4618c4ba468325bd41de8284c3e75f40a63d76af8d4cf367c961a5e03a58b27", LensNextNavigationDigest.Compute(navigation));
            navigation.ScreenshotDataUrl = "data:image/jpeg;base64,AAAA";
            navigation.ScreenshotSha256 = new string('f', 64);
            Equal("d4618c4ba468325bd41de8284c3e75f40a63d76af8d4cf367c961a5e03a58b27", LensNextNavigationDigest.Compute(navigation));
        }

        private static void VisualStateDigestV3SharedVectorsAThroughL()
        {
            var path = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "lens-next-visual-digest-v3-vectors.json");
            var fixture = new JavaScriptSerializer { MaxJsonLength = 16 * 1024 * 1024 }
                .Deserialize<DigestVectorFixture>(File.ReadAllText(path, Encoding.UTF8));
            Equal(LensNextVisualStateDigest.ContractVersionV3, fixture.ContractVersion);
            Equal(10, fixture.Vectors.Count);
            Equal(2, fixture.TamperCases.Count);
            foreach (var vector in fixture.Vectors)
            {
                var diagnostics = LensNextVisualStateDigest.Diagnose(vector.State, vector.State.DigestDiagnostics != null && vector.State.DigestDiagnostics.Truncated);
                Equal(vector.CanonicalInputBase64, diagnostics.CanonicalInputBase64);
                Equal(vector.CanonicalByteLength, diagnostics.CanonicalLength);
                Equal(vector.Sha256, diagnostics.ComputedDigest);
            }

            var serializer = new JavaScriptSerializer { MaxJsonLength = 16 * 1024 * 1024 };
            foreach (var tamper in fixture.TamperCases)
            {
                var source = fixture.Vectors.First(value => value.Id == tamper.SourceVector);
                var state = serializer.Deserialize<LensNextVisualState>(serializer.Serialize(source.State));
                if (tamper.Id == "K") state.SelectedElements[0].Model.ModelInstanceDiscriminator = tamper.MutationValue;
                else if (tamper.Id == "L") state.ModelReferences[0].TransformFingerprint = tamper.MutationValue;
                else throw new InvalidOperationException("Unknown tamper vector " + tamper.Id + ".");
                Equal(tamper.OriginalSha256, source.Sha256);
                Equal(tamper.TamperedSha256, LensNextVisualStateDigest.Compute(state));
                NotEqual(tamper.OriginalSha256, tamper.TamperedSha256);
            }
        }

        private sealed class DigestVectorFixture
        {
            public string ContractVersion { get; set; }
            public List<DigestVector> Vectors { get; set; }
            public List<DigestTamperCase> TamperCases { get; set; }
        }

        private sealed class DigestVector
        {
            public string Id { get; set; }
            public LensNextVisualState State { get; set; }
            public string CanonicalInputBase64 { get; set; }
            public int CanonicalByteLength { get; set; }
            public string Sha256 { get; set; }
        }

        private sealed class DigestTamperCase
        {
            public string Id { get; set; }
            public string SourceVector { get; set; }
            public string MutationValue { get; set; }
            public string OriginalSha256 { get; set; }
            public string TamperedSha256 { get; set; }
        }
        private static LensNextBridgeRequest PublishRequest()
        {
            var request = Request(
                LensNextBridgeCommands.PublishWorkingView
            );

            request.Fields = new Dictionary<string, string>
            {
                ["sessionId"] = "session-1",
                ["projectId"] = "1",
                ["serverId"] = "101",
                ["viewpointId"] = "viewpoint-1",
                ["lifecycleStatus"] = "active",
                ["revisionNumber"] = "2",
                ["modelFingerprint"] = new string('b', 64),
                ["displayName"] = "BIMLog Viewpoint 101",
                ["confirmationReason"] =
                    "intentional M7 test publish",
                ["operationId"] =
                    "m7-test-operation-0000000000000001",
                ["expectedVisualDigest"] = new string('a', 64),
                ["updateExisting"] = "false"
            };

            return request;
        }

        private static WorkingViewCandidate Candidate(string physicalId, string navisworksGuid) => new WorkingViewCandidate
        {
            ProjectId = "1",
            ServerId = "101",
            ViewpointId = "viewpoint-1",
            LifecycleStatus = "active",
            RevisionNumber = "2",
            ModelFingerprint = "model-sha256-1",
            BimlogPhysicalId = physicalId,
            NavisworksGuid = navisworksGuid,
            NativeHandle = new object()
        };

        private static IReadOnlyDictionary<string, string> CopyWith(
            IReadOnlyDictionary<string, string> source,
            string key,
            string value)
        {
            var result = source.ToDictionary(pair => pair.Key, pair => pair.Value, StringComparer.Ordinal);
            result[key] = value;
            return result;
        }

        private static void PublishedLayoutsKeepIdentityOutOfFolderStructure()
        {
            var descriptor = new LensNextPublishedViewDescriptor { Status = "Open", Floor = "L10", Trade = "PL", ResponsibleCompany = "ABC" };
            var plan = LensNextPublishedLayoutPlanner.Plan(descriptor, LensNextPublishedLayoutPreset.FloorTradeCompany);
            Equal("BIMLog Lens Next Published/L10/PL/ABC", plan.FullPath);
            False(plan.FullPath.Contains("serverId"));
        }

        private static void RolePolicyBlocksViewerResolution()
        {
            False(LensNextRolePolicy.Can(LensNextRole.Viewer, LensNextPermission.Resolve));
            True(LensNextRolePolicy.Can(LensNextRole.LeadCoordinator, LensNextPermission.Resolve));
        }

        private static void OptimisticConcurrencyDetectsVersionConflict()
        {
            var expected = new LensNextConcurrencyPrecondition { ProjectId = 26, ServerId = 101, Version = 4, RevisionNumber = 2, ModelFingerprint = new string('a', 64) };
            var current = new LensNextConcurrencyPrecondition { ProjectId = 26, ServerId = 101, Version = 5, RevisionNumber = 2, ModelFingerprint = new string('a', 64) };
            Equal("VERSION_CONFLICT", LensNextConcurrencyPolicy.Evaluate(expected, current));
        }

        private static void Run(string name, Action test)
        {
            test();
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

        private static void Throws<T>(Action action) where T : Exception
        {
            try { action(); }
            catch (T) { return; }
            throw new InvalidOperationException("Expected " + typeof(T).Name + ".");
        }

        private static void NotEqual<T>(T left, T right)
        {
            if (EqualityComparer<T>.Default.Equals(left, right))
            {
                throw new InvalidOperationException("Values must differ: " + left + ".");
            }
        }

        private sealed class RecordingDispatcher : INavisworksUiThreadDispatcher
        {
            public int InvokeCalls { get; private set; }

            public T Invoke<T>(Func<T> action)
            {
                InvokeCalls++;
                return action();
            }
        }

        private sealed class FakeAdapter :
            ILensNextReadOnlyNavisworksAdapter,
            ILensNextPublishNavisworksAdapter,
            ILensNextVisualNavisworksAdapter
        {
            public List<WorkingViewCandidate> Candidates { get; } = new List<WorkingViewCandidate>();
            public int FindCalls { get; private set; }
            public int OpenCalls { get; private set; }
            public int LegacyReads { get; private set; }
            public int SavedViewpointWrites { get; private set; }
            public int PlatformWrites { get; private set; }
            public int PublishCalls { get; private set; }
            public int ApplyCalls { get; private set; }
            public LensNextPublishRequest LastPublishRequest {
                get;
                private set;
            }

            public LensNextProjectContext ReadProjectContext() => new LensNextProjectContext
            {
                ProjectId = "1",
                ModelFingerprint = "model-sha256-1",
                DisplayName = "Test model"
            };

            public LensNextProjectContext BindProject(string projectId, string bindingSource) => new LensNextProjectContext
            {
                ProjectId = projectId,
                ModelFingerprint = "model-sha256-1",
                ModelBindingKey = "test-model",
                BindingSource = bindingSource,
                DisplayName = "Test model"
            };

            public LensNextLocalInventory ReadLocalInventory() => new LensNextLocalInventory
            {
                ProjectId = "1",
                ModelFingerprint = "model-sha256-1",
                Viewpoints = Array.AsReadOnly(new LensNextLocalViewpoint[0])
            };

            public LensNextLocalViewpoint OpenExactManagedLocalViewpoint(string projectId, string navisworksGuid)
            {
                return null;
            }

            public IReadOnlyCollection<WorkingViewCandidate> FindExistingWorkingViews(
                ImmutableWorkingViewIdentity identity)
            {
                FindCalls++;
                return Candidates;
            }

            public bool OpenExistingWorkingView(WorkingViewCandidate candidate)
            {
                OpenCalls++;
                return true;
            }

            public LensNextPublishResult PublishCurrentWorkingView(
                LensNextPublishRequest request)
            {
                PublishCalls++;
                SavedViewpointWrites++;
                LastPublishRequest = request;

                return new LensNextPublishResult
                {
                    Published = true,
                    UpdatedExisting = request.UpdateExisting,
                    NavisworksGuid =
                        "11111111-1111-1111-1111-111111111111",
                    DisplayName = request.DisplayName,
                    Message = "M7 test publish completed."
                };
            }

            public LensNextVisualState CaptureCurrentVisualState(
                ImmutableWorkingViewIdentity identity,
                bool includeScreenshot)
            {
                return new LensNextVisualState
                {
                    ProjectId = int.Parse(identity.ProjectId),
                    ServerId = int.Parse(identity.ServerId),
                    ViewpointId = identity.ViewpointId,
                    LifecycleStatus = identity.LifecycleStatus,
                    RevisionNumber = int.Parse(identity.RevisionNumber),
                    ModelFingerprint = identity.ModelFingerprint,
                    CapturedAt = DateTimeOffset.UtcNow.ToString("o"),
                    CaptureSource = "test"
                };
            }

            public LensNextNavigationView CaptureCurrentNavigationView(
                ImmutableWorkingViewIdentity identity,
                bool includeScreenshot)
            {
                var value = new LensNextNavigationView
                {
                    ContractVersion = LensNextNavigationSchema.ContractVersion,
                    SchemaVersion = LensNextNavigationSchema.Version,
                    ProjectId = int.Parse(identity.ProjectId),
                    ServerId = int.Parse(identity.ServerId),
                    ViewpointId = identity.ViewpointId,
                    LifecycleStatus = identity.LifecycleStatus,
                    RevisionNumber = int.Parse(identity.RevisionNumber),
                    ModelFingerprint = identity.ModelFingerprint,
                    Camera = NumericDigestState(identity.ViewpointId).Camera
                };
                value.DigestSha256 = LensNextNavigationDigest.Compute(value);
                return value;
            }

            public LensNextNavigationApplyResult ApplyNavigationViewJson(
                ImmutableWorkingViewIdentity identity,
                string navigationJson,
                string storedDigest,
                string operationId)
            {
                ApplyCalls++;
                return new LensNextNavigationApplyResult { Applied = true };
            }

            public LensNextVisualApplyResult ApplyWorkingVisualStateJson(
                ImmutableWorkingViewIdentity identity,
                string visualStateJson,
                string storedVisualStateDigest,
                string operationId)
            {
                ApplyCalls++;
                return new LensNextVisualApplyResult { Applied = true };
            }        }
    }
}
