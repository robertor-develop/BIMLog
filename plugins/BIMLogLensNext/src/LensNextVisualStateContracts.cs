using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Security.Cryptography;
using System.Text;

namespace BIMLogLensNext
{
    public static class LensNextVisualStateSchema
    {
        public const string Version = "bimlog.lens_next.visual_state.v1";
        public const int MaximumElementReferences = 5000;
    }

    public sealed class LensNextPointState
    {
        public double X { get; set; }
        public double Y { get; set; }
        public double Z { get; set; }
    }

    public sealed class LensNextRotationState
    {
        public double A { get; set; }
        public double B { get; set; }
        public double C { get; set; }
        public double D { get; set; }
    }

    public sealed class LensNextCameraState
    {
        public LensNextPointState Position { get; set; }
        public LensNextRotationState Rotation { get; set; }
        public LensNextPointState WorldUpVector { get; set; }
        public string Projection { get; set; }
        public double? FocalDistance { get; set; }
        public double? HorizontalExtentAtFocalDistance { get; set; }
        public double? VerticalExtentAtFocalDistance { get; set; }
    }

    public sealed class LensNextElementReference
    {
        public string InstanceGuid { get; set; }
        public string ModelSource { get; set; }
    }

    public sealed class LensNextAppearanceOverride
    {
        public LensNextElementReference Element { get; set; }
        public byte? Red { get; set; }
        public byte? Green { get; set; }
        public byte? Blue { get; set; }
        public double? Transparency { get; set; }
    }

    public sealed class LensNextModelReference
    {
        public string Source { get; set; }
        public string ModelGuid { get; set; }
        public string TransformFingerprint { get; set; }
    }

    public sealed class LensNextVisualComponentState
    {
        public bool Supported { get; set; }
        public bool Captured { get; set; }
        public bool RequiredForReconstruction { get; set; }
        public string Message { get; set; }
        // Nullable N05 readiness metadata preserves the distinction between an
        // explicit value and a legacy package that never recorded the value.
        public bool? Active { get; set; }
        public bool? Complete { get; set; }
        public bool? Truncated { get; set; }
        public int? Count { get; set; }
        public string Status { get; set; }
    }

    public sealed class LensNextVisualCompleteness
    {
        public LensNextVisualComponentState Camera { get; set; }
        public LensNextVisualComponentState Selection { get; set; }
        public LensNextVisualComponentState Visibility { get; set; }
        public LensNextVisualComponentState Sectioning { get; set; }
        public LensNextVisualComponentState AppearanceOverrides { get; set; }
        public LensNextVisualComponentState Redlines { get; set; }
        public LensNextVisualComponentState Screenshot { get; set; }
        public LensNextVisualComponentState ModelReferences { get; set; }

        public IEnumerable<LensNextVisualComponentState> Components()
        {
            yield return Camera;
            yield return Selection;
            yield return Visibility;
            yield return Sectioning;
            yield return AppearanceOverrides;
            yield return Redlines;
            yield return Screenshot;
            yield return ModelReferences;
        }

        public bool CanReconstructWithoutGuessing => Components()
            .Where(component => component != null && component.RequiredForReconstruction)
            .All(component => component.Supported && (component.Complete ?? component.Captured));
    }

    public sealed class LensNextVisualComponentReadiness
    {
        public string ComponentName { get; set; }
        public bool Active { get; set; }
        public bool Present { get; set; }
        public bool Required { get; set; }
        public bool Captured { get; set; }
        public bool Complete { get; set; }
        public bool Supported { get; set; }
        public bool Truncated { get; set; }
        public int? Count { get; set; }
        public string Status { get; set; }
        public string Reason { get; set; }
        public bool BlocksFullRestore => Required && (!Supported || !Captured || !Complete || Truncated);

        public string Diagnostic()
        {
            return "Component=" + ComponentName +
                   " Required=" + Required.ToString().ToLowerInvariant() +
                   " Active=" + Active.ToString().ToLowerInvariant() +
                   " Present=" + Present.ToString().ToLowerInvariant() +
                   " Captured=" + Captured.ToString().ToLowerInvariant() +
                   " Complete=" + Complete.ToString().ToLowerInvariant() +
                   " Supported=" + Supported.ToString().ToLowerInvariant() +
                   " Truncated=" + Truncated.ToString().ToLowerInvariant() +
                   (Count.HasValue ? " Count=" + Count.Value.ToString(CultureInfo.InvariantCulture) : "") +
                   " Status=" + (Status ?? "unspecified") +
                   " Reason=" + (Reason ?? "No reason recorded.");
        }
    }

