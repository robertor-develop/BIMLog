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

    public sealed class LensNextOpenInRevitRequest
    {
        public string RequestId { get; set; }
        public string SessionId { get; set; }
        public string ConfirmationReason { get; set; }
        public DateTimeOffset ExpiresAt { get; set; }
        public LensNextRevitNavigationTarget Target { get; set; }
    }

    public sealed class LensNextOpenInRevitReceipt
    {
        public string RequestId { get; set; }
        public int ProjectId { get; set; }
        public int IssueId { get; set; }
        public string TargetDigest { get; set; }
        public string DocumentGuid { get; set; }
        public int RevitMajorVersion { get; set; }
        public bool ViewActivated { get; set; }
        public bool PointShown { get; set; }
        public int ElementsSelected { get; set; }
        public DateTimeOffset AppliedAt { get; set; }
        public string Outcome { get; set; }
    }

    public static class LensNextOpenInRevitPolicy
    {
        public static string ValidateRequest(LensNextOpenInRevitRequest request, string expectedSessionId, DateTimeOffset now)
        {
            if (request == null) throw new ArgumentNullException(nameof(request));
            if (!Guid.TryParse(request.RequestId, out _)) throw new InvalidOperationException("Open in Revit requires a UUID request identity.");
            if (!string.Equals(request.SessionId, expectedSessionId, StringComparison.Ordinal)) throw new InvalidOperationException("Open in Revit session identity mismatch.");
            if (request.ExpiresAt <= now || request.ExpiresAt > now.AddMinutes(5)) throw new InvalidOperationException("Open in Revit request is expired or exceeds the bounded lifetime.");
            if (string.IsNullOrWhiteSpace(request.ConfirmationReason) || request.ConfirmationReason.Trim().Length < 3 || request.ConfirmationReason.Length > 500)
                throw new InvalidOperationException("Open in Revit requires a bounded confirmation reason.");
            var digest = LensNextRevitNavigationContract.ValidateAndDigest(request.Target);
            if (!string.IsNullOrWhiteSpace(request.Target.TargetDigest) && !string.Equals(request.Target.TargetDigest, digest, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Open in Revit target digest mismatch.");
            return digest;
        }

        public static void ValidateReceipt(LensNextOpenInRevitRequest request, LensNextOpenInRevitReceipt receipt, string expectedDigest)
        {
            if (request == null || receipt == null) throw new ArgumentNullException(receipt == null ? nameof(receipt) : nameof(request));
            if (!string.Equals(request.RequestId, receipt.RequestId, StringComparison.Ordinal) || request.Target.ProjectId != receipt.ProjectId || request.Target.IssueId != receipt.IssueId)
                throw new InvalidOperationException("Open in Revit receipt identity mismatch.");
            if (!string.Equals(expectedDigest, receipt.TargetDigest, StringComparison.OrdinalIgnoreCase) || !string.Equals(request.Target.Model.DocumentGuid, receipt.DocumentGuid, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Open in Revit receipt target mismatch.");
            if (receipt.RevitMajorVersion != LensNextRevitNavigationSchema.LatestSupportedMajorVersion || !new[] { "opened", "already-opened", "blocked" }.Contains(receipt.Outcome))
                throw new InvalidOperationException("Open in Revit receipt outcome is invalid.");
            if (receipt.Outcome != "blocked" && (!receipt.ViewActivated || !receipt.PointShown))
                throw new InvalidOperationException("Open in Revit cannot claim success without activating a view and showing the governed point.");
        }
    }
}
