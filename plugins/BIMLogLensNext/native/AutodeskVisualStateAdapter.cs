using System;
using System.Collections;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;
using Autodesk.Navisworks.Api;
using NavisworksApplication = Autodesk.Navisworks.Api.Application;

namespace BIMLogLensNext.Native
{
    public sealed partial class AutodeskLensNextReadOnlyAdapter
    {
        private readonly JavaScriptSerializer _visualJson = new JavaScriptSerializer { MaxJsonLength = 16 * 1024 * 1024 };

        public LensNextNavigationView CaptureCurrentNavigationView(ImmutableWorkingViewIdentity identity, bool includeScreenshot)
        {
            var timer = Stopwatch.StartNew();
            EnsureSameDocument();
            if (!_contract.MatchesContext(identity)) throw new InvalidOperationException("The navigation capture does not match the active BIMLog project/model context.");
            var navigation = new LensNextNavigationView
            {
                ContractVersion = LensNextNavigationSchema.ContractVersion,
                SchemaVersion = LensNextNavigationSchema.Version,
                ProjectId = Positive(identity.ProjectId, "projectId"),
                ServerId = Positive(identity.ServerId, "serverId"),
                ViewpointId = identity.ViewpointId,
                LifecycleStatus = identity.LifecycleStatus,
                RevisionNumber = Positive(identity.RevisionNumber, "revisionNumber"),
                ModelFingerprint = identity.ModelFingerprint,
                Camera = CaptureCamera(),
                SectioningJson = TryGetSectioningJson(),
                SelectedElements = new List<LensNextElementReference>()
            };
            if (navigation.Camera == null) throw new InvalidOperationException("The active Navisworks camera is unavailable.");
            if (includeScreenshot)
            {
                var screenshot = CaptureScreenshot();
                navigation.ScreenshotDataUrl = screenshot.DataUrl;
                navigation.ScreenshotSha256 = screenshot.Sha256;
            }
            navigation.DigestSha256 = LensNextNavigationDigest.Compute(navigation);
            LensNextNativeLog.Info("Navigation capture complete. Request=" + identity.ViewpointId + " Camera=true Sectioning=" + (!string.IsNullOrWhiteSpace(navigation.SectioningJson)) + " Selection=0 Screenshot=" + (!string.IsNullOrWhiteSpace(navigation.ScreenshotDataUrl)) + " ElapsedMs=" + timer.ElapsedMilliseconds);
            return navigation;
        }

        public LensNextNavigationApplyResult ApplyNavigationViewJson(ImmutableWorkingViewIdentity identity, string navigationJson, string storedDigest, string operationId)
        {
            var timer = Stopwatch.StartNew();
            var applied = new List<string>();
            var warnings = new List<string>();
            EnsureSameDocument();
            if (!_contract.MatchesContext(identity)) return NavigationFailed("Model/project context mismatch.", warnings);
            LensNextCameraState camera;
            string sectioning;
            List<LensNextElementReference> selected;
            try
            {
                var envelope = _visualJson.Deserialize<Dictionary<string, object>>(navigationJson);
                object contractValue;
                var contractVersion = envelope != null && (envelope.TryGetValue("ContractVersion", out contractValue) || envelope.TryGetValue("contractVersion", out contractValue)) ? Convert.ToString(contractValue, CultureInfo.InvariantCulture) : null;
                if (string.Equals(contractVersion, LensNextNavigationSchema.ContractVersion, StringComparison.Ordinal))
                {
                    var value = _visualJson.Deserialize<LensNextNavigationView>(navigationJson);
                    if (value == null || value.Camera == null || value.ProjectId != Positive(identity.ProjectId, "projectId") || value.ServerId != Positive(identity.ServerId, "serverId") || !string.Equals(value.ViewpointId, identity.ViewpointId, StringComparison.Ordinal) || !string.Equals(value.LifecycleStatus, identity.LifecycleStatus, StringComparison.Ordinal) || value.RevisionNumber != Positive(identity.RevisionNumber, "revisionNumber") || !string.Equals(value.ModelFingerprint, identity.ModelFingerprint, StringComparison.Ordinal))
                        return NavigationFailed("The BIMLog navigation identity does not match the active record.", warnings);
                    var recomputed = LensNextNavigationDigest.Compute(value);
                    if (string.IsNullOrWhiteSpace(storedDigest) || !string.Equals(storedDigest, value.DigestSha256, StringComparison.OrdinalIgnoreCase) || !string.Equals(storedDigest, recomputed, StringComparison.OrdinalIgnoreCase))
                        return NavigationFailed("BIMLog navigation digest validation failed.", warnings);
                    camera = value.Camera; sectioning = value.SectioningJson; selected = value.SelectedElements ?? new List<LensNextElementReference>();
                }
                else
                {
                    var historical = _visualJson.Deserialize<LensNextVisualState>(navigationJson);
                    var contractError = ValidateState(identity, historical);
                    if (contractError != null) return NavigationFailed(contractError, warnings);
                    var recomputed = LensNextVisualStateDigest.Compute(historical);
                    if (!string.Equals(storedDigest, historical.DigestSha256, StringComparison.OrdinalIgnoreCase) || !string.Equals(storedDigest, recomputed, StringComparison.OrdinalIgnoreCase))
                        return NavigationFailed("Historical BIMLog Visual Package digest validation failed.", warnings);
                    camera = historical.Camera; sectioning = historical.SectioningJson; selected = historical.SelectedElements ?? new List<LensNextElementReference>();
                    warnings.Add("Historical Visual Package opened through the lightweight navigation projection; exact visibility and appearance were not restored.");
                }
            }
            catch (Exception ex) { return NavigationFailed("BIMLog navigation payload is invalid: " + ex.Message, warnings); }

            try { ApplyCamera(camera); applied.Add("camera"); }
            catch (Exception ex) { return NavigationFailed("Camera apply failed: " + ex.Message, warnings); }
            if (!string.IsNullOrWhiteSpace(sectioning))
            {
                try { InvokeSectioningSetter(sectioning); applied.Add("sectioning"); }
                catch (Exception ex) { warnings.Add("Optional sectioning was not applied: " + ex.Message); }
            }
            if (selected.Count > 0)
                warnings.Add("Optional selection was not applied because navigation must not scan the full model; camera navigation completed.");
            LensNextNativeLog.Info("Navigation apply complete. Request=" + operationId + " Components=" + string.Join(",", applied) + " Warnings=" + warnings.Count + " ElapsedMs=" + timer.ElapsedMilliseconds);
            return new LensNextNavigationApplyResult { Applied = true, Message = "BIMLog navigation applied to the active Navisworks view without creating a Saved Viewpoint.", AppliedComponents = applied, OptionalWarnings = warnings };
        }

        private static LensNextNavigationApplyResult NavigationFailed(string message, IReadOnlyCollection<string> warnings)
        {
            return new LensNextNavigationApplyResult { Applied = false, Message = message, AppliedComponents = new string[0], OptionalWarnings = warnings ?? new string[0] };
        }

        public LensNextVisualState CaptureCurrentVisualState(ImmutableWorkingViewIdentity identity, bool includeScreenshot)
        {
            return CaptureCurrentVisualState(identity, includeScreenshot, true);
        }

