using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Security.Cryptography;
using System.Text;

namespace BIMLogLensNext
{
    public static class LensNextRevitNavigationSchema
    {
        public const string ContractVersion = "lens-next-revit-navigation.v1";
        public const int LatestSupportedMajorVersion = 2026;
        public const string RevitInternalLinearUnit = "feet";
        public const int MaximumElementIds = 5000;
    }

    public sealed class LensNextRevitModelIdentity
    {
        public string DocumentGuid { get; set; }
        public string CentralModelGuid { get; set; }
        public string FileNameNormalized { get; set; }
        public int RevitMajorVersion { get; set; }
        public string CoordinateFrame { get; set; }
        public double[] NavisworksToRevitTransform { get; set; }
    }

    public sealed class LensNextRevitNavigationTarget
    {
        public string ContractVersion { get; set; }
        public int ProjectId { get; set; }
        public int IssueId { get; set; }
        public string ViewpointId { get; set; }
        public string VisualStateDigest { get; set; }
        public LensNextRevitModelIdentity Model { get; set; }
        public LensNextPointState RevitInternalPoint { get; set; }
        public List<long> RevitElementIds { get; set; } = new List<long>();
        public string TargetDigest { get; set; }
    }

    public static class LensNextRevitNavigationContract
    {
        public static string ValidateAndDigest(LensNextRevitNavigationTarget target)
        {
            if (target == null) throw new ArgumentNullException(nameof(target));
            RequireEqual(target.ContractVersion, LensNextRevitNavigationSchema.ContractVersion, "contractVersion");
            if (target.ProjectId <= 0 || target.IssueId <= 0) throw new InvalidOperationException("Revit navigation requires positive project and issue identities.");
            Require(target.ViewpointId, "viewpointId");
            RequireSha256(target.VisualStateDigest, "visualStateDigest");
            if (target.Model == null) throw new InvalidOperationException("Revit navigation requires an exact model identity.");
            Require(target.Model.DocumentGuid, "documentGuid");
            Require(target.Model.FileNameNormalized, "fileNameNormalized");
            if (target.Model.RevitMajorVersion != LensNextRevitNavigationSchema.LatestSupportedMajorVersion)
                throw new InvalidOperationException("This package supports Revit 2026 only; another major version must not be guessed.");
            RequireEqual(target.Model.CoordinateFrame, "revit-internal", "coordinateFrame");
            if (target.Model.NavisworksToRevitTransform == null || target.Model.NavisworksToRevitTransform.Length != 16 || target.Model.NavisworksToRevitTransform.Any(value => double.IsNaN(value) || double.IsInfinity(value)))
                throw new InvalidOperationException("The exact finite 4x4 Navisworks-to-Revit transform is required.");
            if (target.RevitInternalPoint == null || !Finite(target.RevitInternalPoint.X) || !Finite(target.RevitInternalPoint.Y) || !Finite(target.RevitInternalPoint.Z))
                throw new InvalidOperationException("The Revit internal target point must contain three finite coordinates.");
            if (target.RevitElementIds == null || target.RevitElementIds.Count > LensNextRevitNavigationSchema.MaximumElementIds || target.RevitElementIds.Any(id => id <= 0) || target.RevitElementIds.Distinct().Count() != target.RevitElementIds.Count)
                throw new InvalidOperationException("Revit element identities must be positive, unique and bounded.");
            var canonical = string.Join("\u001f", new[] {
                target.ContractVersion, target.ProjectId.ToString(CultureInfo.InvariantCulture), target.IssueId.ToString(CultureInfo.InvariantCulture),
                target.ViewpointId, target.VisualStateDigest.ToLowerInvariant(), target.Model.DocumentGuid.ToLowerInvariant(),
                (target.Model.CentralModelGuid ?? "<null>").ToLowerInvariant(), target.Model.FileNameNormalized.ToLowerInvariant(),
                target.Model.RevitMajorVersion.ToString(CultureInfo.InvariantCulture), target.Model.CoordinateFrame,
                string.Join(",", target.Model.NavisworksToRevitTransform.Select(Float)),
                string.Join(",", new[] { Float(target.RevitInternalPoint.X), Float(target.RevitInternalPoint.Y), Float(target.RevitInternalPoint.Z) }),
                string.Join(",", target.RevitElementIds.OrderBy(id => id).Select(id => id.ToString(CultureInfo.InvariantCulture)))
            });
            using (var sha = SHA256.Create())
                return string.Concat(sha.ComputeHash(Encoding.UTF8.GetBytes(canonical)).Select(value => value.ToString("x2", CultureInfo.InvariantCulture)));
        }