    public sealed class LensNextVisualReadinessReport
    {
        public const string CurrentContractVersion = "lens-next-visual-readiness.v1";
        public string ContractVersion { get; set; } = CurrentContractVersion;
        public List<LensNextVisualComponentReadiness> Components { get; set; } = new List<LensNextVisualComponentReadiness>();
        public IEnumerable<LensNextVisualComponentReadiness> BlockingComponents => Components.Where(component => component.BlocksFullRestore);
        public bool CanApplyFullRestore => !BlockingComponents.Any();
        public string Outcome => CanApplyFullRestore ? "full" : "blocked";
        public string BlockingDiagnostic => string.Join(" | ", BlockingComponents.Select(component => component.Diagnostic()));
    }

    public static class LensNextVisualReadiness
    {
        public static LensNextVisualReadinessReport Evaluate(LensNextVisualState state)
        {
            if (state == null) throw new ArgumentNullException(nameof(state));
            var completeness = state.Completeness;
            var report = new LensNextVisualReadinessReport();
            report.Components.Add(Component("camera", completeness == null ? null : completeness.Camera, state.Camera != null, null, true, false));
            report.Components.Add(Component("selection", completeness == null ? null : completeness.Selection, true, Count(state.SelectedElements), Count(state.SelectedElements) > 0, false));
            report.Components.Add(Component("visibility", completeness == null ? null : completeness.Visibility, true, Count(state.HiddenElements), Count(state.HiddenElements) > 0, IsLegacyGloballyTruncated(state, completeness == null ? null : completeness.Visibility)));
            report.Components.Add(Component("appearanceOverrides", completeness == null ? null : completeness.AppearanceOverrides, true, Count(state.AppearanceOverrides), Count(state.AppearanceOverrides) > 0, IsLegacyGloballyTruncated(state, completeness == null ? null : completeness.AppearanceOverrides)));
            report.Components.Add(Component("modelReferences", completeness == null ? null : completeness.ModelReferences, true, Count(state.ModelReferences), Count(state.ModelReferences) > 0, false));
            report.Components.Add(Component("sectioning", completeness == null ? null : completeness.Sectioning, !string.IsNullOrWhiteSpace(state.SectioningJson), !string.IsNullOrWhiteSpace(state.SectioningJson) ? 1 : 0, !string.IsNullOrWhiteSpace(state.SectioningJson), false));
            report.Components.Add(Component("redlines", completeness == null ? null : completeness.Redlines, !string.IsNullOrWhiteSpace(state.RedlinesJson), !string.IsNullOrWhiteSpace(state.RedlinesJson) ? 1 : 0, !string.IsNullOrWhiteSpace(state.RedlinesJson), false));
            report.Components.Add(Component("screenshot", completeness == null ? null : completeness.Screenshot, !string.IsNullOrWhiteSpace(state.ScreenshotDataUrl), !string.IsNullOrWhiteSpace(state.ScreenshotDataUrl) ? 1 : 0, false, false));
            return report;
        }

        public static void EnsureCaptureCanReopen(LensNextVisualState state)
        {
            var report = Evaluate(state);
            if (!report.CanApplyFullRestore)
                throw new InvalidOperationException("Visual Package capture cannot claim a complete reopenable working view: " + report.BlockingDiagnostic);
        }

        private static LensNextVisualComponentReadiness Component(string name, LensNextVisualComponentState recorded, bool present, int? count, bool inferredActive, bool legacyTruncated)
        {
            var active = recorded != null && recorded.Active.HasValue ? recorded.Active.Value : inferredActive;
            var required = name == "camera" || name == "modelReferences" ? true : active;
            if (recorded != null && !recorded.Active.HasValue) required = recorded.RequiredForReconstruction;
            if (name == "screenshot") required = false;
            var captured = recorded == null ? present : recorded.Captured;
            var complete = recorded == null ? present : (recorded.Complete ?? recorded.Captured);
            var supported = recorded == null || recorded.Supported;
            var truncated = recorded != null && recorded.Truncated.HasValue ? recorded.Truncated.Value : legacyTruncated;
            return new LensNextVisualComponentReadiness
            {
                ComponentName = name,
                Active = active,
                Present = present,
                Required = required,
                Captured = captured,
                Complete = complete,
                Supported = supported,
                Truncated = truncated,
                Count = count ?? (recorded == null ? null : recorded.Count),
                Status = recorded == null ? (present ? "legacy-present" : "legacy-absent") : (recorded.Status ?? LegacyStatus(recorded, truncated)),
                Reason = recorded == null ? "Legacy package omitted component readiness metadata." : recorded.Message
            };
        }