        private LensNextVisualState CaptureCurrentVisualState(ImmutableWorkingViewIdentity identity, bool includeScreenshot, bool emitDigestDiagnostics)
        {
            var captureTimer = Stopwatch.StartNew();
            LensNextNativeLog.Info("Visual capture started. Screenshot=" + includeScreenshot);
            EnsureSameDocument();
            if (!_contract.MatchesContext(identity)) throw new InvalidOperationException("The visual capture does not match the active BIMLog project/model context.");
            var state = new LensNextVisualState
            {
                ProjectId = Positive(identity.ProjectId, "projectId"), ServerId = Positive(identity.ServerId, "serverId"),
                ViewpointId = identity.ViewpointId, LifecycleStatus = identity.LifecycleStatus,
                RevisionNumber = Positive(identity.RevisionNumber, "revisionNumber"), ModelFingerprint = identity.ModelFingerprint,
                CapturedAt = DateTimeOffset.UtcNow.ToString("o"), CaptureSource = "BIMLog Lens Next / Navisworks 2021",
                Completeness = NewCompleteness()
            };

            state.Camera = CaptureCamera();
            LensNextNativeLog.Info("Visual capture camera complete. ElapsedMs=" + captureTimer.ElapsedMilliseconds);
            Configure(state.Completeness.Camera, true, state.Camera != null, state.Camera != null, false, null,
                state.Camera != null ? "captured" : "failed", state.Camera != null ? "Exact active camera captured." : "Camera unavailable.");

            var scan = CaptureModelState();
            LensNextNativeLog.Info("Visual capture model scan complete. Hidden=" + scan.Hidden.Count + " Appearance=" + scan.Appearance.Count + " Models=" + scan.Models.Count + " Truncated=" + scan.Truncated + " ElapsedMs=" + captureTimer.ElapsedMilliseconds);

            var selection = CaptureSelection(scan);
            state.SelectedElements = selection.References;
            LensNextNativeLog.Info("Visual capture selection complete. Count=" + state.SelectedElements.Count + " ElapsedMs=" + captureTimer.ElapsedMilliseconds);
            Configure(state.Completeness.Selection, selection.Active, true, selection.Complete, selection.Truncated, selection.TotalCount,
                selection.Truncated ? "truncated" : "captured",
                selection.Truncated ? "Selection exceeded the bounded reference limit or included items without immutable references." : "Current selection captured by immutable model-item references; an empty selection is complete.");

            state.HiddenElements = scan.Hidden;
            state.AppearanceOverrides = scan.Appearance;
            state.ModelReferences = scan.Models;
            Configure(state.Completeness.Visibility, scan.HiddenDetected > 0, true, !scan.VisibilityTruncated, scan.VisibilityTruncated, scan.HiddenDetected,
                scan.VisibilityTruncated ? "truncated" : "captured",
                scan.VisibilityTruncated ? "Active hidden state exceeded the bounded reference limit or included items without immutable references." : "Hidden-element state captured; an empty hidden list is complete.");
            Configure(state.Completeness.AppearanceOverrides, scan.AppearanceDetected > 0, true, !scan.AppearanceTruncated, scan.AppearanceTruncated, scan.AppearanceDetected,
                scan.AppearanceTruncated ? "truncated" : "captured",
                scan.AppearanceTruncated ? "Active appearance state exceeded the bounded reference limit or included items without immutable references." : "Active color/transparency overrides captured where different from original appearance; an empty override list is complete.");
            var modelsComplete = scan.ModelUnresolved == 0 && scan.ModelAmbiguous == 0 && scan.EnumerationFailures == 0;
            Configure(state.Completeness.ModelReferences, scan.Models.Count > 0, true, modelsComplete, !modelsComplete, scan.Models.Count,
                modelsComplete ? "captured" : "incomplete", modelsComplete ? "Deterministic model/reference context captured." : "Model/reference context is unresolved or ambiguous.");
            PopulateMetrics(state.Completeness.Selection, scan.Scanned, selection.TotalCount, selection.References, selection.Unresolved, selection.Ambiguous, selection.Capped, 0, 0, captureTimer.ElapsedMilliseconds);
            PopulateMetrics(state.Completeness.Visibility, scan.Scanned, scan.HiddenDetected, scan.Hidden, scan.VisibilityUnresolved, scan.VisibilityAmbiguous, scan.VisibilityCapped, scan.EnumerationFailures, 0, captureTimer.ElapsedMilliseconds);
            PopulateMetrics(state.Completeness.AppearanceOverrides, scan.Scanned, scan.AppearanceDetected, scan.Appearance.Select(value => value.Element), scan.AppearanceUnresolved, scan.AppearanceAmbiguous, scan.AppearanceCapped, scan.EnumerationFailures, scan.AppearanceInspectionFailures, captureTimer.ElapsedMilliseconds);
            PopulateMetrics(state.Completeness.ModelReferences, scan.ModelsVisited, scan.Models.Count, Enumerable.Empty<LensNextElementReference>(), scan.ModelUnresolved, scan.ModelAmbiguous, 0, scan.EnumerationFailures, 0, captureTimer.ElapsedMilliseconds);
            state.Completeness.ModelReferences.ReferencesStored = scan.Models.Count;
            LogCaptureMetrics(state.ViewpointId, "selection", state.Completeness.Selection);
            LogCaptureMetrics(state.ViewpointId, "visibility", state.Completeness.Visibility);
            LogCaptureMetrics(state.ViewpointId, "appearanceOverrides", state.Completeness.AppearanceOverrides);
            LogCaptureMetrics(state.ViewpointId, "modelReferences", state.Completeness.ModelReferences);

            state.SectioningJson = TryGetSectioningJson();
            var sectionSetterAvailable = HasSectioningSetter();
            state.Completeness.Sectioning.RequiredForReconstruction = !string.IsNullOrWhiteSpace(state.SectioningJson);
            state.Completeness.Sectioning.Active = state.Completeness.Sectioning.RequiredForReconstruction;
            state.Completeness.Sectioning.Supported = !state.Completeness.Sectioning.RequiredForReconstruction || sectionSetterAvailable;
            state.Completeness.Sectioning.Captured = !state.Completeness.Sectioning.RequiredForReconstruction || !string.IsNullOrWhiteSpace(state.SectioningJson);
            state.Completeness.Sectioning.Complete = state.Completeness.Sectioning.Captured && state.Completeness.Sectioning.Supported;
            state.Completeness.Sectioning.Truncated = false;
            state.Completeness.Sectioning.Count = state.Completeness.Sectioning.RequiredForReconstruction ? 1 : 0;
            state.Completeness.Sectioning.Status = state.Completeness.Sectioning.RequiredForReconstruction ? (sectionSetterAvailable ? "captured" : "unsupported") : "inactive";
            state.Completeness.Sectioning.Message = !string.IsNullOrWhiteSpace(state.SectioningJson)
                ? (sectionSetterAvailable ? "Sectioning payload captured and can be reapplied." : "Sectioning was captured but this Navisworks API does not expose a safe setter; reconstruction will block.")
                : "No active sectioning payload is required for this working view.";

            var hasSavedRedlines = HasCurrentSavedViewpointRedlines();
            state.RedlinesJson = TryGetCurrentViewJson("GetRedlines");
            var redlineSetterAvailable = HasCurrentViewMethod("SetRedlines");
            state.Completeness.Redlines.RequiredForReconstruction = hasSavedRedlines;
            state.Completeness.Redlines.Active = hasSavedRedlines;
            state.Completeness.Redlines.Supported = !hasSavedRedlines || (!string.IsNullOrWhiteSpace(state.RedlinesJson) && redlineSetterAvailable);
            state.Completeness.Redlines.Captured = !hasSavedRedlines || !string.IsNullOrWhiteSpace(state.RedlinesJson);
            state.Completeness.Redlines.Complete = state.Completeness.Redlines.Captured && state.Completeness.Redlines.Supported;
            state.Completeness.Redlines.Truncated = false;
            state.Completeness.Redlines.Count = hasSavedRedlines ? 1 : 0;
            state.Completeness.Redlines.Status = hasSavedRedlines ? (state.Completeness.Redlines.Complete.Value ? "captured" : "unsupported") : "inactive";
            state.Completeness.Redlines.Message = hasSavedRedlines
                ? (!string.IsNullOrWhiteSpace(state.RedlinesJson) && redlineSetterAvailable ? "Redline payload captured and can be reapplied." : "Existing saved-viewpoint redlines cannot be safely reconstructed as a temporary Working View; operation will block rather than guess.")
                : "No redlines are required for this temporary working view.";

            if (includeScreenshot)
            {
                var shot = CaptureScreenshot();
                state.ScreenshotDataUrl = shot.DataUrl; state.ScreenshotSha256 = shot.Sha256;
                Configure(state.Completeness.Screenshot, !string.IsNullOrWhiteSpace(shot.DataUrl), true, !string.IsNullOrWhiteSpace(shot.DataUrl), false,
                    !string.IsNullOrWhiteSpace(shot.DataUrl) ? 1 : 0, string.IsNullOrWhiteSpace(shot.DataUrl) ? "failed" : "captured",
                    string.IsNullOrWhiteSpace(shot.DataUrl) ? "Screenshot capture failed; screenshots are evidence and are not required to reconstruct a working view." : "Navisworks window screenshot captured.");
                state.Completeness.Screenshot.RequiredForReconstruction = false;
            }
            else
            {
                state.Completeness.Screenshot.Supported = true; state.Completeness.Screenshot.Captured = false;
                state.Completeness.Screenshot.RequiredForReconstruction = false; state.Completeness.Screenshot.Active = false;
                state.Completeness.Screenshot.Complete = true; state.Completeness.Screenshot.Truncated = false; state.Completeness.Screenshot.Count = 0;
                state.Completeness.Screenshot.Status = "omitted"; state.Completeness.Screenshot.Message = "Screenshot omitted by request; screenshots are not required to reconstruct a working view.";
            }

            state.DigestDiagnostics = new LensNextDigestDiagnostics { Algorithm = LensNextVisualStateDigest.Algorithm, ContractVersion = LensNextVisualStateDigest.ContractVersionV3 };
            state.DigestSha256 = LensNextVisualStateDigest.Compute(state);
            state.DigestDiagnostics = LensNextVisualStateDigest.Diagnose(state, scan.Truncated || selection.Truncated);
            if (emitDigestDiagnostics)
            {
                LensNextNativeLog.Info(
                    "Visual digest diagnostics. Algorithm=" + state.DigestDiagnostics.Algorithm +
                    " Contract=" + state.DigestDiagnostics.ContractVersion +
                    " Computed=" + state.DigestDiagnostics.ComputedDigest +
                    " Truncated=" + state.DigestDiagnostics.Truncated +
                    " CanonicalLength=" + state.DigestDiagnostics.CanonicalLength +
                    " CanonicalInputBase64=" + state.DigestDiagnostics.CanonicalInputBase64);
            }
            if (emitDigestDiagnostics)
            {
                LensNextNativeLog.Info("Capture lifecycle. Stage=capture-readiness-started Request=" + state.ViewpointId + " ElapsedMs=" + captureTimer.ElapsedMilliseconds);
                var readiness = LensNextVisualReadiness.Evaluate(state);
                LensNextNativeLog.Info("Capture lifecycle. Stage=capture-readiness-evaluated Request=" + state.ViewpointId + " Outcome=" + readiness.Outcome + " ElapsedMs=" + captureTimer.ElapsedMilliseconds);
                try
                {
                    LensNextVisualReadiness.EnsureCaptureCanReopen(state);
                    LensNextNativeLog.Info("Capture lifecycle. Stage=capture-readiness-passed Request=" + state.ViewpointId + " ElapsedMs=" + captureTimer.ElapsedMilliseconds);
                }
                catch
                {
                    LensNextNativeLog.Info("Capture lifecycle. Stage=capture-readiness-blocked Request=" + state.ViewpointId + " Components=" + readiness.BlockingDiagnostic + " ElapsedMs=" + captureTimer.ElapsedMilliseconds);
                    throw;
                }
            }
            LensNextNativeLog.Info("Visual capture complete. ElapsedMs=" + captureTimer.ElapsedMilliseconds);
            return state;
        }

