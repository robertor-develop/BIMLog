using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Security.Cryptography;
using System.Text;

namespace BIMLogLensNext
{
    public static class LensNextNavigationSchema
    {
        public const int Version = 1;
        public const string ContractVersion = "lens-next-navigation.v1";
        public const string Algorithm = "SHA-256";
    }

    public sealed class LensNextNavigationView
    {
        public string ContractVersion { get; set; }
        public int SchemaVersion { get; set; }
        public int ProjectId { get; set; }
        public int ServerId { get; set; }
        public string ViewpointId { get; set; }
        public string LifecycleStatus { get; set; }
        public int RevisionNumber { get; set; }
        public string ModelFingerprint { get; set; }
        public LensNextCameraState Camera { get; set; }
        public string SectioningJson { get; set; }
        public List<LensNextElementReference> SelectedElements { get; set; } = new List<LensNextElementReference>();
        public string ScreenshotDataUrl { get; set; }
        public string ScreenshotSha256 { get; set; }
        public string DigestSha256 { get; set; }
    }

    public static class LensNextNavigationDigest
    {
        private const string NullToken = "<null>";

        public static string Compute(LensNextNavigationView value)
        {
            if (value == null) throw new ArgumentNullException(nameof(value));
            if (value.SelectedElements != null && value.SelectedElements.Count != 0)
                throw new InvalidOperationException("Navigation v1 persists no selected element references unless a bounded deterministic capture is available.");
            var tokens = new List<string>
            {
                value.ContractVersion, value.SchemaVersion.ToString(CultureInfo.InvariantCulture),
                value.ProjectId.ToString(CultureInfo.InvariantCulture), value.ServerId.ToString(CultureInfo.InvariantCulture),
                value.ViewpointId, value.LifecycleStatus, value.RevisionNumber.ToString(CultureInfo.InvariantCulture),
                value.ModelFingerprint
            };
            AppendCamera(tokens, value.Camera);
            tokens.Add(value.SectioningJson);
            tokens.Add("0");
            var canonical = string.Concat(tokens.Select(token => (token ?? NullToken) + "\u001f"));
            using (var sha = SHA256.Create())
                return string.Concat(sha.ComputeHash(Encoding.UTF8.GetBytes(canonical)).Select(valueByte => valueByte.ToString("x2", CultureInfo.InvariantCulture)));
        }

        private static void AppendCamera(List<string> tokens, LensNextCameraState camera)
        {
            if (camera == null) { tokens.Add("camera:null"); return; }
            AppendPoint(tokens, camera.Position, "point:null");
            if (camera.Rotation == null) tokens.Add("rotation:null");
            else { tokens.Add(Float(camera.Rotation.A)); tokens.Add(Float(camera.Rotation.B)); tokens.Add(Float(camera.Rotation.C)); tokens.Add(Float(camera.Rotation.D)); }
            AppendPoint(tokens, camera.WorldUpVector, "point:null");
            tokens.Add(camera.Projection);
            tokens.Add(Float(camera.FocalDistance));
            tokens.Add(Float(camera.HorizontalExtentAtFocalDistance));
            tokens.Add(Float(camera.VerticalExtentAtFocalDistance));
        }

        private static void AppendPoint(List<string> tokens, LensNextPointState point, string missing)
        {
            if (point == null) { tokens.Add(missing); return; }
            tokens.Add(Float(point.X)); tokens.Add(Float(point.Y)); tokens.Add(Float(point.Z));
        }

        private static string Float(double? value)
        {
            if (!value.HasValue) return null;
            var normalized = value.Value == 0d ? 0d : value.Value;
            return "f64:" + BitConverter.DoubleToInt64Bits(normalized).ToString("x16", CultureInfo.InvariantCulture);
        }
    }

    public sealed class LensNextNavigationApplyResult
    {
        public bool Applied { get; set; }
        public string Message { get; set; }
        public IReadOnlyCollection<string> AppliedComponents { get; set; }
        public IReadOnlyCollection<string> OptionalWarnings { get; set; }
    }

    public sealed class LensNextNavigationCapturePayload
    {
        public string RequestId { get; set; }
        public LensNextWireIdentity Identity { get; set; }
        public LensNextNavigationView NavigationView { get; set; }
    }

    public sealed class LensNextNavigationAppliedPayload
    {
        public string RequestId { get; set; }
        public LensNextWireIdentity Identity { get; set; }
        public LensNextNavigationApplyResult Result { get; set; }
    }
}
