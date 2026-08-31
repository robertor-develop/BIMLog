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
        public const int MaximumScannedElements = 250000;
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
            .All(component => component.Supported && component.Captured);
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
        public const string ContractVersion = "lens-next-visual-digest.v1";

        public static string Compute(LensNextVisualState state)
        {
            if (state == null) throw new ArgumentNullException(nameof(state));
            return Hash(Canonicalize(state));
        }

        public static LensNextDigestDiagnostics Diagnose(LensNextVisualState state, bool truncated)
        {
            if (state == null) throw new ArgumentNullException(nameof(state));
            var canonical = Canonicalize(state);
            return new LensNextDigestDiagnostics
            {
                Algorithm = Algorithm,
                ContractVersion = ContractVersion,
                CanonicalInputBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(canonical)),
                CanonicalLength = canonical.Length,
                ComputedDigest = Hash(canonical),
                Truncated = truncated
            };
        }

        private static string Canonicalize(LensNextVisualState state)
        {
            var builder = new StringBuilder();
            Append(builder, state.SchemaVersion);
            Append(builder, state.ProjectId);
            Append(builder, state.ServerId);
            Append(builder, state.ViewpointId);
            Append(builder, state.LifecycleStatus);
            Append(builder, state.RevisionNumber);
            Append(builder, state.ModelFingerprint);
            AppendCamera(builder, state.Camera);
            foreach (var item in (state.SelectedElements ?? new List<LensNextElementReference>()).OrderBy(Key, StringComparer.Ordinal)) AppendElement(builder, "S", item);
            foreach (var item in (state.HiddenElements ?? new List<LensNextElementReference>()).OrderBy(Key, StringComparer.Ordinal)) AppendElement(builder, "H", item);
            foreach (var item in (state.AppearanceOverrides ?? new List<LensNextAppearanceOverride>()).OrderBy(item => Key(item == null ? null : item.Element), StringComparer.Ordinal))
            {
                AppendElement(builder, "A", item == null ? null : item.Element);
                Append(builder, item == null ? null : item.Red);
                Append(builder, item == null ? null : item.Green);
                Append(builder, item == null ? null : item.Blue);
                Append(builder, item == null ? null : item.Transparency);
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
        private static void AppendCamera(StringBuilder builder, LensNextCameraState camera)
        {
            if (camera == null) { Append(builder, "camera:null"); return; }
            AppendPoint(builder, camera.Position); AppendRotation(builder, camera.Rotation); AppendPoint(builder, camera.WorldUpVector);
            Append(builder, camera.Projection); Append(builder, camera.FocalDistance); Append(builder, camera.HorizontalExtentAtFocalDistance); Append(builder, camera.VerticalExtentAtFocalDistance);
        }
        private static void AppendPoint(StringBuilder builder, LensNextPointState value) { if (value == null) { Append(builder, "point:null"); return; } Append(builder, value.X); Append(builder, value.Y); Append(builder, value.Z); }
        private static void AppendRotation(StringBuilder builder, LensNextRotationState value) { if (value == null) { Append(builder, "rotation:null"); return; } Append(builder, value.A); Append(builder, value.B); Append(builder, value.C); Append(builder, value.D); }
        private static void Append(StringBuilder builder, object value)
        {
            builder.Append(value == null
                ? "<null>"
                : Convert.ToString(value, CultureInfo.InvariantCulture))
                .Append('\u001f');
        }
    }
}