        public LensNextVisualApplyResult ApplyWorkingVisualStateJson(ImmutableWorkingViewIdentity identity, string visualStateJson, string storedVisualStateDigest, string operationId)
        {
            var applyTimer = Stopwatch.StartNew();
            operationId = string.IsNullOrWhiteSpace(operationId) ? "unknown" : operationId;
            LogApplyStage(operationId, "request-validated", applyTimer, null);
            EnsureSameDocument();
            if (!_contract.MatchesContext(identity)) { LogApplyStage(operationId, "failed", applyTimer, "Model/project context mismatch."); return Failed("Model/project context mismatch.", false, false); }
            LogApplyStage(operationId, "project-session-model-verified", applyTimer, "Project=" + identity.ProjectId + " Viewpoint=" + identity.ViewpointId);
            LensNextVisualState state;
            try { state = _visualJson.Deserialize<LensNextVisualState>(visualStateJson); }
            catch (Exception ex) { LogApplyStage(operationId, "failed", applyTimer, "Visual-state JSON is invalid: " + ex.Message); return Failed("Visual-state JSON is invalid: " + ex.Message, false, false); }
            LogApplyStage(operationId, "visual-package-parsed", applyTimer, "Bytes=" + Encoding.UTF8.GetByteCount(visualStateJson));
            var receivedDigest = state == null ? null : state.DigestSha256;
            LogApplyStage(operationId, "digest-validation-started", applyTimer, "StoredDigest=" + storedVisualStateDigest + " ReceivedDigest=" + receivedDigest);
            if (string.IsNullOrWhiteSpace(storedVisualStateDigest) || !string.Equals(storedVisualStateDigest, receivedDigest, StringComparison.OrdinalIgnoreCase))
            {
                const string persistedMismatch = "The persisted BIMLog digest does not match the received Visual Package digest.";
                LogApplyStage(operationId, "failed", applyTimer, persistedMismatch);
                return Failed(persistedMismatch, false, false);
            }
            var contractError = ValidateState(identity, state);
            if (contractError != null) { LogApplyStage(operationId, "failed", applyTimer, contractError); return Failed(contractError, false, false); }
            var diagnostics = LensNextVisualStateDigest.Diagnose(state, state.DigestDiagnostics != null && state.DigestDiagnostics.Truncated);
            LogApplyStage(operationId, "digest-validation-completed", applyTimer,
                "StoredDigest=" + storedVisualStateDigest +
                " ReceivedDigest=" + receivedDigest +
                " RecomputedDigest=" + diagnostics.ComputedDigest +
                " DigestContractVersion=" + diagnostics.ContractVersion +
                " CanonicalLength=" + diagnostics.CanonicalLength +
                " ProjectId=" + state.ProjectId +
                " IssueId=" + state.ServerId +
                " ViewpointId=" + state.ViewpointId +
                " ModelFingerprint=" + state.ModelFingerprint);
            var readiness = LensNextVisualReadiness.Evaluate(state);
            LogApplyStage(operationId, "component-readiness-evaluated", applyTimer,
                "Outcome=" + readiness.Outcome + " Contract=" + readiness.ContractVersion + " Components=" +
                string.Join(" || ", readiness.Components.Select(component => component.Diagnostic())));
            if (!readiness.CanApplyFullRestore)
            {
                var incomplete = "Working View cannot be restored exactly: " + readiness.BlockingDiagnostic;
                LogApplyStage(operationId, "failed", applyTimer, incomplete);
                return Failed(incomplete, false, false);
            }

            LensNextVisualState rollback = null;
            try
            {
                LogApplyStage(operationId, "rollback-capture-started", applyTimer, null);
                rollback = CaptureCurrentVisualState(identity, false, false);
                LogApplyStage(operationId, "rollback-capture-completed", applyTimer, "Hidden=" + rollback.HiddenElements.Count + " Appearance=" + rollback.AppearanceOverrides.Count);
            }
            catch (Exception ex) { LogApplyStage(operationId, "rollback-capture-unavailable", applyTimer, ex.GetType().Name); }
            var applied = new List<string>();
            try
            {
                LogApplyStage(operationId, "model-reference-resolution-started", applyTimer, null);
                ValidateModelReferences(state.ModelReferences);
                var resolution = BuildResolutionIndex(AllElementReferences(state));
                ResolveExact(AllElementReferences(state), true, resolution);
                LogApplyStage(operationId, "model-reference-resolution-completed", applyTimer, "Resolved=" + resolution.Count);
                ApplyCamera(state.Camera); applied.Add("camera"); LogApplyStage(operationId, "camera-applied", applyTimer, null);
                if (!string.IsNullOrWhiteSpace(state.SectioningJson)) { InvokeSectioningSetter(state.SectioningJson); applied.Add("sectioning"); }
                LogApplyStage(operationId, "sectioning-applied", applyTimer, string.IsNullOrWhiteSpace(state.SectioningJson) ? "Required=false" : "Required=true");
                ApplyVisibility(state.HiddenElements, resolution); applied.Add("visibility"); LogApplyStage(operationId, "visibility-applied", applyTimer, "Count=" + (state.HiddenElements == null ? 0 : state.HiddenElements.Count));
                ApplyAppearance(state.AppearanceOverrides, resolution); applied.Add("appearanceOverrides"); LogApplyStage(operationId, "appearance-applied", applyTimer, "Count=" + (state.AppearanceOverrides == null ? 0 : state.AppearanceOverrides.Count));
                ApplySelection(state.SelectedElements, resolution); applied.Add("selection"); LogApplyStage(operationId, "selection-applied", applyTimer, "Count=" + (state.SelectedElements == null ? 0 : state.SelectedElements.Count));
                if (!string.IsNullOrWhiteSpace(state.RedlinesJson)) { InvokeCurrentViewStringSetter("SetRedlines", state.RedlinesJson); applied.Add("redlines"); }
                LogApplyStage(operationId, "redraw-refresh-completed", applyTimer, "Mode=implicit-navisworks-view-update");
                LogApplyStage(operationId, "completed", applyTimer, "Components=" + string.Join(",", applied));
                return new LensNextVisualApplyResult { Applied = true, Message = "Temporary BIMLog working view reconstructed without creating a SavedViewpoint.", AppliedComponents = applied };
            }
            catch (Exception ex)
            {
                LogApplyStage(operationId, "failed", applyTimer, ex.GetType().Name + ":" + ex.Message);
                var rollbackSucceeded = false;
                if (rollback != null)
                {
                    try
                    {
                        var rollbackResolution = BuildResolutionIndex(AllElementReferences(rollback));
                        ApplyCamera(rollback.Camera); ApplySelection(rollback.SelectedElements, rollbackResolution); ApplyVisibility(rollback.HiddenElements, rollbackResolution); ApplyAppearance(rollback.AppearanceOverrides, rollbackResolution);
                        if (!string.IsNullOrWhiteSpace(rollback.SectioningJson)) InvokeSectioningSetter(rollback.SectioningJson);
                        if (!string.IsNullOrWhiteSpace(rollback.RedlinesJson)) InvokeCurrentViewStringSetter("SetRedlines", rollback.RedlinesJson);
                        rollbackSucceeded = true;
                    }
                    catch { }
                }
                return Failed("Working-view reconstruction failed and was blocked: " + ex.Message, rollback != null, rollbackSucceeded);
            }
        }

