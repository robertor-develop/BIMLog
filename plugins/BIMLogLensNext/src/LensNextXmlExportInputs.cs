using System;
using System.Collections.Generic;
using System.Collections;
using System.IO;
using System.Linq;

namespace BIMLogLensNext
{
    public sealed class LensNextXmlExportInput
    {
        public int ProjectId { get; set; }
        public int ServerId { get; set; }
        public string ViewpointId { get; set; }
        public string LifecycleStatus { get; set; }
        public int RevisionNumber { get; set; }
        public string DisplayId { get; set; }
        public string Note { get; set; }
        public int? Priority { get; set; }
        public DateTimeOffset? CapturedAt { get; set; }
        public string VisualStateDigest { get; set; }
        public int PackageProjectId { get; set; }
        public int PackageServerId { get; set; }
        public string PackageViewpointId { get; set; }
        public string PackageLifecycleStatus { get; set; }
        public int PackageRevisionNumber { get; set; }
        public string PackageDigest { get; set; }
        public LensNextCameraState PackageCamera { get; set; }
        public string PackageSectioningJson { get; set; }
    }

    public sealed class LensNextXmlSkippedViewpoint
    {
        internal LensNextXmlSkippedViewpoint(LensNextXmlExportInput record, string reason)
        {
            ServerId = record.ServerId;
            ViewpointId = record.ViewpointId;
            Reason = reason;
        }

        public int ServerId { get; }
        public string ViewpointId { get; }
        public string Reason { get; }
    }

    public sealed class LensNextXmlExportDiagnostic
    {
        internal LensNextXmlExportDiagnostic(LensNextXmlExportInput record, string result, string reasonCode, string reasonDetail)
        {
            ServerId = record.ServerId;
            ViewpointId = record.ViewpointId;
            DisplayId = string.IsNullOrWhiteSpace(record.DisplayId) ? null : record.DisplayId.Trim();
            Result = result;
            ReasonCode = reasonCode;
            ReasonDetail = reasonDetail;
        }

        public int ServerId { get; }
        public string ViewpointId { get; }
        public string DisplayId { get; }
        public string Result { get; }
        public string ReasonCode { get; }
        public string ReasonDetail { get; }
    }

    public sealed class LensNextXmlExportResult : IReadOnlyList<LensNextXmlExportInput>
    {
        internal LensNextXmlExportResult(
            int requestedCount,
            IReadOnlyList<LensNextXmlExportInput> serializedViewpoints,
            IReadOnlyList<LensNextXmlSkippedViewpoint> skippedViewpoints,
            IReadOnlyList<LensNextXmlExportDiagnostic> diagnostics)
        {
            RequestedCount = requestedCount;
            SerializedViewpoints = serializedViewpoints;
            SkippedViewpoints = skippedViewpoints;
            Diagnostics = diagnostics;
        }

        public int RequestedCount { get; }
        public int SerializedCount => SerializedViewpoints.Count;
        public int SkippedCount => SkippedViewpoints.Count;
        public IReadOnlyList<LensNextXmlExportInput> SerializedViewpoints { get; }
        public IReadOnlyList<LensNextXmlSkippedViewpoint> SkippedViewpoints { get; }
        public IReadOnlyList<LensNextXmlExportDiagnostic> Diagnostics { get; }
        public LensNextXmlExportSummary Summary { get; internal set; }
        public int Count => SerializedViewpoints.Count;
        public LensNextXmlExportInput this[int index] => SerializedViewpoints[index];
        public IEnumerator<LensNextXmlExportInput> GetEnumerator() => SerializedViewpoints.GetEnumerator();
        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
    }

    public static class LensNextXmlExportNamePolicy
    {
        public static string BaseName(LensNextXmlExportInput record)
        {
            if (record == null) throw new ArgumentNullException(nameof(record));
            var identity = string.IsNullOrWhiteSpace(record.DisplayId)
                ? record.ViewpointId == null ? string.Empty : record.ViewpointId.Trim()
                : record.DisplayId.Trim();
            if (string.IsNullOrWhiteSpace(identity))
                throw new InvalidDataException("The BIMLog viewpoint has no authoritative export-name identity.");
            var title = record.Note == null ? string.Empty : record.Note.Trim();
            return title.Length == 0 ? identity : identity + " - " + title;
        }

