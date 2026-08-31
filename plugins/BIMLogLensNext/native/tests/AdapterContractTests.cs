using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Reflection;
using System.Web.Script.Serialization;
using BIMLogLensNext;

namespace BIMLogLensNext.Native.Tests
{
    internal static class AdapterContractTests
    {
        private const string Fingerprint = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        private static int _passed;

        private static int Main()
        {
            try
            {
                Run("product_year_is_exact", () => Equal(ExpectedProductYear.Value, NativeReferenceBinding.ProductYear));
                Run("sdk_version_is_bound", () => True(!string.IsNullOrWhiteSpace(NativeReferenceBinding.NavisworksApiAssemblyVersion)));
                Run("contract_requires_positive_project", PositiveProjectRequired);
                Run("contract_requires_sha256_model", Sha256Required);
                Run("exact_context_and_guid_match", ExactContextAndGuidMatch);
                Run("exact_legacy_guid_does_not_require_lens_next_comments", ExactLegacyGuidDoesNotRequireLensNextComments);
                Run("legacy_no_guid_uses_full_ordinal_display_name_only", LegacyNoGuidUsesFullOrdinalDisplayNameOnly);
                Run("bridge_port_range_is_bounded_and_dynamic", BridgePortRangeIsBoundedAndDynamic);
                Run("health_tick_never_restarts_or_navigates_for_expiry", HealthTickNeverRestartsOrNavigatesForExpiry);
                Run("missing_or_zero_guid_denies", MissingOrZeroGuidDenies);
                Run("legacy_metadata_fallback_is_exact", LegacyMetadataFallbackIsExact);
                Run("original_lens_split_merge_comments_resolve_exact_identity", OriginalLensSplitMergeCommentsResolveExactIdentity);
                Run("automatic_binding_requires_one_exact_managed_project", AutomaticBindingRequiresOneExactManagedProject);
                Run("unbound_contract_requires_authoritative_binding_before_navigation", UnboundContractRequiresBinding);
                Run("legacy_physical_code_fallback_is_bounded", LegacyPhysicalCodeFallbackIsBounded);
                Run("legacy_source_code_mapping_is_exact", LegacySourceCodeMappingIsExact);
                Run("legacy_title_fragment_fallback_is_bounded", LegacyTitleFragmentFallbackIsBounded);
                Run("legacy_inner_title_fallback_is_bounded", LegacyInnerTitleFallbackIsBounded);
                Run("mismatched_project_or_model_denies", MismatchedContextDenies);
                Run("ui_dispatcher_allows_owner_thread", OwnerThreadAllowed);
                Run("ui_dispatcher_denies_background_thread", BackgroundThreadDenied);
                Run("phase2_commands_remain_absent", Phase2CommandsRemainAbsent);
                Run("dock_pane_is_resizable_and_scrollable", DockPaneIsResizableAndScrollable);
                Run("dock_pane_has_recovery_command", DockPaneHasRecoveryCommand);
                Run("floating_close_hides_instead_of_destroying", FloatingCloseHidesInsteadOfDestroying);
                Run("camera_capture_allows_projection_specific_values_to_be_unset", CameraCaptureAllowsUnsetProjectionValues);
                Run("bridge_dispatches_immediately_without_idle_starvation", BridgeDispatchesImmediatelyWithoutIdleStarvation);
                Run("capture_timeout_covers_governed_model_scan", CaptureTimeoutCoversGovernedModelScan);
                Run("health_ping_bypasses_busy_ui_thread", HealthPingBypassesBusyUiThread);
                Run("xml_export_resolves_inherited_com_contract", XmlExportResolvesInheritedComContract);
                Run("xml_export_writes_validated_file", XmlExportWritesValidatedFile);
                Run("xml_export_failure_preserves_existing_file", XmlExportFailurePreservesExistingFile);
                Run("runtime_ignores_configured_project_when_model_marker_is_absent", RuntimeIgnoresConfiguredProjectFallback);
                Run("health_tick_does_not_mutate_floating_window", HealthTickDoesNotMutateFloatingWindow);
                Run("header_reports_current_version_beside_live", HeaderReportsCurrentVersionBesideLive);
                Run("visual_capture_wire_payload_uses_web_contract_keys", VisualCaptureWirePayloadUsesWebContractKeys);
                Run("visual_capture_wire_preserves_digest_double_bits", VisualCaptureWirePreservesDigestDoubleBits);
                Console.WriteLine("PASS " + _passed + "/" + _passed + " Navisworks " + ExpectedProductYear.Value);
                return 0;
            }
            catch (Exception exception)
            {
                Console.Error.WriteLine("FAIL " + exception.Message);
                return 1;
            }
        }