        private LensNextCameraState CaptureCamera()
        {
            var view = _document.CurrentViewpoint.ToViewpoint();
            return new LensNextCameraState
            {
                Position = Point(view.Position), Rotation = Rotation(view.Rotation), WorldUpVector = Point(view.WorldUpVector),
                Projection = view.Projection.ToString(),
                FocalDistance = OptionalPositiveCameraValue(() => view.FocalDistance),
                HorizontalExtentAtFocalDistance = OptionalPositiveCameraValue(() => view.HorizontalExtentAtFocalDistance),
                VerticalExtentAtFocalDistance = OptionalPositiveCameraValue(() => view.VerticalExtentAtFocalDistance)
            };
        }

        private static double? OptionalPositiveCameraValue(Func<double> read)
        {
            try
            {
                var value = read();
                return value > 0 && !double.IsNaN(value) && !double.IsInfinity(value) ? (double?)value : null;
            }
            catch (Exception)
            {
                // Navisworks intentionally leaves projection-specific camera values unset.
                return null;
            }
        }

        private void ApplyCamera(LensNextCameraState camera)
        {
            if (camera == null || camera.Position == null || camera.Rotation == null) throw new InvalidOperationException("Camera payload is incomplete.");
            var view = _document.CurrentViewpoint.ToViewpoint();
            view.Position = new Point3D(camera.Position.X, camera.Position.Y, camera.Position.Z);
            view.Rotation = new Rotation3D(camera.Rotation.A, camera.Rotation.B, camera.Rotation.C, camera.Rotation.D);
            if (camera.WorldUpVector != null) view.WorldUpVector = new UnitVector3D(camera.WorldUpVector.X, camera.WorldUpVector.Y, camera.WorldUpVector.Z);
            ViewpointProjection projection;
            if (!Enum.TryParse(camera.Projection, true, out projection)) throw new InvalidOperationException("Camera projection is unsupported: " + camera.Projection);
            view.Projection = projection;
            if (camera.FocalDistance.HasValue && camera.FocalDistance.Value > 0) view.FocalDistance = camera.FocalDistance.Value;
            _document.CurrentViewpoint.CopyFrom(view);
        }

        private sealed class SelectionCaptureResult
        {
            public List<LensNextElementReference> References = new List<LensNextElementReference>();
            public int TotalCount;
            public int Unresolved;
            public int Ambiguous;
            public int Capped;
            public bool Active => TotalCount > 0;
            public bool Truncated => Unresolved > 0 || Ambiguous > 0 || Capped > 0;
            public bool Complete => !Truncated;
        }
        private SelectionCaptureResult CaptureSelection(ScanResult scan)
        {
            var result = new SelectionCaptureResult();
            foreach (var item in _document.CurrentSelection.SelectedItems.Cast<ModelItem>())
            {
                result.TotalCount++;
                var record = scan.Records.FirstOrDefault(value => value.Item.Equals(item));
                if (record == null || record.Reference == null) { result.Unresolved++; continue; }
                if (record.Ambiguous) { result.Ambiguous++; continue; }
                if (result.References.Count >= LensNextVisualStateSchema.MaximumElementReferences) { result.Capped++; continue; }
                result.References.Add(record.Reference);
            }
            return result;
        }

        private sealed class ModelItemRecord
        {
            public Model Model;
            public LensNextModelReference ModelReference;
            public ModelItem Item;
            public List<int> Path;
            public LensNextStableCategoryId StableId;
            public LensNextSourceElementId SourceId;
            public LensNextElementReference Reference;
            public bool Ambiguous;
        }

        private sealed class ScanResult
        {
            public List<LensNextElementReference> Hidden = new List<LensNextElementReference>();
            public List<LensNextAppearanceOverride> Appearance = new List<LensNextAppearanceOverride>();
            public List<LensNextModelReference> Models = new List<LensNextModelReference>();
            public List<ModelItemRecord> Records = new List<ModelItemRecord>();
            public int ModelsVisited;
            public int Scanned;
            public int HiddenDetected;
            public int AppearanceDetected;
            public int VisibilityUnresolved;
            public int VisibilityAmbiguous;
            public int VisibilityCapped;
            public int AppearanceUnresolved;
            public int AppearanceAmbiguous;
            public int AppearanceCapped;
            public int AppearanceInspectionFailures;
            public int EnumerationFailures;
            public int ModelUnresolved;
            public int ModelAmbiguous;
            public bool VisibilityTruncated => VisibilityUnresolved > 0 || VisibilityAmbiguous > 0 || VisibilityCapped > 0;
            public bool AppearanceTruncated => AppearanceUnresolved > 0 || AppearanceAmbiguous > 0 || AppearanceCapped > 0 || AppearanceInspectionFailures > 0;
            public bool Truncated => VisibilityTruncated || AppearanceTruncated;
        }
        private ScanResult CaptureModelState()
        {
            var result = new ScanResult();
            foreach (Model model in _document.Models)
            {
                result.ModelsVisited++;
                var modelReference = ModelRef(model);
                if (modelReference == null || string.IsNullOrWhiteSpace(modelReference.ModelInstanceDiscriminator)) { result.ModelUnresolved++; continue; }
                result.Models.Add(modelReference);
                try
                {
                    CollectRecords(model, modelReference, model.RootItem, new List<int>(), result.Records);
                }
                catch { result.EnumerationFailures++; }
            }

            foreach (var group in result.Models.GroupBy(ModelReferenceKey, StringComparer.Ordinal))
                if (group.Count() > 1) result.ModelAmbiguous += group.Count();

            AssignDeterministicReferences(result.Records);
            foreach (var record in result.Records)
            {
                result.Scanned++;
                if (record.Item.IsHidden)
                {
                    result.HiddenDetected++;
                    StoreReference(record, result.Hidden, ref result.VisibilityUnresolved, ref result.VisibilityAmbiguous, ref result.VisibilityCapped);
                }
                LensNextAppearanceOverride appearance;
                bool inspectionFailed;
                if (TryAppearance(record.Item, record.Reference, out appearance, out inspectionFailed) && appearance != null)
                {
                    result.AppearanceDetected++;
                    if (record.Reference == null) result.AppearanceUnresolved++;
                    else if (record.Ambiguous) result.AppearanceAmbiguous++;
                    else if (result.Appearance.Count >= LensNextVisualStateSchema.MaximumElementReferences) result.AppearanceCapped++;
                    else result.Appearance.Add(appearance);
                }
                if (inspectionFailed) result.AppearanceInspectionFailures++;
            }
            return result;
        }

        private static void StoreReference(ModelItemRecord record, List<LensNextElementReference> destination, ref int unresolved, ref int ambiguous, ref int capped)
        {
            if (record.Reference == null) { unresolved++; return; }
            if (record.Ambiguous) { ambiguous++; return; }
            if (destination.Count >= LensNextVisualStateSchema.MaximumElementReferences) { capped++; return; }
            destination.Add(record.Reference);
        }

        private void CollectRecords(Model model, LensNextModelReference modelReference, ModelItem item, List<int> path, List<ModelItemRecord> records)
        {
            if (item == null) return;
            records.Add(new ModelItemRecord { Model = model, ModelReference = modelReference, Item = item, Path = new List<int>(path), StableId = StableCategoryId(item), SourceId = SourceElementId(item) });
            var index = 0;
            foreach (ModelItem child in item.Children)
            {
                path.Add(index++);
                CollectRecords(model, modelReference, child, path, records);
                path.RemoveAt(path.Count - 1);
            }
        }

        private static void AssignDeterministicReferences(List<ModelItemRecord> records)
        {
            foreach (var modelGroup in records.GroupBy(value => ModelReferenceKey(value.ModelReference), StringComparer.Ordinal))
            {
                var modelRecords = modelGroup.ToList();
                var modelAmbiguous = modelRecords.Select(value => value.Model).Distinct().Count() > 1;
                var guidCounts = modelRecords.Where(value => value.Item.InstanceGuid != Guid.Empty).GroupBy(value => value.Item.InstanceGuid).ToDictionary(value => value.Key, value => value.Count());
                var stableCounts = modelRecords.Where(value => value.StableId != null).GroupBy(value => StableIdKey(value.StableId), StringComparer.Ordinal).ToDictionary(value => value.Key, value => value.Count(), StringComparer.Ordinal);
                var sourceCounts = modelRecords.Where(value => value.SourceId != null).GroupBy(value => SourceIdKey(value.SourceId), StringComparer.Ordinal).ToDictionary(value => value.Key, value => value.Count(), StringComparer.Ordinal);
                foreach (var record in modelRecords)
                {
                    record.Ambiguous = modelAmbiguous;
                    if (record.Item.InstanceGuid != Guid.Empty && guidCounts[record.Item.InstanceGuid] == 1)
                        record.Reference = ElementReference(record, "instance-guid", "same-document-reopen");
                    else if (record.StableId != null && stableCounts[StableIdKey(record.StableId)] == 1)
                        record.Reference = ElementReference(record, "autodesk-stable-id", "source-version-stable");
                    else if (record.SourceId != null && sourceCounts[SourceIdKey(record.SourceId)] == 1)
                        record.Reference = ElementReference(record, "source-element-id", "source-version-stable");
                    else
                        record.Reference = ElementReference(record, "exact-tree-path", "same-document-reopen");
                }
            }
        }

