using System;
using System.Collections.Generic;
using System.Linq;

namespace BIMLogLensNext
{
    public sealed class ImmutableWorkingViewIdentity
    {
        public string SessionId { get; set; }
        public string ProjectId { get; set; }
        public string ServerId { get; set; }
        public string ViewpointId { get; set; }
        public string LifecycleStatus { get; set; }
        public string RevisionNumber { get; set; }
        public string ModelFingerprint { get; set; }
        public string BimlogPhysicalId { get; set; }
        public string NavisworksGuid { get; set; }

        public IReadOnlyList<string> Validate()
        {
            var errors = new List<string>();
            Require(SessionId, "sessionId", errors);
            Require(ProjectId, "projectId", errors);
            Require(ServerId, "serverId", errors);
            Require(ViewpointId, "viewpointId", errors);
            Require(LifecycleStatus, "lifecycleStatus", errors);
            Require(RevisionNumber, "revisionNumber", errors);
            Require(ModelFingerprint, "modelFingerprint", errors);
            RequirePositiveInteger(ProjectId, "projectId", errors);
            RequirePositiveInteger(ServerId, "serverId", errors);
            RequirePositiveInteger(RevisionNumber, "revisionNumber", errors);
            if (!string.IsNullOrWhiteSpace(LifecycleStatus) &&
                !LifecycleStatus.Equals("active", StringComparison.Ordinal) &&
                !LifecycleStatus.Equals("superseded", StringComparison.Ordinal) &&
                !LifecycleStatus.Equals("voided", StringComparison.Ordinal))
            {
                errors.Add("lifecycleStatus is unsupported");
            }
            return errors;
        }

        private static void RequirePositiveInteger(string value, string field, ICollection<string> errors)
        {
            int parsed;
            if (!string.IsNullOrWhiteSpace(value) &&
                (!int.TryParse(value, out parsed) || parsed <= 0))
            {
                errors.Add(field + " must be a positive integer");
            }
        }

        private static void Require(string value, string field, ICollection<string> errors)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                errors.Add(field + " is required");
            }
        }
    }

    public sealed class WorkingViewCandidate
    {
        public string ProjectId { get; set; }
        public string ServerId { get; set; }
        public string ViewpointId { get; set; }
        public string LifecycleStatus { get; set; }
        public string RevisionNumber { get; set; }
        public string ModelFingerprint { get; set; }
        public string BimlogPhysicalId { get; set; }
        public string NavisworksGuid { get; set; }
        public object NativeHandle { get; set; }
    }

    public enum ImmutableResolutionStatus
    {
        Resolved,
        Missing,
        Ambiguous,
        Invalid
    }

    public sealed class ImmutableResolution
    {
        private ImmutableResolution(ImmutableResolutionStatus status, WorkingViewCandidate candidate, string reason)
        {
            Status = status;
            Candidate = candidate;
            Reason = reason;
        }

        public ImmutableResolutionStatus Status { get; }
        public WorkingViewCandidate Candidate { get; }
        public string Reason { get; }

        public static ImmutableResolution Resolved(WorkingViewCandidate candidate) =>
            new ImmutableResolution(ImmutableResolutionStatus.Resolved, candidate, null);

        public static ImmutableResolution Blocked(ImmutableResolutionStatus status, string reason) =>
            new ImmutableResolution(status, null, reason);
    }

    public sealed class ImmutableIdentityResolver
    {
        public ImmutableResolution Resolve(
            ImmutableWorkingViewIdentity identity,
            IEnumerable<WorkingViewCandidate> candidates)
        {
            if (identity == null)
            {
                return ImmutableResolution.Blocked(ImmutableResolutionStatus.Invalid, "identity_required");
            }

            var errors = identity.Validate();
            if (errors.Count != 0)
            {
                return ImmutableResolution.Blocked(ImmutableResolutionStatus.Invalid, string.Join("; ", errors));
            }

            var exact = (candidates ?? Enumerable.Empty<WorkingViewCandidate>())
                .Where(candidate => candidate != null)
                .Where(candidate => Equal(candidate.ProjectId, identity.ProjectId))
                .Where(candidate => Equal(candidate.ServerId, identity.ServerId))
                .Where(candidate => Equal(candidate.ViewpointId, identity.ViewpointId))
                .Where(candidate => Equal(candidate.LifecycleStatus, identity.LifecycleStatus))
                .Where(candidate => Equal(candidate.RevisionNumber, identity.RevisionNumber))
                .Where(candidate => Equal(candidate.ModelFingerprint, identity.ModelFingerprint))
                .Where(candidate => OptionalEqual(candidate.BimlogPhysicalId, identity.BimlogPhysicalId))
                .Where(candidate => OptionalEqual(candidate.NavisworksGuid, identity.NavisworksGuid))
                .Take(2)
                .ToArray();

            if (exact.Length == 0)
            {
                return ImmutableResolution.Blocked(ImmutableResolutionStatus.Missing, "identity_not_found");
            }

            if (exact.Length > 1)
            {
                return ImmutableResolution.Blocked(ImmutableResolutionStatus.Ambiguous, "identity_ambiguous");
            }

            return ImmutableResolution.Resolved(exact[0]);
        }

        private static bool Equal(string left, string right) =>
            string.Equals(left, right, StringComparison.Ordinal);

        private static bool OptionalEqual(string candidate, string requested) =>
            string.IsNullOrWhiteSpace(requested) || Equal(candidate, requested);
    }
}
