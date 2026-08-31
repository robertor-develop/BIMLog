using System;
using System.Collections.Generic;

namespace BIMLogLensNext
{
    public enum LensNextRole
    {
        ProjectAdmin,
        LeadCoordinator,
        TradeCoordinator,
        Reviewer,
        Viewer
    }

    public enum LensNextPermission
    {
        CreateIssue,
        Comment,
        Assign,
        ChangeStatus,
        Resolve,
        Reopen,
        UpdateVisualState,
        Publish,
        BulkPublish,
        Migrate,
        ResolveDuplicates
    }

    public static class LensNextRolePolicy
    {
        private static readonly IReadOnlyDictionary<LensNextRole, HashSet<LensNextPermission>> Rules =
            new Dictionary<LensNextRole, HashSet<LensNextPermission>>
            {
                { LensNextRole.ProjectAdmin, All() },
                { LensNextRole.LeadCoordinator, Set(LensNextPermission.CreateIssue, LensNextPermission.Comment, LensNextPermission.Assign, LensNextPermission.ChangeStatus, LensNextPermission.Resolve, LensNextPermission.Reopen, LensNextPermission.UpdateVisualState, LensNextPermission.Publish, LensNextPermission.BulkPublish) },
                { LensNextRole.TradeCoordinator, Set(LensNextPermission.CreateIssue, LensNextPermission.Comment, LensNextPermission.ChangeStatus, LensNextPermission.UpdateVisualState, LensNextPermission.Publish) },
                { LensNextRole.Reviewer, Set(LensNextPermission.Comment, LensNextPermission.ChangeStatus, LensNextPermission.Resolve, LensNextPermission.Reopen) },
                { LensNextRole.Viewer, Set() }
            };

        public static bool Can(LensNextRole role, LensNextPermission permission) => Rules[role].Contains(permission);

        private static HashSet<LensNextPermission> All() => new HashSet<LensNextPermission>((LensNextPermission[])Enum.GetValues(typeof(LensNextPermission)));
        private static HashSet<LensNextPermission> Set(params LensNextPermission[] values) => new HashSet<LensNextPermission>(values);
    }

    public sealed class LensNextActorFootprint
    {
        public string UserId { get; set; }
        public string FullName { get; set; }
        public string CompanyId { get; set; }
        public string CompanyName { get; set; }
        public LensNextRole Role { get; set; }
        public string NavisworksSessionId { get; set; }
    }

    public sealed class LensNextConcurrencyPrecondition
    {
        public int ProjectId { get; set; }
        public int ServerId { get; set; }
        public int Version { get; set; }
        public int RevisionNumber { get; set; }
        public string ModelFingerprint { get; set; }
        public string VisualStateDigest { get; set; }
    }

    public static class LensNextConcurrencyPolicy
    {
        public static string Evaluate(LensNextConcurrencyPrecondition expected, LensNextConcurrencyPrecondition current)
        {
            if (expected == null || current == null) return "PRECONDITION_REQUIRED";
            if (expected.ProjectId != current.ProjectId || expected.ServerId != current.ServerId) return "IMMUTABLE_IDENTITY_MISMATCH";
            if (!string.Equals(expected.ModelFingerprint, current.ModelFingerprint, StringComparison.Ordinal)) return "MODEL_VERSION_MISMATCH";
            if (expected.Version != current.Version || expected.RevisionNumber != current.RevisionNumber) return "VERSION_CONFLICT";
            return "ALLOWED";
        }
    }
}