        private static LensNextElementReference ElementReference(ModelItemRecord record, string strategy, string scope)
        {
            return new LensNextElementReference
            {
                ReferenceVersion = LensNextVisualStateSchema.ElementReferenceVersionV2,
                PersistenceScope = scope,
                Strategy = strategy,
                Model = record.ModelReference,
                InstanceGuid = strategy == "instance-guid" ? record.Item.InstanceGuid.ToString("D") : null,
                StableCategoryId = strategy == "autodesk-stable-id" ? record.StableId : null,
                SourceElementId = strategy == "source-element-id" ? record.SourceId : null,
                HierarchyIndexPath = strategy == "exact-tree-path" ? new List<int>(record.Path) : null,
                Confirmation = Confirmation(record.Item, record.StableId, record.SourceId),
                ModelSource = record.ModelReference.Source
            };
        }

        private static LensNextElementConfirmation Confirmation(ModelItem item, LensNextStableCategoryId stableId, LensNextSourceElementId sourceId)
        {
            var text = (item.ClassName ?? "") + "\u001f" + (item.DisplayName ?? "") + "\u001f" + StableIdKey(stableId) + "\u001f" + SourceIdKey(sourceId);
            return new LensNextElementConfirmation { ClassName = item.ClassName, DisplayName = item.DisplayName, StablePropertyFingerprint = "sha256:" + Sha256(Encoding.UTF8.GetBytes(text)) };
        }

        private static LensNextStableCategoryId StableCategoryId(ModelItem item)
        {
            try
            {
                foreach (PropertyCategory category in item.PropertyCategories)
                {
                    if (!category.HasStableId) continue;
                    if (category.HasInt64StableId) return new LensNextStableCategoryId { CategoryName = category.Name, ValueKind = "int64", Value = category.GetInt64StableId().ToString(CultureInfo.InvariantCulture) };
                    if (category.HasStringStableId) return new LensNextStableCategoryId { CategoryName = category.Name, ValueKind = "string", Value = category.GetStringStableId() };
                }
            }
            catch { }
            return null;
        }

        private static LensNextSourceElementId SourceElementId(ModelItem item)
        {
            try
            {
                foreach (PropertyCategory category in item.PropertyCategories)
                {
                    var categoryName = category.Name ?? "";
                    var sourceNamespace = categoryName.IndexOf("Revit", StringComparison.OrdinalIgnoreCase) >= 0 ? "revit" : categoryName.IndexOf("Ifc", StringComparison.OrdinalIgnoreCase) >= 0 ? "ifc" : null;
                    if (sourceNamespace == null) continue;
                    foreach (DataProperty property in category.Properties)
                    {
                        var propertyName = property.Name ?? "";
                        if (propertyName.IndexOf("Element", StringComparison.OrdinalIgnoreCase) < 0 && propertyName.IndexOf("Guid", StringComparison.OrdinalIgnoreCase) < 0) continue;
                        var value = property.Value;
                        if (value == null || value.IsNone) continue;
                        var text = value.IsIdentifierString ? value.ToIdentifierString() : value.IsDisplayString ? value.ToDisplayString() : value.IsInt32 ? value.ToInt32().ToString(CultureInfo.InvariantCulture) : null;
                        if (string.IsNullOrWhiteSpace(text)) continue;
                        return new LensNextSourceElementId { Namespace = sourceNamespace, CategoryName = categoryName, PropertyName = propertyName, ValueType = value.IsInt32 ? "int32" : "string", Value = text };
                    }
                }
            }
            catch { }
            return null;
        }

        private static string StableIdKey(LensNextStableCategoryId value) => value == null ? "" : (value.CategoryName ?? "") + "|" + (value.ValueKind ?? "") + "|" + (value.Value ?? "");
        private static string SourceIdKey(LensNextSourceElementId value) => value == null ? "" : (value.Namespace ?? "") + "|" + (value.CategoryName ?? "") + "|" + (value.PropertyName ?? "") + "|" + (value.ValueType ?? "") + "|" + (value.Value ?? "");

        private bool TryAppearance(ModelItem item, LensNextElementReference reference, out LensNextAppearanceOverride appearance, out bool inspectionFailed)
        {
            appearance = null;
            inspectionFailed = false;
            try
            {
                var geometry = item.Geometry; if (geometry == null) return true;
                var active = geometry.ActiveColor; var original = geometry.OriginalColor;
                var activeT = geometry.ActiveTransparency; var originalT = geometry.OriginalTransparency;
                var colorChanged = active.R != original.R || active.G != original.G || active.B != original.B;
                var transChanged = Math.Abs(activeT - originalT) > 0.000001;
                if (!colorChanged && !transChanged) return true;
                appearance = new LensNextAppearanceOverride { Element = reference, Red = colorChanged ? (byte?)active.R : null, Green = colorChanged ? (byte?)active.G : null, Blue = colorChanged ? (byte?)active.B : null, Transparency = transChanged ? (double?)activeT : null };
                return true;
            }
            catch { inspectionFailed = true; return false; }
        }

        private void ApplySelection(List<LensNextElementReference> references, Dictionary<string, List<ResolvedElementCandidate>> resolution)
        {
            var items = ResolveExact(references, true, resolution); _document.CurrentSelection.CopyFrom(items);
        }

        private void ApplyVisibility(List<LensNextElementReference> hidden, Dictionary<string, List<ResolvedElementCandidate>> resolution)
        {
            var items = ResolveExact(hidden, true, resolution);
            _document.Models.ResetAllHidden();
            if (items.Count > 0) _document.Models.SetHidden(items, true);
        }

        private void ApplyAppearance(List<LensNextAppearanceOverride> overrides, Dictionary<string, List<ResolvedElementCandidate>> resolution)
        {
            var resolved = new List<KeyValuePair<LensNextAppearanceOverride, ModelItem>>();
            foreach (var value in overrides ?? new List<LensNextAppearanceOverride>())
            {
                if (value == null || value.Element == null) continue;
                var items = ResolveExact(new List<LensNextElementReference> { value.Element }, true, resolution);
                if (items.Count != 1) throw new InvalidOperationException("Appearance override element could not be resolved exactly.");
                resolved.Add(new KeyValuePair<LensNextAppearanceOverride, ModelItem>(value, items[0]));
            }
            _document.Models.ResetAllPermanentMaterials();
            foreach (var group in resolved.Where(pair => pair.Key.Red.HasValue && pair.Key.Green.HasValue && pair.Key.Blue.HasValue)
                         .GroupBy(pair => pair.Key.Red.Value + ":" + pair.Key.Green.Value + ":" + pair.Key.Blue.Value))
            {
                var first = group.First().Key;
                var items = new ModelItemCollection();
                foreach (var pair in group) items.Add(pair.Value);
                _document.Models.OverridePermanentColor(items, Autodesk.Navisworks.Api.Color.FromByteRGB(first.Red.Value, first.Green.Value, first.Blue.Value));
            }
            foreach (var group in resolved.Where(pair => pair.Key.Transparency.HasValue).GroupBy(pair => pair.Key.Transparency.Value))
            {
                var items = new ModelItemCollection();
                foreach (var pair in group) items.Add(pair.Value);
                _document.Models.OverridePermanentTransparency(items, group.Key);
            }
        }

        private sealed class ResolvedElementCandidate { public ModelItem Item; }
        private static IEnumerable<LensNextElementReference> AllElementReferences(LensNextVisualState state)
        {
            if (state == null) return Enumerable.Empty<LensNextElementReference>();
            return (state.SelectedElements ?? new List<LensNextElementReference>())
                .Concat(state.HiddenElements ?? new List<LensNextElementReference>())
                .Concat((state.AppearanceOverrides ?? new List<LensNextAppearanceOverride>())
                    .Where(value => value != null && value.Element != null)
                    .Select(value => value.Element));
        }

        private void ValidateModelReferences(IEnumerable<LensNextModelReference> references)
        {
            var required = (references ?? Enumerable.Empty<LensNextModelReference>()).Where(value => value != null).ToList();
            var loaded = _document.Models.Cast<Model>().Select(ModelRef).ToList();
            foreach (var expected in required)
            {
                if (string.Equals(expected.ReferenceVersion, LensNextVisualStateSchema.ModelReferenceVersionV2, StringComparison.Ordinal))
                {
                    var exact = loaded.Where(actual => string.Equals(ModelReferenceKey(actual), ModelReferenceKey(expected), StringComparison.Ordinal)).ToList();
                    if (exact.Count == 0) throw new InvalidOperationException("A required v2 visual-state model reference is missing: " + (expected.ModelInstanceDiscriminator ?? expected.SourceFileNameNormalized));
                    if (exact.Count > 1) throw new InvalidOperationException("A required v2 visual-state model reference is ambiguous: " + (expected.ModelInstanceDiscriminator ?? expected.SourceFileNameNormalized));
                    continue;
                }
                if (string.IsNullOrWhiteSpace(expected.Source)) continue;
                var matches = loaded.Where(actual => string.Equals(actual.Source, expected.Source, StringComparison.OrdinalIgnoreCase)).ToList();
                if (matches.Count == 0) throw new InvalidOperationException("A required visual-state model reference is missing: " + expected.Source);
                if (!string.IsNullOrWhiteSpace(expected.ModelGuid) && !matches.Any(actual => string.Equals(actual.ModelGuid, expected.ModelGuid, StringComparison.OrdinalIgnoreCase)))
                    throw new InvalidOperationException("A required visual-state model GUID changed: " + expected.Source);
                if (!string.IsNullOrWhiteSpace(expected.TransformFingerprint) && !matches.Any(actual => string.Equals(actual.TransformFingerprint, expected.TransformFingerprint, StringComparison.OrdinalIgnoreCase)))
                    throw new InvalidOperationException("A required visual-state model transform changed: " + expected.Source);
            }
        }