        private static bool IsLegacyGloballyTruncated(LensNextVisualState state, LensNextVisualComponentState component)
        {
            return component != null && !component.Truncated.HasValue && !component.Captured &&
                   state.DigestDiagnostics != null && state.DigestDiagnostics.Truncated;
        }

        private static string LegacyStatus(LensNextVisualComponentState component, bool truncated)
        {
            if (truncated) return "truncated";
            if (!component.Supported) return "unsupported";
            if (!(component.Complete ?? component.Captured)) return "failed";
            return component.Captured ? "captured" : "absent";
        }

        private static int Count<T>(ICollection<T> values) => values == null ? 0 : values.Count;
    }

    public sealed class LensNextVisualState
    {
        public string SchemaVersion { get; set; } = LensNextVisualStateSchema.Version;
        public int ProjectId { get; set; }
        public int ServerId { get; set; }
        public string ViewpointId { get; set; }
        public string LifecycleStatus { get; set; }
        public int RevisionNumber { get; set; }
        public string ModelFingerprint { get; set; }
        public string CapturedAt { get; set; }
        public string CaptureSource { get; set; }
        public LensNextCameraState Camera { get; set; }
        public List<LensNextElementReference> SelectedElements { get; set; } = new List<LensNextElementReference>();
        public List<LensNextElementReference> HiddenElements { get; set; } = new List<LensNextElementReference>();
        public List<LensNextAppearanceOverride> AppearanceOverrides { get; set; } = new List<LensNextAppearanceOverride>();
        public List<LensNextModelReference> ModelReferences { get; set; } = new List<LensNextModelReference>();
        public string SectioningJson { get; set; }
        public string RedlinesJson { get; set; }
        public string ScreenshotDataUrl { get; set; }
        public string ScreenshotSha256 { get; set; }
        public LensNextVisualCompleteness Completeness { get; set; }
        public string DigestSha256 { get; set; }
        public LensNextDigestDiagnostics DigestDiagnostics { get; set; }
    }

    public sealed class LensNextDigestDiagnostics
    {
        public string Algorithm { get; set; }
        public string ContractVersion { get; set; }
        public string CanonicalInputBase64 { get; set; }
        public int CanonicalLength { get; set; }
        public string ComputedDigest { get; set; }
        public bool Truncated { get; set; }
    }

    public sealed class LensNextVisualCapturePayload
    {
        public string RequestId { get; set; }
        public LensNextWireIdentity Identity { get; set; }
        public LensNextVisualState VisualState { get; set; }
    }

    public sealed class LensNextVisualApplyResult
    {
        public bool Applied { get; set; }
        public bool RollbackAttempted { get; set; }
        public bool RollbackSucceeded { get; set; }
        public string Message { get; set; }
        public List<string> AppliedComponents { get; set; } = new List<string>();
    }

    public sealed class LensNextWorkingViewAppliedPayload
    {
        public string RequestId { get; set; }
        public LensNextWireIdentity Identity { get; set; }
        public LensNextVisualApplyResult Result { get; set; }
    }

    public static class LensNextVisualStateDigest
    {
        public const string Algorithm = "SHA-256";
        public const string ContractVersion = "lens-next-visual-digest.v2";
        public const string LegacyContractVersion = "lens-next-visual-digest.v1";

        public static string Compute(LensNextVisualState state)
        {
            if (state == null) throw new ArgumentNullException(nameof(state));
            return Hash(Canonicalize(state, ResolveContractVersion(state)));
        }

        public static LensNextDigestDiagnostics Diagnose(LensNextVisualState state, bool truncated)
        {
            if (state == null) throw new ArgumentNullException(nameof(state));
            var contractVersion = ResolveContractVersion(state);
            var canonical = Canonicalize(state, contractVersion);
            return new LensNextDigestDiagnostics
            {
                Algorithm = Algorithm,
                ContractVersion = contractVersion,
                CanonicalInputBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(canonical)),
                CanonicalLength = canonical.Length,
                ComputedDigest = Hash(canonical),
                Truncated = truncated
            };
        }

        private static string ResolveContractVersion(LensNextVisualState state)
        {
            var requested = state.DigestDiagnostics == null ? null : state.DigestDiagnostics.ContractVersion;
            if (string.IsNullOrWhiteSpace(requested) || string.Equals(requested, ContractVersion, StringComparison.Ordinal)) return ContractVersion;
            if (string.Equals(requested, LegacyContractVersion, StringComparison.Ordinal)) return LegacyContractVersion;
            throw new InvalidOperationException("Unsupported Lens Next visual digest contract: " + requested);
        }

