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
using System.Web.Script.Serialization;
using Autodesk.Navisworks.Api;
using NavisworksApplication = Autodesk.Navisworks.Api.Application;

namespace BIMLogLensNext.Native
{
    public sealed partial class AutodeskLensNextReadOnlyAdapter
    {
        private readonly JavaScriptSerializer _visualJson = new JavaScriptSerializer { MaxJsonLength = 16 * 1024 * 1024 };

        public LensNextVisualState CaptureCurrentVisualState(ImmutableWorkingViewIdentity identity, bool includeScreenshot)
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
            Mark(state.Completeness.Camera, state.Camera != null, state.Camera != null ? "Exact active camera captured." : "Camera unavailable.");

            state.SelectedElements = CaptureSelection();
            LensNextNativeLog.Info("Visual capture selection complete. Count=" + state.SelectedElements.Count + " ElapsedMs=" + captureTimer.ElapsedMilliseconds);
            Mark(state.Completeness.Selection, true, "Current selection captured by immutable model-item references.");

            var scan = CaptureModelState();
            LensNextNativeLog.Info("Visual capture model scan complete. Hidden=" + scan.Hidden.Count + " Appearance=" + scan.Appearance.Count + " Models=" + scan.Models.Count + " Truncated=" + scan.Truncated + " ElapsedMs=" + captureTimer.ElapsedMilliseconds);
            state.HiddenElements = scan.Hidden;
            state.AppearanceOverrides = scan.Appearance;
            state.ModelReferences = scan.Models;
            Mark(state.Completeness.Visibility, !scan.Truncated, scan.Truncated ? "Model scan exceeded the bounded capture limit; visibility is incomplete." : "Hidden-element state captured.");
            Mark(state.Completeness.AppearanceOverrides, !scan.Truncated, scan.Truncated ? "Appearance scan exceeded the bounded capture limit." : "Active color/transparency overrides captured where different from original appearance.");
            Mark(state.Completeness.ModelReferences, true, "Model/reference context captured.");

            state.SectioningJson = TryGetSectioningJson();
            var sectionSetterAvailable = HasSectioningSetter();
            state.Completeness.Sectioning.RequiredForReconstruction = !string.IsNullOrWhiteSpace(state.SectioningJson);
            state.Completeness.Sectioning.Supported = !state.Completeness.Sectioning.RequiredForReconstruction || sectionSetterAvailable;
            state.Completeness.Sectioning.Captured = !state.Completeness.Sectioning.RequiredForReconstruction || !string.IsNullOrWhiteSpace(state.SectioningJson);
            state.Completeness.Sectioning.Message = !string.IsNullOrWhiteSpace(state.SectioningJson)
                ? (sectionSetterAvailable ? "Sectioning payload captured and can be reapplied." : "Sectioning was captured but this Navisworks API does not expose a safe setter; reconstruction will block.")
                : "No active sectioning payload is required for this working view.";

            var hasSavedRedlines = HasCurrentSavedViewpointRedlines();
            state.RedlinesJson = TryGetCurrentViewJson("GetRedlines");
            var redlineSetterAvailable = HasCurrentViewMethod("SetRedlines");
            state.Completeness.Redlines.RequiredForReconstruction = hasSavedRedlines;
            state.Completeness.Redlines.Supported = !hasSavedRedlines || (!string.IsNullOrWhiteSpace(state.RedlinesJson) && redlineSetterAvailable);
            state.Completeness.Redlines.Captured = !hasSavedRedlines || !string.IsNullOrWhiteSpace(state.RedlinesJson);
            state.Completeness.Redlines.Message = hasSavedRedlines
                ? (!string.IsNullOrWhiteSpace(state.RedlinesJson) && redlineSetterAvailable ? "Redline payload captured and can be reapplied." : "Existing saved-viewpoint redlines cannot be safely reconstructed as a temporary Working View; operation will block rather than guess.")
                : "No redlines are required for this temporary working view.";

            if (includeScreenshot)
            {
                var shot = CaptureScreenshot();
                state.ScreenshotDataUrl = shot.DataUrl; state.ScreenshotSha256 = shot.Sha256;
                Mark(state.Completeness.Screenshot, !string.IsNullOrWhiteSpace(shot.DataUrl), string.IsNullOrWhiteSpace(shot.DataUrl) ? "Screenshot capture failed." : "Navisworks window screenshot captured.");
            }
            else
            {
                state.Completeness.Screenshot.Supported = true; state.Completeness.Screenshot.Captured = false;
                state.Completeness.Screenshot.RequiredForReconstruction = false; state.Completeness.Screenshot.Message = "Screenshot omitted by request.";
            }