        private static void LogApplyStage(string operationId, string stage, Stopwatch timer, string detail)
        {
            LensNextNativeLog.Info("Apply lifecycle. Stage=" + stage + " Request=" + operationId + " ElapsedMs=" + timer.ElapsedMilliseconds + (string.IsNullOrWhiteSpace(detail) ? "" : " " + detail));
        }

        private Dictionary<string, List<ResolvedElementCandidate>> BuildResolutionIndex(IEnumerable<LensNextElementReference> references)
        {
            var wanted = new HashSet<string>((references ?? Enumerable.Empty<LensNextElementReference>()).Where(value => value != null).Select(ElementReferenceKey), StringComparer.Ordinal);
            var candidates = new Dictionary<string, List<ResolvedElementCandidate>>(StringComparer.Ordinal);
            if (wanted.Count == 0) return candidates;
            foreach (Model model in _document.Models)
            {
                var modelReference = ModelRef(model);
                var records = new List<ModelItemRecord>();
                CollectRecords(model, modelReference, model.RootItem, new List<int>(), records);
                foreach (var record in records)
                {
                    var possible = new List<LensNextElementReference>();
                    if (record.Item.InstanceGuid != Guid.Empty) possible.Add(ElementReference(record, "instance-guid", "same-document-reopen"));
                    if (record.StableId != null) possible.Add(ElementReference(record, "autodesk-stable-id", "source-version-stable"));
                    if (record.SourceId != null) possible.Add(ElementReference(record, "source-element-id", "source-version-stable"));
                    possible.Add(ElementReference(record, "exact-tree-path", "same-document-reopen"));
                    if (record.Item.InstanceGuid != Guid.Empty) possible.Add(new LensNextElementReference { InstanceGuid = record.Item.InstanceGuid.ToString("D"), ModelSource = modelReference.Source });
                    foreach (var reference in possible)
                    {
                        var key = ElementReferenceKey(reference);
                        if (!wanted.Contains(key)) continue;
                        List<ResolvedElementCandidate> list;
                        if (!candidates.TryGetValue(key, out list)) { list = new List<ResolvedElementCandidate>(); candidates[key] = list; }
                        list.Add(new ResolvedElementCandidate { Item = record.Item });
                    }
                }
            }
            return candidates;
        }

        private ModelItemCollection ResolveExact(IEnumerable<LensNextElementReference> references, bool requireAll, Dictionary<string, List<ResolvedElementCandidate>> candidatesByKey)
        {
            var supplied = (references ?? Enumerable.Empty<LensNextElementReference>()).ToList();
            if (supplied.Any(value => value == null)) throw new InvalidOperationException("Visual-state element reference is null. Working view was blocked.");
            var requested = supplied.GroupBy(ElementReferenceKey, StringComparer.Ordinal).Select(group => group.First()).ToList();
            var result = new ModelItemCollection();
            if (requested.Count == 0) return result;

            foreach (var reference in requested)
            {
                var key = ElementReferenceKey(reference);
                List<ResolvedElementCandidate> candidates;
                if (!candidatesByKey.TryGetValue(key, out candidates)) candidates = new List<ResolvedElementCandidate>();
                if (candidates.Count > 1) throw new InvalidOperationException("Visual-state element identity is ambiguous in its authoritative model scope. Working view was blocked.");
                if (candidates.Count == 0)
                {
                    if (requireAll) throw new InvalidOperationException("A visual-state element identity is missing in the loaded model. Working view was blocked.");
                    continue;
                }
                if (string.Equals(reference.ReferenceVersion, LensNextVisualStateSchema.ElementReferenceVersionV2, StringComparison.Ordinal) && !ConfirmationMatches(reference.Confirmation, candidates[0].Item))
                    throw new InvalidOperationException("A visual-state element confirmation hint changed. Working view was blocked.");
                result.Add(candidates[0].Item);
            }
            return result;
        }

        private static bool ConfirmationMatches(LensNextElementConfirmation expected, ModelItem item)
        {
            if (expected == null) return true;
            if (!string.IsNullOrWhiteSpace(expected.ClassName) && !string.Equals(expected.ClassName, item.ClassName, StringComparison.Ordinal)) return false;
            if (!string.IsNullOrWhiteSpace(expected.DisplayName) && !string.Equals(expected.DisplayName, item.DisplayName, StringComparison.Ordinal)) return false;
            if (!string.IsNullOrWhiteSpace(expected.StablePropertyFingerprint))
            {
                var current = Confirmation(item, StableCategoryId(item), SourceElementId(item));
                if (!string.Equals(expected.StablePropertyFingerprint, current.StablePropertyFingerprint, StringComparison.Ordinal)) return false;
            }
            return true;
        }

        private static string ElementReferenceKey(LensNextElementReference value)
        {
            if (value == null) throw new InvalidOperationException("Visual-state element reference is required.");
            if (!string.Equals(value.ReferenceVersion, LensNextVisualStateSchema.ElementReferenceVersionV2, StringComparison.Ordinal))
            {
                Guid legacyGuid;
                if (!Guid.TryParse(value.InstanceGuid, out legacyGuid) || legacyGuid == Guid.Empty) throw new InvalidOperationException("Legacy visual-state element reference has no valid InstanceGuid.");
                return "legacy|" + (value.ModelSource ?? "").ToLowerInvariant() + "|" + legacyGuid.ToString("D");
            }
            var identity = value.Strategy == "instance-guid" ? NormalizeGuid(value.InstanceGuid) : value.Strategy == "autodesk-stable-id" ? StableIdKey(value.StableCategoryId) : value.Strategy == "source-element-id" ? SourceIdKey(value.SourceElementId) : value.Strategy == "exact-tree-path" ? ((value.HierarchyIndexPath == null || value.HierarchyIndexPath.Count == 0) ? "root" : string.Join("/", value.HierarchyIndexPath)) : null;
            if (string.IsNullOrWhiteSpace(identity)) throw new InvalidOperationException("Visual-state v2 element reference is incomplete.");
            return "v2|" + ModelReferenceKey(value.Model) + "|" + value.Strategy + "|" + identity;
        }

        private static string NormalizeGuid(string value) { Guid parsed; return Guid.TryParse(value, out parsed) && parsed != Guid.Empty ? parsed.ToString("D") : null; }

        private LensNextModelReference ModelRef(Model model)
        {
            if (model == null) return null;
            var source = ModelSource(model);
            var modelGuid = model.Guid == Guid.Empty ? null : model.Guid.ToString("D");
            var sourceGuid = model.SourceGuid == Guid.Empty ? null : model.SourceGuid.ToString("D");
            var sourceNormalized = NormalizeFileName(source);
            var currentNormalized = NormalizeFileName(_document.FileName);
            var transform = ReadTransformFingerprint(model);
            var discriminator = modelGuid == null ? "composite:" + Sha256(Encoding.UTF8.GetBytes((sourceGuid ?? "") + "\u001f" + (sourceNormalized ?? "") + "\u001f" + (currentNormalized ?? "") + "\u001f" + (transform ?? ""))) : "model-guid:" + modelGuid;
            return new LensNextModelReference { ReferenceVersion = LensNextVisualStateSchema.ModelReferenceVersionV2, Source = source, ModelGuid = modelGuid, SourceGuid = sourceGuid, SourceFileNameNormalized = sourceNormalized, CurrentFileNameNormalized = currentNormalized, TransformFingerprint = transform, ModelInstanceDiscriminator = discriminator };
        }
        private static string ModelSource(Model model)
        {
            if (model == null) return null;
            foreach (var name in new[] { "SourceFileName", "FileName", "DisplayName" }) { var p=model.GetType().GetProperty(name); var v=p?.GetValue(model,null); if (v is string && !string.IsNullOrWhiteSpace((string)v)) return (string)v; }
            return null;
        }
        private static string NormalizeFileName(string value) { return string.IsNullOrWhiteSpace(value) ? null : Path.GetFileName(value.Trim()).ToLowerInvariant(); }
        private static string ModelReferenceKey(LensNextModelReference value)
        {
            if (value == null) return "<null-model>";
            if (!string.Equals(value.ReferenceVersion, LensNextVisualStateSchema.ModelReferenceVersionV2, StringComparison.Ordinal)) return "legacy-model|" + (value.Source ?? "").ToLowerInvariant();
            return string.Join("\u001f", new[] { value.ReferenceVersion, NormalizeGuid(value.ModelGuid), NormalizeGuid(value.SourceGuid), value.SourceFileNameNormalized, value.CurrentFileNameNormalized, value.TransformFingerprint, value.ModelInstanceDiscriminator }.Select(token => token ?? "<null>"));
        }
        private static string ReadTransformFingerprint(Model model)
        {
            try
            {
                var transform = model.Transform;
                var tokens = new List<string>();
                for (var row = 0; row < 3; row++) for (var column = 0; column < 3; column++) tokens.Add(Float64Token(transform.Linear.Get(row, column)));
                tokens.Add(Float64Token(transform.Translation.X)); tokens.Add(Float64Token(transform.Translation.Y)); tokens.Add(Float64Token(transform.Translation.Z));
                return "m34:" + string.Join(",", tokens);
            }
            catch { return null; }
        }
        private static string Float64Token(double value) { var normalized = value == 0d ? 0d : value; return "f64:" + BitConverter.DoubleToInt64Bits(normalized).ToString("x16", CultureInfo.InvariantCulture); }