        private static string Canonicalize(LensNextVisualState state, string contractVersion)
        {
            var builder = new StringBuilder();
            Append(builder, state.SchemaVersion);
            Append(builder, state.ProjectId);
            Append(builder, state.ServerId);
            Append(builder, state.ViewpointId);
            Append(builder, state.LifecycleStatus);
            Append(builder, state.RevisionNumber);
            Append(builder, state.ModelFingerprint);
            AppendCamera(builder, state.Camera, contractVersion);
            foreach (var item in (state.SelectedElements ?? new List<LensNextElementReference>()).OrderBy(Key, StringComparer.Ordinal)) AppendElement(builder, "S", item);
            foreach (var item in (state.HiddenElements ?? new List<LensNextElementReference>()).OrderBy(Key, StringComparer.Ordinal)) AppendElement(builder, "H", item);
            foreach (var item in (state.AppearanceOverrides ?? new List<LensNextAppearanceOverride>()).OrderBy(item => Key(item == null ? null : item.Element), StringComparer.Ordinal))
            {
                AppendElement(builder, "A", item == null ? null : item.Element);
                Append(builder, item == null ? null : item.Red);
                Append(builder, item == null ? null : item.Green);
                Append(builder, item == null ? null : item.Blue);
                AppendDouble(builder, item == null ? null : item.Transparency, contractVersion);
            }
            foreach (var model in (state.ModelReferences ?? new List<LensNextModelReference>()).OrderBy(model => model == null ? "" : model.Source, StringComparer.Ordinal))
            {
                Append(builder, model == null ? null : model.Source);
                Append(builder, model == null ? null : model.ModelGuid);
                Append(builder, model == null ? null : model.TransformFingerprint);
            }
            Append(builder, state.SectioningJson);
            Append(builder, state.RedlinesJson);
            Append(builder, state.ScreenshotSha256);
            return builder.ToString();
        }

        private static string Hash(string canonical)
        {
            using (var sha = SHA256.Create())
            {
                var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(canonical));
                return string.Concat(bytes.Select(value => value.ToString("x2", CultureInfo.InvariantCulture)));
            }
        }

        private static string Key(LensNextElementReference item) => item == null ? "" : (item.ModelSource ?? "") + "|" + (item.InstanceGuid ?? "");
        private static void AppendElement(StringBuilder builder, string prefix, LensNextElementReference item)
        {
            Append(builder, prefix);
            Append(builder, item == null ? null : item.ModelSource);
            Append(builder, item == null ? null : item.InstanceGuid);
        }
        private static void AppendCamera(StringBuilder builder, LensNextCameraState camera, string contractVersion)
        {
            if (camera == null) { Append(builder, "camera:null"); return; }
            AppendPoint(builder, camera.Position, contractVersion); AppendRotation(builder, camera.Rotation, contractVersion); AppendPoint(builder, camera.WorldUpVector, contractVersion);
            Append(builder, camera.Projection); AppendDouble(builder, camera.FocalDistance, contractVersion); AppendDouble(builder, camera.HorizontalExtentAtFocalDistance, contractVersion); AppendDouble(builder, camera.VerticalExtentAtFocalDistance, contractVersion);
        }
        private static void AppendPoint(StringBuilder builder, LensNextPointState value, string contractVersion) { if (value == null) { Append(builder, "point:null"); return; } AppendDouble(builder, value.X, contractVersion); AppendDouble(builder, value.Y, contractVersion); AppendDouble(builder, value.Z, contractVersion); }
        private static void AppendRotation(StringBuilder builder, LensNextRotationState value, string contractVersion) { if (value == null) { Append(builder, "rotation:null"); return; } AppendDouble(builder, value.A, contractVersion); AppendDouble(builder, value.B, contractVersion); AppendDouble(builder, value.C, contractVersion); AppendDouble(builder, value.D, contractVersion); }
        private static void AppendDouble(StringBuilder builder, double value, string contractVersion) { AppendDouble(builder, (double?)value, contractVersion); }
        private static void AppendDouble(StringBuilder builder, double? value, string contractVersion)
        {
            if (!value.HasValue) { Append(builder, null); return; }
            if (string.Equals(contractVersion, LegacyContractVersion, StringComparison.Ordinal)) { Append(builder, value.Value); return; }
            var normalized = value.Value == 0d ? 0d : value.Value;
            if (double.IsNaN(normalized) || double.IsInfinity(normalized)) throw new InvalidOperationException("Lens Next visual digest requires finite floating-point values.");
            Append(builder, "f64:" + BitConverter.DoubleToInt64Bits(normalized).ToString("x16", CultureInfo.InvariantCulture));
        }
        private static void Append(StringBuilder builder, object value)
        {
            builder.Append(value == null
                ? "<null>"
                : Convert.ToString(value, CultureInfo.InvariantCulture))
                .Append('\u001f');
        }
    }
}