        private static void PositiveProjectRequired()
        {
            Throws<ArgumentException>(() => new AutodeskReadOnlyAdapterContract("0", Fingerprint));
            Throws<ArgumentException>(() => new AutodeskReadOnlyAdapterContract("not-an-id", Fingerprint));
        }

        private static void Sha256Required()
        {
            Throws<ArgumentException>(() => new AutodeskReadOnlyAdapterContract("1", "model-label"));
            Throws<ArgumentException>(() => new AutodeskReadOnlyAdapterContract("1", new string('g', 64)));
        }

        private static void ExactContextAndGuidMatch()
        {
            var contract = new AutodeskReadOnlyAdapterContract("1", Fingerprint);
            True(contract.Matches(Identity("1", Fingerprint, "11111111-2222-3333-4444-555555555555")));
        }

        private static void MissingOrZeroGuidDenies()
        {
            var contract = new AutodeskReadOnlyAdapterContract("1", Fingerprint);
            False(contract.Matches(Identity("1", Fingerprint, null)));
            False(contract.Matches(Identity("1", Fingerprint, Guid.Empty.ToString())));
            False(contract.Matches(Identity("1", Fingerprint, "not-a-guid")));
        }

        private static void MismatchedContextDenies()
        {
            var contract = new AutodeskReadOnlyAdapterContract("1", Fingerprint);
            False(contract.Matches(Identity("2", Fingerprint, Guid.NewGuid().ToString())));
            False(contract.Matches(Identity("1", new string('a', 64), Guid.NewGuid().ToString())));
        }

        private static void OwnerThreadAllowed()
        {
            var dispatcher = new AutodeskNavisworksUiThreadDispatcher();
            Equal(7, dispatcher.Invoke(() => 7));
        }

        private static void BackgroundThreadDenied()
        {
            var dispatcher = new AutodeskNavisworksUiThreadDispatcher();
            Exception observed = null;
            var thread = new Thread(() =>
            {
                try { dispatcher.Invoke(() => true); }
                catch (Exception exception) { observed = exception; }
            });
            thread.Start(); thread.Join();
            True(observed is InvalidOperationException);
        }

        private static void Phase2CommandsRemainAbsent()
        {
            Equal(10, LensNextBridgeCommands.ReadOnlyCommands.Count);
            foreach (var command in LensNextBridgeCommands.ReadOnlyCommands)
            {
                False(command.StartsWith("phase2-", StringComparison.Ordinal));
            }
        }