        private string TryGetCurrentViewJson(string methodName)
        {
            try
            {
                var current = _document.CurrentViewpoint; var method = current.GetType().GetMethods(BindingFlags.Instance | BindingFlags.Public).FirstOrDefault(m => m.Name == methodName && m.GetParameters().Length == 0);
                if (method == null) return null; var value = method.Invoke(current, null); if (value == null) return null; if (value is string) return (string)value;
                var json = _visualJson.Serialize(value); return string.IsNullOrWhiteSpace(json) || json == "{}" ? null : json;
            }
            catch { return null; }
        }
        private string TryGetSectioningJson()
        {
            try
            {
                var activeViewProperty = _document.GetType().GetProperty("ActiveView", BindingFlags.Instance | BindingFlags.Public);
                var activeView = activeViewProperty == null ? null : activeViewProperty.GetValue(_document, null);
                if (activeView != null)
                {
                    foreach (var methodName in new[] { "GetClippingPlanes", "GetClipPlaneSet" })
                    {
                        var method = activeView.GetType().GetMethods(BindingFlags.Instance | BindingFlags.Public).FirstOrDefault(m => m.Name == methodName && m.GetParameters().Length == 0);
                        if (method == null) continue;
                        var value = method.Invoke(activeView, null);
                        if (value == null) continue;
                        if (value is string) return (string)value;
                        var json = _visualJson.Serialize(value);
                        if (!string.IsNullOrWhiteSpace(json) && json != "{}") return json;
                    }
                }
            }
            catch { }
            return TryGetCurrentViewJson("GetClippingPlanes") ?? TryGetCurrentViewJson("GetClipPlaneSet");
        }
        private bool HasSectioningSetter()
        {
            try
            {
                var activeViewProperty = _document.GetType().GetProperty("ActiveView", BindingFlags.Instance | BindingFlags.Public);
                var activeView = activeViewProperty == null ? null : activeViewProperty.GetValue(_document, null);
                if (activeView != null && activeView.GetType().GetMethods(BindingFlags.Instance | BindingFlags.Public).Any(m => (m.Name == "SetClippingPlanes" || m.Name == "SetClipPlaneSet") && m.GetParameters().Length == 1 && m.GetParameters()[0].ParameterType == typeof(string))) return true;
            }
            catch { }
            return HasCurrentViewMethod("SetClippingPlanes") || HasCurrentViewMethod("SetClipPlaneSet");
        }
        private void InvokeSectioningSetter(string json)
        {
            try
            {
                var activeViewProperty = _document.GetType().GetProperty("ActiveView", BindingFlags.Instance | BindingFlags.Public);
                var activeView = activeViewProperty == null ? null : activeViewProperty.GetValue(_document, null);
                if (activeView != null)
                {
                    var method = activeView.GetType().GetMethods(BindingFlags.Instance | BindingFlags.Public).FirstOrDefault(m => (m.Name == "SetClippingPlanes" || m.Name == "SetClipPlaneSet") && m.GetParameters().Length == 1 && m.GetParameters()[0].ParameterType == typeof(string));
                    if (method != null) { var result = method.Invoke(activeView, new object[] { json }); if (result is bool && !(bool)result) throw new InvalidOperationException(method.Name + " rejected the payload."); return; }
                }
            }
            catch (TargetInvocationException ex) { throw new InvalidOperationException("Navisworks sectioning apply failed.", ex.InnerException ?? ex); }
            if (HasCurrentViewMethod("SetClippingPlanes")) { InvokeCurrentViewStringSetter("SetClippingPlanes", json); return; }
            InvokeCurrentViewStringSetter("SetClipPlaneSet", json);
        }
        private bool HasCurrentViewMethod(string name) { return _document.CurrentViewpoint.GetType().GetMethods(BindingFlags.Instance | BindingFlags.Public).Any(m => m.Name == name); }
        private void InvokeCurrentViewStringSetter(string name, string json)
        {
            var current = _document.CurrentViewpoint;
            var method = current.GetType().GetMethods(BindingFlags.Instance | BindingFlags.Public).FirstOrDefault(m => m.Name == name && m.GetParameters().Length == 1 && m.GetParameters()[0].ParameterType == typeof(string));
            if (method == null) throw new NotSupportedException(name + " is not exposed as a JSON/string setter by this Navisworks build.");
            var result = method.Invoke(current, new object[] { json }); if (result is bool && !(bool)result) throw new InvalidOperationException(name + " rejected the payload.");
        }
        private bool HasCurrentSavedViewpointRedlines()
        {
            try { var saved=_document.SavedViewpoints.CurrentSavedViewpoint as SavedViewpoint; if(saved==null)return false; var p=saved.GetType().GetProperty("ContainsRedlines") ?? saved.GetType().GetProperty("HasRedlines"); var v=p?.GetValue(saved,null); return v is bool && (bool)v; } catch { return false; }
        }

        private sealed class ScreenshotResult { public string DataUrl; public string Sha256; }
        private ScreenshotResult CaptureScreenshot()
        {
            try
            {
                var handle = NavisworksApplication.Gui.MainWindow.Handle; RECT rect; if (!GetWindowRect(handle, out rect)) return new ScreenshotResult();
                var width=Math.Max(1, rect.Right-rect.Left); var height=Math.Max(1, rect.Bottom-rect.Top);
                using(var raw=new Bitmap(width,height,PixelFormat.Format24bppRgb))
                using(var g=System.Drawing.Graphics.FromImage(raw))
                { g.CopyFromScreen(rect.Left,rect.Top,0,0,new Size(width,height),CopyPixelOperation.SourceCopy); var scale=Math.Min(1.0, Math.Min(1280.0/width,720.0/height)); var w=Math.Max(1,(int)Math.Round(width*scale)); var h=Math.Max(1,(int)Math.Round(height*scale)); using(var resized=new Bitmap(raw,w,h)) using(var ms=new MemoryStream()){SaveJpeg(resized,ms,70L); var bytes=ms.ToArray(); return new ScreenshotResult{DataUrl="data:image/jpeg;base64,"+Convert.ToBase64String(bytes),Sha256=Sha256(bytes)};}}
            }
            catch { return new ScreenshotResult(); }
        }
        private static void SaveJpeg(Image image, Stream stream, long quality) { var codec=ImageCodecInfo.GetImageEncoders().First(x=>x.MimeType=="image/jpeg"); using(var p=new EncoderParameters(1)){p.Param[0]=new EncoderParameter(System.Drawing.Imaging.Encoder.Quality,quality); image.Save(stream,codec,p);} }
        private static string Sha256(byte[] bytes) { using(var sha=SHA256.Create()){return string.Concat(sha.ComputeHash(bytes).Select(x=>x.ToString("x2",CultureInfo.InvariantCulture)));} }
        [StructLayout(LayoutKind.Sequential)] private struct RECT { public int Left,Top,Right,Bottom; }
        [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr hWnd,out RECT rect);

