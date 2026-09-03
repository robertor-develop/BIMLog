using System;
using System.Collections.Generic;
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
        public static IReadOnlyList<LensNextXmlExportInput> SelectOrdered(
            int authoritativeProjectId,
            IEnumerable<LensNextXmlExportInput> records)
        {
            if (authoritativeProjectId <= 0)
                throw new ArgumentOutOfRangeException(nameof(authoritativeProjectId), "An authoritative BIMLog project ID is required.");
            if (records == null) throw new ArgumentNullException(nameof(records));

            var active = new List<LensNextXmlExportInput>();
            var serverIds = new HashSet<int>();
            foreach (var record in records)
            {
                if (record == null) throw new InvalidDataException("The BIMLog export collection contains a null record.");
                if (record.ProjectId != authoritativeProjectId)
                    throw new InvalidDataException("A cross-project BIMLog viewpoint cannot enter the export collection.");
                if (!IsLifecycle(record.LifecycleStatus))
                    throw new InvalidDataException("The BIMLog viewpoint lifecycle state is invalid.");
                if (!string.Equals(record.LifecycleStatus, "active", StringComparison.Ordinal)) continue;

                ValidateActiveRecord(record);
                if (!serverIds.Add(record.ServerId))
                    throw new InvalidDataException("The BIMLog export collection contains a duplicate server viewpoint ID.");
                active.Add(record);
            }

            return active
                .OrderBy(record => record.Priority ?? int.MaxValue)
                .ThenByDescending(record => record.CapturedAt.HasValue ? record.CapturedAt.Value.UtcDateTime.Ticks : 0L)
                .ThenBy(record => record.ServerId)
                .ToArray();
        }

        private static void ValidateActiveRecord(LensNextXmlExportInput record)
        {
            if (record.ServerId <= 0 || string.IsNullOrWhiteSpace(record.ViewpointId) || record.RevisionNumber <= 0)
                throw new InvalidDataException("The active BIMLog viewpoint identity is incomplete.");
            if (record.Priority.HasValue && (record.Priority.Value < 1 || record.Priority.Value > 5))
                throw new InvalidDataException("The active BIMLog viewpoint priority is invalid.");
            if (!IsSha256(record.VisualStateDigest) || !IsSha256(record.PackageDigest) ||
                !string.Equals(record.VisualStateDigest, record.PackageDigest, StringComparison.OrdinalIgnoreCase))
                throw new InvalidDataException("The active BIMLog viewpoint package digest is invalid or mismatched.");
            if (record.PackageProjectId != record.ProjectId || record.PackageServerId != record.ServerId ||
                !string.Equals(record.PackageViewpointId, record.ViewpointId, StringComparison.Ordinal) ||
                !string.Equals(record.PackageLifecycleStatus, record.LifecycleStatus, StringComparison.Ordinal) ||
                record.PackageRevisionNumber != record.RevisionNumber)
                throw new InvalidDataException("The active BIMLog viewpoint package identity is mismatched.");
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