        public static IReadOnlyList<string> UniqueNames(IReadOnlyList<LensNextXmlExportInput> ordered)
        {
            if (ordered == null) throw new ArgumentNullException(nameof(ordered));
            var baseNames = ordered.Select(BaseName).ToArray();
            var counts = baseNames.GroupBy(value => value, StringComparer.Ordinal)
                .ToDictionary(group => group.Key, group => group.Count(), StringComparer.Ordinal);
            return baseNames.Select((value, index) => counts[value] == 1
                ? value
                : value + " [" + ordered[index].ServerId + "]").ToArray();
        }
    }

    public static class LensNextXmlExportInputSelector
    {
        internal const string DiagnosticsDataKey = "BIMLog.XmlExportDiagnostics";
        public static IReadOnlyList<LensNextXmlExportInput> SelectOrdered(
            int authoritativeProjectId,
            IEnumerable<LensNextXmlExportInput> records)
        {
            return SelectForExport(authoritativeProjectId, records).SerializedViewpoints;
        }

        public static LensNextXmlExportResult SelectForExport(
            int authoritativeProjectId,
            IEnumerable<LensNextXmlExportInput> records)
        {
            if (authoritativeProjectId <= 0)
                throw new ArgumentOutOfRangeException(nameof(authoritativeProjectId), "An authoritative BIMLog project ID is required.");
            if (records == null) throw new ArgumentNullException(nameof(records));

            var supplied = records.ToArray();
            var active = new List<LensNextXmlExportInput>();
            var serverIds = new HashSet<int>();
            foreach (var record in supplied)
            {
                if (record == null) throw new InvalidDataException("The BIMLog export collection contains a null record.");
                if (record.ProjectId != authoritativeProjectId)
                    throw new InvalidDataException("A cross-project BIMLog viewpoint cannot enter the export collection.");
                if (!IsLifecycle(record.LifecycleStatus))
                    throw new InvalidDataException("The BIMLog viewpoint lifecycle state is invalid.");
                if (!string.Equals(record.LifecycleStatus, "active", StringComparison.Ordinal)) continue;

                ValidateActiveRecordIntegrity(record);
                if (!serverIds.Add(record.ServerId))
                    throw new InvalidDataException("The BIMLog export collection contains a duplicate server viewpoint ID.");
                active.Add(record);
            }

            var ordered = active
                .OrderBy(record => record.Priority ?? int.MaxValue)
                .ThenByDescending(record => record.CapturedAt.HasValue ? record.CapturedAt.Value.UtcDateTime.Ticks : 0L)
                .ThenBy(record => record.ServerId)
                .ToArray();
            var exportable = new List<LensNextXmlExportInput>();
            var skipped = new List<LensNextXmlSkippedViewpoint>();
            var diagnostics = new List<LensNextXmlExportDiagnostic>();
            foreach (var record in ordered)
            {
                try
                {
                    ValidateExportableRecord(record);
                    exportable.Add(record);
                    diagnostics.Add(new LensNextXmlExportDiagnostic(record, "EXPORTED", "exported", null));
                }
                catch (InvalidDataException exception)
                {
                    skipped.Add(new LensNextXmlSkippedViewpoint(record, exception.Message));
                    diagnostics.Add(new LensNextXmlExportDiagnostic(record, "SKIPPED", DiagnosticReasonCode(record), exception.Message));
                }
            }
            if (exportable.Count == 0)
            {
                var detail = string.Join(" | ", diagnostics.Select(value =>
                    "ServerId=" + value.ServerId +
                    ", DisplayId=" + (value.DisplayId ?? "<none>") +
                    ", ViewpointId=" + (value.ViewpointId ?? "<none>") +
                    ", ReasonCode=" + value.ReasonCode +
                    ", ReasonDetail=" + (value.ReasonDetail ?? "<none>")));
                var exception = new InvalidDataException("The BIMLog XML export contains zero exportable active viewpoints (requested " +
                    active.Count + ", skipped " + skipped.Count + "). " + detail);
                exception.Data["BIMLog.RequestedCount"] = active.Count;
                exception.Data["BIMLog.SkippedCount"] = skipped.Count;
                exception.Data[DiagnosticsDataKey] = diagnostics.ToArray();
                throw exception;
            }
            return new LensNextXmlExportResult(active.Count, exportable.ToArray(), skipped.ToArray(), diagnostics.ToArray());
        }