        private static LensNextPointState Point(Point3D p) => new LensNextPointState { X=p.X,Y=p.Y,Z=p.Z };
        private static LensNextPointState Point(UnitVector3D p) => new LensNextPointState { X=p.X,Y=p.Y,Z=p.Z };
        private static LensNextRotationState Rotation(Rotation3D r) => new LensNextRotationState { A=r.A,B=r.B,C=r.C,D=r.D };
        private static int Positive(string value,string label){int parsed;if(!int.TryParse(value,out parsed)||parsed<=0)throw new InvalidOperationException(label+" must be positive.");return parsed;}
        private static LensNextVisualCompleteness NewCompleteness()
        {
            return new LensNextVisualCompleteness
            {
                Camera=Component(true,false), Selection=Component(true,false), Visibility=Component(true,false), Sectioning=Component(false,false),
                AppearanceOverrides=Component(true,false), Redlines=Component(false,false), Screenshot=Component(true,false), ModelReferences=Component(true,false)
            };
        }
        private static LensNextVisualComponentState Component(bool supported,bool required) => new LensNextVisualComponentState{Supported=supported,Captured=false,RequiredForReconstruction=required};
        private static void Configure(LensNextVisualComponentState component, bool active, bool supported, bool complete, bool truncated, int? count, string status, string message)
        {
            component.Active = active;
            component.RequiredForReconstruction = active;
            component.Supported = supported;
            component.Captured = complete;
            component.Complete = complete;
            component.Truncated = truncated;
            component.Count = count;
            component.Status = status;
            component.Message = message;
        }
        private static void PopulateMetrics(
            LensNextVisualComponentState component,
            int itemsVisited,
            int activeItemsDetected,
            IEnumerable<LensNextElementReference> references,
            int unresolved,
            int ambiguous,
            int capped,
            int enumerationFailures,
            int inspectionFailures,
            long elapsedMs)
        {
            var stored = (references ?? Enumerable.Empty<LensNextElementReference>()).Where(value => value != null).ToList();
            component.ItemsVisited = itemsVisited;
            component.ActiveItemsDetected = activeItemsDetected;
            component.ReferencesStored = stored.Count;
            component.InstanceGuidReferences = stored.Count(value => string.Equals(value.Strategy, "instance-guid", StringComparison.Ordinal));
            component.FallbackReferences = stored.Count(value => !string.IsNullOrWhiteSpace(value.Strategy) && !string.Equals(value.Strategy, "instance-guid", StringComparison.Ordinal));
            component.UnresolvedReferences = unresolved;
            component.AmbiguousReferences = ambiguous;
            component.CappedReferences = capped;
            component.EnumerationFailures = enumerationFailures;
            component.InspectionFailures = inspectionFailures;
            component.Reason = component.Message;
            component.ElapsedMs = elapsedMs;
        }
        private static void LogCaptureMetrics(string requestId, string componentName, LensNextVisualComponentState component)
        {
            LensNextNativeLog.Info(
                "Capture metrics. Request=" + requestId +
                " Component=" + componentName +
                " ItemsVisited=" + component.ItemsVisited +
                " ActiveItemsDetected=" + component.ActiveItemsDetected +
                " ReferencesStored=" + component.ReferencesStored +
                " InstanceGuidReferences=" + component.InstanceGuidReferences +
                " FallbackReferences=" + component.FallbackReferences +
                " UnresolvedReferences=" + component.UnresolvedReferences +
                " AmbiguousReferences=" + component.AmbiguousReferences +
                " CappedReferences=" + component.CappedReferences +
                " EnumerationFailures=" + component.EnumerationFailures +
                " InspectionFailures=" + component.InspectionFailures +
                " Complete=" + component.Complete +
                " Truncated=" + component.Truncated +
                " Reason=" + component.Reason +
                " ElapsedMs=" + component.ElapsedMs);
        }
        private static string ValidateState(ImmutableWorkingViewIdentity identity,LensNextVisualState state)
        {
            if(state==null)return "Visual state is required."; if(state.SchemaVersion!=LensNextVisualStateSchema.Version)return "Visual-state schema version is unsupported.";
            if(state.ProjectId!=Positive(identity.ProjectId,"projectId")||state.ServerId!=Positive(identity.ServerId,"serverId")||state.ViewpointId!=identity.ViewpointId||state.LifecycleStatus!=identity.LifecycleStatus||state.RevisionNumber!=Positive(identity.RevisionNumber,"revisionNumber"))return "Visual-state immutable identity does not match the requested issue.";
            if(!string.Equals(state.ModelFingerprint,identity.ModelFingerprint,StringComparison.Ordinal))return "Visual state was captured against a different model fingerprint.";
            var digest=LensNextVisualStateDigest.Compute(state);
            if(!string.IsNullOrWhiteSpace(state.DigestSha256)&&!string.Equals(state.DigestSha256,digest,StringComparison.OrdinalIgnoreCase))
            {
                var diagnostics=LensNextVisualStateDigest.Diagnose(state,state.DigestDiagnostics!=null&&state.DigestDiagnostics.Truncated);
                LensNextNativeLog.Error(
                    "Visual-state digest validation failed. Received="+state.DigestSha256+
                    " Recomputed="+digest+
                    " CanonicalLength="+diagnostics.CanonicalLength+
                    " FirstMismatchField="+FirstCanonicalMismatchField(state,diagnostics.CanonicalInputBase64)+
                    " Contract="+diagnostics.ContractVersion+
                    " Project="+state.ProjectId+
                    " Viewpoint="+state.ViewpointId,
                    null);
                return "Visual-state digest validation failed.";
            }
            return null;
        }
        private static string FirstCanonicalMismatchField(LensNextVisualState state,string recomputedBase64)
        {
            try
            {
                var received=state.DigestDiagnostics==null?null:state.DigestDiagnostics.CanonicalInputBase64;
                if(string.IsNullOrWhiteSpace(received))return "canonical-input-unavailable";
                var left=Encoding.UTF8.GetString(Convert.FromBase64String(received)).Split('\u001f');
                var right=Encoding.UTF8.GetString(Convert.FromBase64String(recomputedBase64)).Split('\u001f');
                var labels=CanonicalFieldLabels(state);
                var count=Math.Max(left.Length,right.Length);
                for(var index=0;index<count;index++)
                {
                    var a=index<left.Length?left[index]:"<missing>";
                    var b=index<right.Length?right[index]:"<missing>";
                    if(!string.Equals(a,b,StringComparison.Ordinal))return index<labels.Count?labels[index]:"canonical-token["+index+"]";
                }
                return "digest-only";
            }
            catch(Exception exception){return "diagnostic-error:"+exception.GetType().Name;}
        }
        private static List<string> CanonicalFieldLabels(LensNextVisualState state)
        {
            var labels=new List<string>{"schemaVersion","projectId","serverId","viewpointId","lifecycleStatus","revisionNumber","modelFingerprint"};
            if(state.Camera==null)labels.Add("camera");
            else
            {
                AddPointLabels(labels,"camera.position",state.Camera.Position);
                AddRotationLabels(labels,"camera.rotation",state.Camera.Rotation);
                AddPointLabels(labels,"camera.worldUpVector",state.Camera.WorldUpVector);
                labels.AddRange(new[]{"camera.projection","camera.focalDistance","camera.horizontalExtentAtFocalDistance","camera.verticalExtentAtFocalDistance"});
            }
            var selected=(state.SelectedElements??new List<LensNextElementReference>()).OrderBy(ElementKey,StringComparer.Ordinal).ToList();
            for(var i=0;i<selected.Count;i++)AddElementLabels(labels,"selected["+i+"]");
            var hidden=(state.HiddenElements??new List<LensNextElementReference>()).OrderBy(ElementKey,StringComparer.Ordinal).ToList();
            for(var i=0;i<hidden.Count;i++)AddElementLabels(labels,"hidden["+i+"]");
            var appearance=(state.AppearanceOverrides??new List<LensNextAppearanceOverride>()).OrderBy(item=>ElementKey(item==null?null:item.Element),StringComparer.Ordinal).ToList();
            for(var i=0;i<appearance.Count;i++){AddElementLabels(labels,"appearance["+i+"].element");labels.AddRange(new[]{"appearance["+i+"].red","appearance["+i+"].green","appearance["+i+"].blue","appearance["+i+"].transparency"});}
            var models=(state.ModelReferences??new List<LensNextModelReference>()).OrderBy(model=>model==null?"":model.Source,StringComparer.Ordinal).ToList();
            for(var i=0;i<models.Count;i++)labels.AddRange(new[]{"models["+i+"].source","models["+i+"].modelGuid","models["+i+"].transformFingerprint"});
            labels.AddRange(new[]{"sectioningJson","redlinesJson","screenshotSha256"});
            return labels;
        }
        private static string ElementKey(LensNextElementReference item){return item==null?"":(item.ModelSource??"")+"|"+(item.InstanceGuid??"");}
        private static void AddElementLabels(List<string> labels,string prefix){labels.AddRange(new[]{prefix+".kind",prefix+".modelSource",prefix+".instanceGuid"});}
        private static void AddPointLabels(List<string> labels,string prefix,LensNextPointState point){if(point==null)labels.Add(prefix);else labels.AddRange(new[]{prefix+".x",prefix+".y",prefix+".z"});}
        private static void AddRotationLabels(List<string> labels,string prefix,LensNextRotationState rotation){if(rotation==null)labels.Add(prefix);else labels.AddRange(new[]{prefix+".a",prefix+".b",prefix+".c",prefix+".d"});}
        private static LensNextVisualApplyResult Failed(string message,bool attempted,bool succeeded)=>new LensNextVisualApplyResult{Applied=false,Message=message,RollbackAttempted=attempted,RollbackSucceeded=succeeded};
    }
}