        private static void LegacyNoGuidUsesFullOrdinalDisplayNameOnly()
        {
            var source = File.ReadAllText(Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, @"..\..\..\..\..\native\AutodeskReadOnlyAdapter.cs")));
            True(source.Contains("string.Equals(view.DisplayName, identity.ViewpointId, StringComparison.Ordinal)"));
            True(source.Contains("var exactNameMatches = all.Where"));
            var start = source.IndexOf("var exactNameMatches", StringComparison.Ordinal);
            var end = source.IndexOf("var correlated", start, StringComparison.Ordinal);
            var branch = source.Substring(start, end - start);
            False(branch.Contains("DisplayCode"));
            False(branch.Contains("TitleFragment"));
        }

        private static void BridgePortRangeIsBoundedAndDynamic()
        {
            Equal(8766, LensNextConstants.BridgeMinimumPort);
            Equal(8865, LensNextConstants.BridgeMaximumPort);
            var source = File.ReadAllText(Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, @"..\..\..\..\..\native\LensNextNativeRuntime.cs")));
            True(source.Contains("AllocateBridgePort()"));
            True(source.Contains("IPAddress.Loopback"));
        }

        private static void HealthTickNeverRestartsOrNavigatesForExpiry()
        {
            var source = File.ReadAllText(Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, @"..\..\..\..\..\native\LensNextDockPanelControl.cs")));
            var start = source.IndexOf("private void HealthTick()", StringComparison.Ordinal);
            var end = source.IndexOf("private void Settings()", start, StringComparison.Ordinal);
            var body = source.Substring(start, end - start);
            False(body.Contains("SessionExpired"));
            False(body.Contains("StartOrRestart"));
            False(body.Contains("NavigateWorkspace"));
        }

        private static void ExactLegacyGuidDoesNotRequireLensNextComments()
        {
            var source = File.ReadAllText(Path.GetFullPath(Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory,
                @"..\..\..\..\..\native\AutodeskReadOnlyAdapter.cs")));
            var start = source.IndexOf("TryParseNonEmptyGuid(identity.NavisworksGuid", StringComparison.Ordinal);
            var end = source.IndexOf("return Array.AsReadOnly(correlated", start, StringComparison.Ordinal);
            True(start >= 0 && end > start);
            var exactGuidBranch = source.Substring(start, end - start);
            True(exactGuidBranch.Contains("if (exactGuid != null && exactGuid.Guid == nativeGuid)"));
            False(exactGuidBranch.Contains("correlated.Any"));
        }

        private static void LegacyMetadataFallbackIsExact()
        {
            var body = "{ \"source\": \"BIMLogLens\", \"serverId\": 22, \"sourceProjectId\": 26 }";
            True(AutodeskReadOnlyAdapterContract.MatchesBimlogMetadata(body, "26", "22"));
            False(AutodeskReadOnlyAdapterContract.MatchesBimlogMetadata(body, "26", "2"));
            False(AutodeskReadOnlyAdapterContract.MatchesBimlogMetadata(body, "2", "22"));
            False(AutodeskReadOnlyAdapterContract.MatchesBimlogMetadata("{\"serverId\":22,\"projectId\":26}", "26", "22"));
            Equal("1185RI-98AA6A", AutodeskReadOnlyAdapterContract.DisplayCode("1185RI-98AA6A | EL-001 | COORDINATION"));
        }

        private static void OriginalLensSplitMergeCommentsResolveExactIdentity()
        {
            var comments = new[]
            {
                "{\"displayId\":\"1185RI-A9C9F0\",\"sourceProjectId\":26,\"projectId\":26,\"source\":\"BIMLogLens\"}",
                "{\"bimlogPhysicalId\":\"11111111-2222-3333-4444-555555555555\",\"source\":\"BIMLogLens\"}",
                "{\"serverId\":23,\"workflowStatus\":\"open\",\"source\":\"BIMLogLens\"}"
            };
            True(AutodeskReadOnlyAdapterContract.MatchesBimlogMetadata(comments, "26", "23"));
            True(AutodeskReadOnlyAdapterContract.MatchesBimlogPhysicalMetadata(
                comments, "26", "11111111-2222-3333-4444-555555555555"));
            False(AutodeskReadOnlyAdapterContract.MatchesBimlogMetadata(comments, "26", "22"));
            False(AutodeskReadOnlyAdapterContract.MatchesBimlogMetadata(comments, "25", "23"));
        }

        private static void AutomaticBindingRequiresOneExactManagedProject()
        {
            var project26 = new[] { "{\"source\":\"BIMLogLens\",\"sourceProjectId\":26}" };
            var project35 = new[] { "{\"source\":\"BIMLogLens\",\"projectId\":35}" };
            var unrelated = new[] { "{\"projectId\":999}" };
            Equal("26", AutodeskReadOnlyAdapterContract.ResolveUniqueManagedProjectId(new[] { project26, project26, unrelated }));
            Equal(null, AutodeskReadOnlyAdapterContract.ResolveUniqueManagedProjectId(new[] { unrelated }));
            Throws<InvalidOperationException>(() => AutodeskReadOnlyAdapterContract.ResolveUniqueManagedProjectId(new[] { project26, project35 }));
        }

        private static void UnboundContractRequiresBinding()
        {
            var contract = new AutodeskReadOnlyAdapterContract(null, Fingerprint);
            False(contract.MatchesContext(Identity("26", Fingerprint, Guid.NewGuid().ToString())));
            contract.BindProject("26");
            True(contract.MatchesContext(Identity("26", Fingerprint, Guid.NewGuid().ToString())));
            Throws<ArgumentException>(() => contract.BindProject("0"));
        }

        private static void LegacyPhysicalCodeFallbackIsBounded()
        {
            Equal("CI-001", AutodeskReadOnlyAdapterContract.LegacyPhysicalCode(
                "1185RI-E11AC6 | CI-001 | COORDINATION | L6 | P2 | SINGLE TEST"));
            True(AutodeskReadOnlyAdapterContract.MatchesLegacyPhysicalCode("CI-001 | SINGLE TEST", "CI-001"));
            True(AutodeskReadOnlyAdapterContract.MatchesLegacyPhysicalCode("Saved View - CI-001 - SINGLE TEST", "CI-001"));
            False(AutodeskReadOnlyAdapterContract.MatchesLegacyPhysicalCode("CI-0010 | OTHER", "CI-001"));
            False(AutodeskReadOnlyAdapterContract.MatchesLegacyPhysicalCode("SINGLE TEST", "CI-001"));
        }

        private static void LegacySourceCodeMappingIsExact()
        {
            Equal("C.001", AutodeskReadOnlyAdapterContract.LegacyNavisworksSourceCode("CI-001"));
            Equal("M.027", AutodeskReadOnlyAdapterContract.LegacyNavisworksSourceCode("ME-027"));
            Equal(string.Empty, AutodeskReadOnlyAdapterContract.LegacyNavisworksSourceCode("CI.001"));
            True(AutodeskReadOnlyAdapterContract.MatchesLegacyPhysicalCode(
                "C.001 DUCT IN CONFLICT", "C.001"));
            False(AutodeskReadOnlyAdapterContract.MatchesLegacyPhysicalCode(
                "C.010 DUCT IN CONFLICT", "C.001"));
        }

        private static void LegacyTitleFragmentFallbackIsBounded()
        {
            var identity = "1185RI-E11AC6 | CI-001 | COORDINATION | L6 | P2 | SINGLE TEST ---CHANG";
            Equal("SINGLE TEST ---CHANG", AutodeskReadOnlyAdapterContract.LegacyTitleFragment(identity));
            True(AutodeskReadOnlyAdapterContract.MatchesLegacyTitleFragment(
                "SINGLE TEST ---CHANGE FLOOR---", "SINGLE TEST ---CHANG"));
            False(AutodeskReadOnlyAdapterContract.MatchesLegacyTitleFragment(
                "GROUP TEST ---CHANGE FLOOR---", "SINGLE TEST ---CHANG"));
            False(AutodeskReadOnlyAdapterContract.MatchesLegacyTitleFragment("SINGLE TEST", "SINGLE"));
        }

        private static void LegacyInnerTitleFallbackIsBounded()
        {
            True(AutodeskReadOnlyAdapterContract.MatchesLegacyInnerTitle(
                "SAVE TEST", "SINGLE TEST ---SAVE TEST---"));
            True(AutodeskReadOnlyAdapterContract.MatchesLegacyInnerTitle(
                "CI-001 | SAVE TEST", "SINGLE TEST ---SAVE TEST---"));
            False(AutodeskReadOnlyAdapterContract.MatchesLegacyInnerTitle(
                "SAVE TEST 2", "SINGLE TEST ---SAVE TEST---"));
            False(AutodeskReadOnlyAdapterContract.MatchesLegacyInnerTitle(
                "SAVE", "SINGLE TEST ---SAVE---"));
        }

        private static void DockPaneIsResizableAndScrollable()
        {
            var source = NativeEntryPointSource();
            True(source.Contains("FixedSize = false"));
            True(source.Contains("AutoScroll = true"));
            True(source.Contains("MinimumWidth = 300"));
            True(source.Contains("MinimumHeight = 360"));
            var panelSource = File.ReadAllText(Path.GetFullPath(Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory,
                @"..\..\..\..\..\native\LensNextDockPanelControl.cs")));
            True(panelSource.Contains("floating.MinimizeBox = true;"));
            True(panelSource.Contains("ForceNativeFloatingWindowChrome(floating);"));
            True(panelSource.Contains("WsMinimizeBox | WsMaximizeBox"));
            True(panelSource.Contains("SwpFrameChanged"));
            True(panelSource.Contains("restoreWindow && floating.WindowState == FormWindowState.Minimized"));
        }

        private static void DockPaneHasRecoveryCommand()
        {
            var source = NativeEntryPointSource();
            True(source.Contains("public void ShowPane()"));
            True(source.Contains("Visible = true;"));
            True(source.Contains("_panel.RestoreHostWindow();"));
        }

        private static string NativeEntryPointSource()
        {
            var sourcePath = Path.GetFullPath(Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory,
                @"..\..\..\..\..\native\AutodeskPluginEntryPoints.cs"));
            return File.ReadAllText(sourcePath);
        }

        private static void FloatingCloseHidesInsteadOfDestroying()
        {
            var sourcePath = Path.GetFullPath(Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory,
                @"..\..\..\..\..\native\LensNextDockPanelControl.cs"));
            var source = File.ReadAllText(sourcePath);
            True(source.Contains("args.CloseReason != CloseReason.UserClosing"));
            True(source.Contains("args.Cancel = true;"));
            True(source.Contains("floating.Hide();"));
            True(source.Contains("private const int WmSysCommand = 0x0112;"));
            True(source.Contains("private const int ScClose = 0xF060;"));
            True(source.Contains("Application.AddMessageFilter(_floatingHostCloseFilter);"));
            True(source.Contains("_host.Hide();"));
            True(source.Contains("return true;"));
            True(source.Contains("Lens Next command can restore it"));
        }

        private static void CameraCaptureAllowsUnsetProjectionValues()
        {
            var source = File.ReadAllText(Path.GetFullPath(Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory,
                @"..\..\..\..\..\native\AutodeskVisualStateAdapter.cs")));
            True(source.Contains("OptionalPositiveCameraValue(() => view.FocalDistance)"));
            True(source.Contains("catch (Exception)"));
            False(source.Contains("Projection = view.Projection.ToString(), FocalDistance = view.FocalDistance"));
        }

        private static void BridgeDispatchesImmediatelyWithoutIdleStarvation()
        {
            var source = File.ReadAllText(Path.GetFullPath(Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory,
                @"..\..\..\..\..\native\LensNextUiRequestPump.cs")));
            True(source.Contains("Control uiDispatcher"));
            True(source.Contains("_uiDispatcher.BeginInvoke(new Action(DrainQueue))"));
            True(source.Contains("private void DrainQueue()"));
            False(source.Contains("SynchronizationContext.Current"));
            False(source.Contains("NavisworksApplication.Idle +="));
            False(source.Contains("private void OnIdle("));
        }

        private static void CaptureTimeoutCoversGovernedModelScan()
        {
            Equal(60000, LensNextConstants.BridgeCaptureRequestTimeoutMilliseconds);
            var source = File.ReadAllText(Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, @"..\..\..\..\..\native\LensNextHttpBridgeHost.cs")));
            True(source.Contains("TimeoutFor(command)"));
            True(source.Contains("LensNextBridgeCommands.CaptureNewViewpoint"));
        }

        private static void HealthPingBypassesBusyUiThread()
        {
            var source = File.ReadAllText(Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, @"..\..\..\..\..\native\LensNextUiRequestPump.cs")));
            True(source.Contains("request.Command == LensNextBridgeCommands.Ping"));
            True(source.Contains("return _bridge.Execute(request)"));
        }

        private interface IBaseIoState
        {
            object GetIOPluginOptions(string internalName);
            int DriveIOPlugin(string internalName, string fileName, object options);
        }

        private interface ICurrentIoState : IBaseIoState
        {
            object ObjectFactory(int objectType, object first, object second);
        }

        private sealed class SuccessfulIoState : ICurrentIoState
        {
            public object GetIOPluginOptions(string internalName)
            {
                Equal("XmlViewpointsExportPlugin", internalName);
                return new object();
            }

            public int DriveIOPlugin(string internalName, string fileName, object options)
            {
                Equal("XmlViewpointsExportPlugin", internalName);
                True(options != null);
                File.WriteAllText(fileName, "<?xml version=\"1.0\" encoding=\"utf-8\"?><exchange />");
                return 0;
            }

            public object ObjectFactory(int objectType, object first, object second) => null;
        }

        private sealed class FailedIoState : ICurrentIoState
        {
            public object GetIOPluginOptions(string internalName) => new object();
            public int DriveIOPlugin(string internalName, string fileName, object options) => 3;
            public object ObjectFactory(int objectType, object first, object second) => null;
        }

        private static void XmlExportResolvesInheritedComContract()
        {
            var source = File.ReadAllText(Path.GetFullPath(Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory,
                @"..\..\..\..\..\native\LensNextDockPanelControl.cs")));
            True(source.Contains("FindComContractMethod(stateContract, \"GetIOPluginOptions\", 1)"));
            True(source.Contains("FindComContractMethod(stateContract, \"DriveIOPlugin\", 3)"));
            False(source.Contains("Enum.ToObject(objectType, 39)"));

            var resolver = typeof(LensNextDockPanelControl).GetMethod(
                "FindComContractMethod",
                BindingFlags.NonPublic | BindingFlags.Static);
            True(resolver != null);

            var options = resolver.Invoke(null, new object[] { typeof(ICurrentIoState), "GetIOPluginOptions", 1 }) as MethodInfo;
            var drive = resolver.Invoke(null, new object[] { typeof(ICurrentIoState), "DriveIOPlugin", 3 }) as MethodInfo;
            True(options != null && options.DeclaringType == typeof(IBaseIoState));
            True(drive != null && drive.DeclaringType == typeof(IBaseIoState));
        }

        private static void XmlExportWritesValidatedFile()
        {
            var directory = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "xml-export-test-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(directory);
            try
            {
                var destination = Path.Combine(directory, "viewpoints.xml");
                var result = XmlExportCore().Invoke(null, new object[] { new SuccessfulIoState(), typeof(ICurrentIoState), destination });
                Equal("0", Convert.ToString(result));
                True(File.Exists(destination));
                True(File.ReadAllText(destination).Contains("<exchange"));
                False(Directory.GetFiles(directory, "*.tmp.xml").Any());
            }
            finally
            {
                Directory.Delete(directory, true);
            }
        }

        private static void XmlExportFailurePreservesExistingFile()
        {
            var directory = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "xml-export-test-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(directory);
            try
            {
                var destination = Path.Combine(directory, "viewpoints.xml");
                File.WriteAllText(destination, "preserve-me");
                try
                {
                    XmlExportCore().Invoke(null, new object[] { new FailedIoState(), typeof(ICurrentIoState), destination });
                    throw new InvalidOperationException("Expected XML export failure.");
                }
                catch (TargetInvocationException exception)
                {
                    True(exception.InnerException is InvalidOperationException);
                    True(exception.InnerException.Message.Contains("status 3"));
                }
                Equal("preserve-me", File.ReadAllText(destination));
                False(Directory.GetFiles(directory, "*.tmp.xml").Any());
            }
            finally
            {
                Directory.Delete(directory, true);
            }
        }

        private static MethodInfo XmlExportCore()
        {
            var method = typeof(LensNextDockPanelControl).GetMethod(
                "ExportViewpointsXmlCore",
                BindingFlags.NonPublic | BindingFlags.Static);
            True(method != null);
            return method;
        }
        private static void HeaderReportsCurrentVersionBesideLive()
        {
            var source = File.ReadAllText(Path.GetFullPath(Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory,
                @"..\..\..\..\..\native\LensNextDockPanelControl.cs")));
            True(source.Contains("\u25cf LIVE \u00b7 \" + LensNextConstants.ProductVersionLabel"));
            Equal("v1.0.51", LensNextConstants.ProductVersionLabel);
        }

        private static void RuntimeIgnoresConfiguredProjectFallback()
        {
            var source = File.ReadAllText(Path.GetFullPath(Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory,
                @"..\..\..\..\..\native\LensNextNativeRuntime.cs")));
            True(source.Contains("Config.ProjectId + \" is a legacy candidate only and was ignored"));
            True(source.Contains("authoritativeProjectId"));
            True(source.Contains("\"managed-marker\""));
            False(source.Contains("Config.ProjectId = configuredProjectId"));
            False(source.Contains("Using configured Project="));
        }

        private static void HealthTickDoesNotMutateFloatingWindow()
        {
            var source = File.ReadAllText(Path.GetFullPath(Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory,
                @"..\..\..\..\..\native\LensNextDockPanelControl.cs")));
            var start = source.IndexOf("private void HealthTick()", StringComparison.Ordinal);
            var end = source.IndexOf("private void Settings()", start, StringComparison.Ordinal);
            True(start >= 0 && end > start);
            var healthTick = source.Substring(start, end - start);
            False(healthTick.Contains("NormalizeFloatingHostWindow("));
            True(source.Contains("NormalizeFloatingHostWindow(true);"));
        }

        private static void VisualCaptureWirePayloadUsesWebContractKeys()
        {
            var method = typeof(LensNextHttpBridgeHost).GetMethod(
                "WirePayload",
                BindingFlags.NonPublic | BindingFlags.Static);
            True(method != null);
            var payload = new LensNextVisualCapturePayload
            {
                RequestId = "request-1",
                Identity = new LensNextWireIdentity
                {
                    ProjectId = 1,
                    ServerId = 1,
                    ViewpointId = "viewpoint-1",
                    LifecycleStatus = "active",
                    RevisionNumber = 1
                },
                VisualState = new LensNextVisualState { ViewpointId = "viewpoint-1" }
            };
            var wire = method.Invoke(null, new object[] { payload }) as Dictionary<string, object>;
            True(wire != null);
            True(wire.ContainsKey("requestId"));
            True(wire.ContainsKey("identity"));
            True(wire.ContainsKey("visualState"));
            False(wire.ContainsKey("RequestId"));
            False(wire.ContainsKey("Identity"));
            False(wire.ContainsKey("VisualState"));
        }

        private static void VisualCaptureWirePreservesDigestDoubleBits()
        {
            const double cameraX = 370.12345678901235d;
            var method = typeof(LensNextHttpBridgeHost).GetMethod(
                "WirePayload",
                BindingFlags.NonPublic | BindingFlags.Static);
            True(method != null);
            var payload = new LensNextVisualCapturePayload
            {
                RequestId = "request-double-1",
                Identity = new LensNextWireIdentity { ProjectId = 28, ServerId = 1, ViewpointId = "local-viewpoint-v2" },
                VisualState = new LensNextVisualState
                {
                    ProjectId = 28,
                    ServerId = 1,
                    ViewpointId = "local-viewpoint-v2",
                    Camera = new LensNextCameraState
                    {
                        Position = new LensNextPointState { X = cameraX, Y = -42.125d, Z = 0d }
                    }
                }
            };
            var wire = method.Invoke(null, new object[] { payload });
            var serializer = new JavaScriptSerializer();
            var decoded = serializer.DeserializeObject(serializer.Serialize(wire)) as Dictionary<string, object>;
            True(decoded != null);
            var visualState = decoded["visualState"] as Dictionary<string, object>;
            True(visualState != null);
            var camera = visualState["Camera"] as Dictionary<string, object>;
            True(camera != null);
            var position = camera["Position"] as Dictionary<string, object>;
            True(position != null);
            var wireX = Convert.ToDouble(position["X"]);
            Equal(BitConverter.DoubleToInt64Bits(cameraX), BitConverter.DoubleToInt64Bits(wireX));
        }
        private static ImmutableWorkingViewIdentity Identity(string project, string model, string guid) =>
            new ImmutableWorkingViewIdentity { ProjectId = project, ModelFingerprint = model, NavisworksGuid = guid };
        private static void Run(string name, Action test) { test(); _passed++; Console.WriteLine("PASS " + name); }
        private static void True(bool value) { if (!value) throw new InvalidOperationException("Expected true."); }
        private static void False(bool value) { if (value) throw new InvalidOperationException("Expected false."); }
        private static void Equal<T>(T expected, T actual) { if (!EqualityComparer<T>.Default.Equals(expected, actual)) throw new InvalidOperationException("Expected " + expected + ", received " + actual + "."); }
        private static void Throws<T>(Action action) where T : Exception { try { action(); } catch (T) { return; } throw new InvalidOperationException("Expected " + typeof(T).Name + "."); }
    }
}