        private static bool Finite(double value) => !double.IsNaN(value) && !double.IsInfinity(value);
        private static string Float(double value) => "f64:" + BitConverter.DoubleToInt64Bits(value == 0d ? 0d : value).ToString("x16", CultureInfo.InvariantCulture);
        private static void Require(string value, string field) { if (string.IsNullOrWhiteSpace(value)) throw new InvalidOperationException("Revit navigation requires " + field + "."); }
        private static void RequireEqual(string value, string expected, string field) { if (!string.Equals(value, expected, StringComparison.Ordinal)) throw new InvalidOperationException("Revit navigation " + field + " must be " + expected + "."); }
        private static void RequireSha256(string value, string field) { if (string.IsNullOrWhiteSpace(value) || value.Length != 64 || value.Any(character => !Uri.IsHexDigit(character))) throw new InvalidOperationException("Revit navigation " + field + " must be a SHA-256 digest."); }
    }

    public static class LensNextRevitCoordinateResolver
    {
        public static LensNextPointState TransformPoint(LensNextPointState navisworksPoint, LensNextRevitModelIdentity model)
        {
            if (navisworksPoint == null) throw new ArgumentNullException(nameof(navisworksPoint));
            if (model == null || model.NavisworksToRevitTransform == null || model.NavisworksToRevitTransform.Length != 16)
                throw new InvalidOperationException("Coordinate navigation requires the exact persisted 4x4 transform.");
            var matrix = model.NavisworksToRevitTransform;
            if (matrix.Any(value => double.IsNaN(value) || double.IsInfinity(value)))
                throw new InvalidOperationException("Coordinate navigation rejects non-finite transforms.");
            var x = matrix[0] * navisworksPoint.X + matrix[1] * navisworksPoint.Y + matrix[2] * navisworksPoint.Z + matrix[3];
            var y = matrix[4] * navisworksPoint.X + matrix[5] * navisworksPoint.Y + matrix[6] * navisworksPoint.Z + matrix[7];
            var z = matrix[8] * navisworksPoint.X + matrix[9] * navisworksPoint.Y + matrix[10] * navisworksPoint.Z + matrix[11];
            var w = matrix[12] * navisworksPoint.X + matrix[13] * navisworksPoint.Y + matrix[14] * navisworksPoint.Z + matrix[15];
            if (w == 0d || double.IsNaN(w) || double.IsInfinity(w)) throw new InvalidOperationException("Coordinate navigation transform produced an invalid homogeneous coordinate.");
            var result = new LensNextPointState { X = x / w, Y = y / w, Z = z / w };
            if (double.IsNaN(result.X) || double.IsInfinity(result.X) || double.IsNaN(result.Y) || double.IsInfinity(result.Y) || double.IsNaN(result.Z) || double.IsInfinity(result.Z))
                throw new InvalidOperationException("Coordinate navigation transform produced a non-finite Revit point.");
            return result;
        }

        public static void EnsureDocumentMatch(LensNextRevitModelIdentity expected, string actualDocumentGuid, string actualCentralModelGuid, int actualRevitMajorVersion)
        {
            if (expected == null) throw new ArgumentNullException(nameof(expected));
            if (actualRevitMajorVersion != LensNextRevitNavigationSchema.LatestSupportedMajorVersion || expected.RevitMajorVersion != actualRevitMajorVersion)
                throw new InvalidOperationException("The active Revit major version does not match the governed navigation target.");
            if (!string.Equals(expected.DocumentGuid, actualDocumentGuid, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("The active Revit document does not match the governed navigation target.");
            if (!string.IsNullOrWhiteSpace(expected.CentralModelGuid) && !string.Equals(expected.CentralModelGuid, actualCentralModelGuid, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("The active Revit central model does not match the governed navigation target.");
        }
    }
}
