using System;
using System.Collections.Generic;
using System.Linq;

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
                Run("ui_dispatcher_wraps_native_calls", UiDispatcherWrapsNativeCalls);
                Run("legacy_and_saved_viewpoints_never_touched", LegacyAndSavedViewpointsNeverTouched);
                Run("state_roots_are_isolated", StateRootsAreIsolated);

                Console.WriteLine("PASS " + _passed + "/20");
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
            Equal(4, capabilities.Commands.Count);
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
            Equal("identity_not_found", response.Code);
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
            Equal("identity_not_found", response.Code);
            Equal(0, adapter.OpenCalls);
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

        private static LensNextReadOnlyBridge Bridge(FakeAdapter adapter, RecordingDispatcher dispatcher) =>
            new LensNextReadOnlyBridge(
                Token,
                "session-1",
                DateTimeOffset.UtcNow.AddMinutes(5),
                adapter,
                dispatcher,
                new ImmutableIdentityResolver());

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

        private sealed class FakeAdapter : ILensNextReadOnlyNavisworksAdapter
        {
            public List<WorkingViewCandidate> Candidates { get; } = new List<WorkingViewCandidate>();
            public int FindCalls { get; private set; }
            public int OpenCalls { get; private set; }
            public int LegacyReads { get; private set; }
            public int SavedViewpointWrites { get; private set; }
            public int PlatformWrites { get; private set; }

            public LensNextProjectContext ReadProjectContext() => new LensNextProjectContext
            {
                ProjectId = "1",
                ModelFingerprint = "model-sha256-1",
                DisplayName = "Test model"
            };

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
        }
    }
}