            state.DigestSha256 = LensNextVisualStateDigest.Compute(state);
            state.DigestDiagnostics = LensNextVisualStateDigest.Diagnose(state, scan.Truncated);
            LensNextNativeLog.Info(
                "Visual digest diagnostics. Algorithm=" + state.DigestDiagnostics.Algorithm +
                " Contract=" + state.DigestDiagnostics.ContractVersion +
                " Computed=" + state.DigestDiagnostics.ComputedDigest +
                " Truncated=" + state.DigestDiagnostics.Truncated +
                " CanonicalLength=" + state.DigestDiagnostics.CanonicalLength +
                " CanonicalInputBase64=" + state.DigestDiagnostics.CanonicalInputBase64);
            LensNextNativeLog.Info("Visual capture complete. ElapsedMs=" + captureTimer.ElapsedMilliseconds);
            return state;
        }

        public LensNextVisualApplyResult ApplyWorkingVisualStateJson(ImmutableWorkingViewIdentity identity, string visualStateJson)
        {
            EnsureSameDocument();
            if (!_contract.MatchesContext(identity)) return Failed("Model/project context mismatch.", false, false);
            LensNextVisualState state;
            try { state = _visualJson.Deserialize<LensNextVisualState>(visualStateJson); }
            catch (Exception ex) { return Failed("Visual-state JSON is invalid: " + ex.Message, false, false); }
            var contractError = ValidateState(identity, state);
            if (contractError != null) return Failed(contractError, false, false);
            if (state.Completeness != null && !state.Completeness.CanReconstructWithoutGuessing)
                return Failed("Visual state declares a required component incomplete or unsupported; Lens Next will not guess.", false, false);

            LensNextVisualState rollback = null;
            try { rollback = CaptureCurrentVisualState(identity, false); } catch { }
            var applied = new List<string>();
            try
            {
                ApplyCamera(state.Camera); applied.Add("camera");
                ApplySelection(state.SelectedElements); applied.Add("selection");
                ApplyVisibility(state.HiddenElements); applied.Add("visibility");
                ApplyAppearance(state.AppearanceOverrides); applied.Add("appearanceOverrides");
                if (!string.IsNullOrWhiteSpace(state.SectioningJson)) { InvokeSectioningSetter(state.SectioningJson); applied.Add("sectioning"); }
                if (!string.IsNullOrWhiteSpace(state.RedlinesJson)) { InvokeCurrentViewStringSetter("SetRedlines", state.RedlinesJson); applied.Add("redlines"); }
                return new LensNextVisualApplyResult { Applied = true, Message = "Temporary BIMLog working view reconstructed without creating a SavedViewpoint.", AppliedComponents = applied };
            }
            catch (Exception ex)
            {
                var rollbackSucceeded = false;
                if (rollback != null)
                {
                    try
                    {
                        ApplyCamera(rollback.Camera); ApplySelection(rollback.SelectedElements); ApplyVisibility(rollback.HiddenElements); ApplyAppearance(rollback.AppearanceOverrides);
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

        private List<LensNextElementReference> CaptureSelection()
        {
            return _document.CurrentSelection.SelectedItems.Cast<ModelItem>().Select(Element).Where(item => item != null).Take(LensNextVisualStateSchema.MaximumElementReferences).ToList();
        }

        private sealed class ScanResult { public List<LensNextElementReference> Hidden = new List<LensNextElementReference>(); public List<LensNextAppearanceOverride> Appearance = new List<LensNextAppearanceOverride>(); public List<LensNextModelReference> Models = new List<LensNextModelReference>(); public bool Truncated; }
        private ScanResult CaptureModelState()
        {
            var result = new ScanResult(); var scanned = 0;
            foreach (Model model in _document.Models)
            {
                result.Models.Add(ModelRef(model));
                foreach (var item in Descendants(model.RootItem))
                {
                    scanned++; if (scanned > LensNextVisualStateSchema.MaximumScannedElements) { result.Truncated = true; return result; }
                    var reference = Element(item); if (reference == null) continue;
                    if (item.IsHidden && result.Hidden.Count < LensNextVisualStateSchema.MaximumElementReferences) result.Hidden.Add(reference);
                    var appearance = Appearance(item, reference);
                    if (appearance != null && result.Appearance.Count < LensNextVisualStateSchema.MaximumElementReferences) result.Appearance.Add(appearance);
                }
            }
            return result;
        }

        private IEnumerable<ModelItem> Descendants(ModelItem root)
        {
            if (root == null) yield break;
            var prop = root.GetType().GetProperty("DescendantsAndSelf", BindingFlags.Instance | BindingFlags.Public);
            var enumerable = prop == null ? null : prop.GetValue(root, null) as IEnumerable;
            if (enumerable != null) { foreach (var value in enumerable) if (value is ModelItem) yield return (ModelItem)value; yield break; }
            yield return root;
            foreach (ModelItem child in root.Children) foreach (var descendant in Descendants(child)) yield return descendant;
        }

        private LensNextAppearanceOverride Appearance(ModelItem item, LensNextElementReference reference)
        {
            try
            {
                var geometry = item.Geometry; if (geometry == null) return null;
                var active = geometry.ActiveColor; var original = geometry.OriginalColor;
                var activeT = geometry.ActiveTransparency; var originalT = geometry.OriginalTransparency;
                var colorChanged = active.R != original.R || active.G != original.G || active.B != original.B;
                var transChanged = Math.Abs(activeT - originalT) > 0.000001;
                if (!colorChanged && !transChanged) return null;
                return new LensNextAppearanceOverride { Element = reference, Red = colorChanged ? (byte?)active.R : null, Green = colorChanged ? (byte?)active.G : null, Blue = colorChanged ? (byte?)active.B : null, Transparency = transChanged ? (double?)activeT : null };
            }
            catch { return null; }
        }

        private void ApplySelection(List<LensNextElementReference> references)
        {
            var items = ResolveExact(references, false); _document.CurrentSelection.CopyFrom(items);
        }

        private void ApplyVisibility(List<LensNextElementReference> hidden)
        {
            _document.Models.ResetAllHidden();
            var items = ResolveExact(hidden, true); if (items.Count > 0) _document.Models.SetHidden(items, true);
        }

        private void ApplyAppearance(List<LensNextAppearanceOverride> overrides)
        {
            _document.Models.ResetAllPermanentMaterials();
            foreach (var value in overrides ?? new List<LensNextAppearanceOverride>())
            {
                if (value == null || value.Element == null) continue;
                var items = ResolveExact(new List<LensNextElementReference> { value.Element }, true);
                if (items.Count != 1) throw new InvalidOperationException("Appearance override element could not be resolved exactly.");
                if (value.Red.HasValue && value.Green.HasValue && value.Blue.HasValue)
                    _document.Models.OverridePermanentColor(items, Autodesk.Navisworks.Api.Color.FromByteRGB(value.Red.Value, value.Green.Value, value.Blue.Value));
                if (value.Transparency.HasValue) _document.Models.OverridePermanentTransparency(items, value.Transparency.Value);
            }
        }

        private sealed class ResolvedElementCandidate { public ModelItem Item; public string ModelSource; }
        private ModelItemCollection ResolveExact(IEnumerable<LensNextElementReference> references, bool requireAll)
        {
            var requested = (references ?? Enumerable.Empty<LensNextElementReference>())
                .Where(value => value != null && Guid.TryParse(value.InstanceGuid, out _))
                .GroupBy(value => (value.ModelSource ?? "") + "|" + value.InstanceGuid, StringComparer.OrdinalIgnoreCase)
                .Select(group => group.First()).ToList();
            var result = new ModelItemCollection();
            if (requested.Count == 0) return result;

            var wantedGuids = new HashSet<string>(requested.Select(value => Guid.Parse(value.InstanceGuid).ToString("D")), StringComparer.OrdinalIgnoreCase);
            var candidatesByGuid = new Dictionary<string, List<ResolvedElementCandidate>>(StringComparer.OrdinalIgnoreCase);
            foreach (Model model in _document.Models)
            {
                var source = ModelSource(model);
                foreach (var item in Descendants(model.RootItem))
                {
                    var guid = item.InstanceGuid;
                    if (guid == Guid.Empty) continue;
                    var key = guid.ToString("D");
                    if (!wantedGuids.Contains(key)) continue;
                    List<ResolvedElementCandidate> list;
                    if (!candidatesByGuid.TryGetValue(key, out list)) { list = new List<ResolvedElementCandidate>(); candidatesByGuid[key] = list; }
                    list.Add(new ResolvedElementCandidate { Item = item, ModelSource = source });
                }
            }

            foreach (var reference in requested)
            {
                var guid = Guid.Parse(reference.InstanceGuid).ToString("D");
                List<ResolvedElementCandidate> candidates;
                if (!candidatesByGuid.TryGetValue(guid, out candidates)) candidates = new List<ResolvedElementCandidate>();
                var matches = string.IsNullOrWhiteSpace(reference.ModelSource)
                    ? candidates
                    : candidates.Where(candidate => string.Equals(candidate.ModelSource, reference.ModelSource, StringComparison.OrdinalIgnoreCase)).ToList();
                if (matches.Count > 1) throw new InvalidOperationException("Visual-state element identity is ambiguous across the loaded models. Working view was blocked.");
                if (matches.Count == 0)
                {
                    if (requireAll) throw new InvalidOperationException("A visual-state element identity is missing in the loaded model. Working view was blocked.");
                    continue;
                }
                result.Add(matches[0].Item);
            }
            return result;
        }

        private LensNextElementReference Element(ModelItem item)
        {
            if (item == null || item.InstanceGuid == Guid.Empty) return null;
            return new LensNextElementReference { InstanceGuid = item.InstanceGuid.ToString("D"), ModelSource = ItemModelSource(item) };
        }
        private string ItemModelSource(ModelItem item)
        {
            try { var model = item.GetType().GetProperty("Model", BindingFlags.Instance | BindingFlags.Public)?.GetValue(item, null) as Model; return ModelSource(model); } catch { return null; }
        }
        private LensNextModelReference ModelRef(Model model)
        {
            return new LensNextModelReference { Source = ModelSource(model), ModelGuid = ReadGuid(model), TransformFingerprint = ReadTransformFingerprint(model) };
        }
        private static string ModelSource(Model model)
        {
            if (model == null) return null;
            foreach (var name in new[] { "SourceFileName", "FileName", "DisplayName" }) { var p=model.GetType().GetProperty(name); var v=p?.GetValue(model,null); if (v is string && !string.IsNullOrWhiteSpace((string)v)) return (string)v; }
            return null;
        }
        private static string ReadGuid(object value) { if (value == null) return null; foreach (var name in new[] { "Guid", "InstanceGuid" }) { var p=value.GetType().GetProperty(name); var v=p?.GetValue(value,null); if (v is Guid && (Guid)v != Guid.Empty) return ((Guid)v).ToString("D"); } return null; }
        private static string ReadTransformFingerprint(object value)
        {
            try { var p=value.GetType().GetProperty("Transform") ?? value.GetType().GetProperty("RootItemTransform"); var v=p?.GetValue(value,null); if (v == null) return null; using(var sha=SHA256.Create()){var b=sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(v.ToString())); return string.Concat(b.Select(x=>x.ToString("x2", CultureInfo.InvariantCulture)));} } catch { return null; }
        }

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
                Camera=Component(true,true), Selection=Component(true,true), Visibility=Component(true,true), Sectioning=Component(false,true),
                AppearanceOverrides=Component(true,true), Redlines=Component(false,true), Screenshot=Component(true,false), ModelReferences=Component(true,true)
            };
        }
        private static LensNextVisualComponentState Component(bool supported,bool required) => new LensNextVisualComponentState{Supported=supported,Captured=false,RequiredForReconstruction=required};
        private static void Mark(LensNextVisualComponentState c,bool captured,string message){c.Supported=true;c.Captured=captured;c.Message=message;}
        private static string ValidateState(ImmutableWorkingViewIdentity identity,LensNextVisualState state)
        {
            if(state==null)return "Visual state is required."; if(state.SchemaVersion!=LensNextVisualStateSchema.Version)return "Visual-state schema version is unsupported.";
            if(state.ProjectId!=Positive(identity.ProjectId,"projectId")||state.ServerId!=Positive(identity.ServerId,"serverId")||state.ViewpointId!=identity.ViewpointId||state.LifecycleStatus!=identity.LifecycleStatus||state.RevisionNumber!=Positive(identity.RevisionNumber,"revisionNumber"))return "Visual-state immutable identity does not match the requested issue.";
            if(!string.Equals(state.ModelFingerprint,identity.ModelFingerprint,StringComparison.Ordinal))return "Visual state was captured against a different model fingerprint.";
            var digest=LensNextVisualStateDigest.Compute(state); if(!string.IsNullOrWhiteSpace(state.DigestSha256)&&!string.Equals(state.DigestSha256,digest,StringComparison.OrdinalIgnoreCase))return "Visual-state digest validation failed.";
            return null;
        }
        private static LensNextVisualApplyResult Failed(string message,bool attempted,bool succeeded)=>new LensNextVisualApplyResult{Applied=false,Message=message,RollbackAttempted=attempted,RollbackSucceeded=succeeded};
    }
}