        private static void ValidateActiveRecordIntegrity(LensNextXmlExportInput record)
        {
            if (record.ServerId <= 0 || string.IsNullOrWhiteSpace(record.ViewpointId) || record.RevisionNumber <= 0)
                throw new InvalidDataException("The active BIMLog viewpoint identity is incomplete.");
            if (record.Priority.HasValue && (record.Priority.Value < 1 || record.Priority.Value > 5))
                throw new InvalidDataException("The active BIMLog viewpoint priority is invalid.");
            if (!IsSha256(record.VisualStateDigest) || !IsSha256(record.PackageDigest) ||
                !string.Equals(record.VisualStateDigest, record.PackageDigest, StringComparison.OrdinalIgnoreCase))
                throw new InvalidDataException("The active BIMLog viewpoint package digest is invalid or mismatched.");
            if (record.PackageProjectId != record.ProjectId)
                throw new InvalidDataException("The active BIMLog viewpoint package project identity is mismatched.");
        }

        private static void ValidateExportableRecord(LensNextXmlExportInput record)
        {
            if (record.PackageServerId != record.ServerId ||
                !string.Equals(record.PackageViewpointId, record.ViewpointId, StringComparison.Ordinal) ||
                !string.Equals(record.PackageLifecycleStatus, record.LifecycleStatus, StringComparison.Ordinal) ||
                record.PackageRevisionNumber != record.RevisionNumber)
                throw new InvalidDataException("The BIMLog viewpoint package identity is historical or mismatched and cannot be exported safely.");
            LensNextXmlPosition.FromValidatedCamera(record.PackageCamera);
            LensNextXmlRotation.FromValidatedCamera(record.PackageCamera);
            LensNextXmlUpVector.FromOptionalValidatedCamera(record.PackageCamera);
            LensNextXmlProjection.FromValidatedCamera(record.PackageCamera);
            LensNextXmlCameraScale.FromOptionalValidatedCamera(record.PackageCamera);
            LensNextXmlSectioning.FromOptionalJson(record.PackageSectioningJson, LensNextXmlLinearUnit.FromCamera(record.PackageCamera));
        }

        private static string DiagnosticReasonCode(LensNextXmlExportInput record)
        {
            if (record.PackageServerId != record.ServerId ||
                !string.Equals(record.PackageViewpointId, record.ViewpointId, StringComparison.Ordinal) ||
                !string.Equals(record.PackageLifecycleStatus, record.LifecycleStatus, StringComparison.Ordinal) ||
                record.PackageRevisionNumber != record.RevisionNumber)
                return "legacy_identity_mismatch";
            if (record.PackageCamera != null && Fails(() => LensNextXmlLinearUnit.FromCamera(record.PackageCamera)))
                return "legacy_spatial_unit_unresolved";
            if (Fails(() => LensNextXmlPosition.FromValidatedCamera(record.PackageCamera)))
                return record.PackageCamera == null ? "missing_camera" : "invalid_position";
            if (Fails(() => LensNextXmlRotation.FromValidatedCamera(record.PackageCamera))) return "invalid_rotation";
            if (Fails(() => LensNextXmlUpVector.FromOptionalValidatedCamera(record.PackageCamera))) return "invalid_up_vector";
            if (Fails(() => LensNextXmlProjection.FromValidatedCamera(record.PackageCamera))) return "invalid_projection";
            if (Fails(() => LensNextXmlCameraScale.FromOptionalValidatedCamera(record.PackageCamera))) return "invalid_scale";
            if (Fails(() => LensNextXmlSectioning.FromOptionalJson(record.PackageSectioningJson, LensNextXmlLinearUnit.FromCamera(record.PackageCamera)))) return "invalid_sectioning";
            throw new InvalidOperationException("The rejected BIMLog XML export record has no reproducible diagnostic category.");
        }

        private static bool Fails(Action validation)
        {
            try { validation(); return false; }
            catch (InvalidDataException) { return true; }
        }

        private static bool IsLifecycle(string value) =>
            string.Equals(value, "active", StringComparison.Ordinal) ||
            string.Equals(value, "superseded", StringComparison.Ordinal) ||
            string.Equals(value, "voided", StringComparison.Ordinal);

        private static bool IsSha256(string value) =>
            value != null && value.Length == 64 && value.All(character =>
                (character >= '0' && character <= '9') ||
                (character >= 'a' && character <= 'f') ||
                (character >= 'A' && character <= 'F'));
    }

}
