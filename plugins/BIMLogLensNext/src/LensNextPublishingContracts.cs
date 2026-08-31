using System;
using System.Collections.Generic;

namespace BIMLogLensNext
{
    public sealed class LensNextPublishedIdentity
    {
        public int ProjectId { get; set; }
        public int ServerId { get; set; }
        public string ViewpointId { get; set; }
        public string LifecycleStatus { get; set; }
        public int RevisionNumber { get; set; }
        public string ModelFingerprint { get; set; }
        public string PublishedRecordId { get; set; }
        public string NavisworksGuid { get; set; }
        public int PublishVersion { get; set; }

        public IReadOnlyList<string> Validate()
        {
            var errors = new List<string>();

            if (ProjectId <= 0) errors.Add("projectId must be positive");
            if (ServerId <= 0) errors.Add("serverId must be positive");
            if (string.IsNullOrWhiteSpace(ViewpointId))
                errors.Add("viewpointId is required");
            if (string.IsNullOrWhiteSpace(LifecycleStatus))
                errors.Add("lifecycleStatus is required");
            if (RevisionNumber <= 0)
                errors.Add("revisionNumber must be positive");
            if (string.IsNullOrWhiteSpace(ModelFingerprint) ||
                ModelFingerprint.Length != 64)
                errors.Add("modelFingerprint must be an exact SHA-256 fingerprint");
            if (string.IsNullOrWhiteSpace(PublishedRecordId))
                errors.Add("publishedRecordId is required");
            if (string.IsNullOrWhiteSpace(NavisworksGuid))
                errors.Add("navisworksGuid is required");
            if (PublishVersion <= 0)
                errors.Add("publishVersion must be positive");

            return errors;
        }
    }

    public sealed class LensNextPublishRequest
    {
        public ImmutableWorkingViewIdentity IssueIdentity { get; set; }
        public LensNextPublishedIdentity ExistingPublishedIdentity { get; set; }
        public string DisplayName { get; set; }
        public string ConfirmationReason { get; set; }
        public string OperationId { get; set; }
        public string ExpectedVisualDigest { get; set; }
        public bool UpdateExisting { get; set; }
    }

    public sealed class LensNextPublishResult
    {
        public bool Published { get; set; }
        public bool UpdatedExisting { get; set; }
        public string NavisworksGuid { get; set; }
        public string DisplayName { get; set; }
        public string Message { get; set; }
    }

    public sealed class LensNextPublishedViewpointPayload
    {
        public string RequestId { get; set; }
        public LensNextWireIdentity Identity { get; set; }
        public LensNextPublishResult Result { get; set; }
    }

    public interface ILensNextPublishNavisworksAdapter
    {
        LensNextPublishResult PublishCurrentWorkingView(
            LensNextPublishRequest request
        );
    }
    public sealed class LensNextLayoutItem { public string NavisworksGuid { get; set; } public string FolderPath { get; set; } }
    public sealed class LensNextLayoutRequest { public string ProjectId { get; set; } public string ModelFingerprint { get; set; } public string LayoutJson { get; set; } public string ConfirmationReason { get; set; } }
    public sealed class LensNextLayoutResult { public int Requested { get; set; } public int Moved { get; set; } public int AlreadyPlaced { get; set; } }
    public interface ILensNextLayoutNavisworksAdapter { LensNextLayoutResult MaterializeMyView(LensNextLayoutRequest request); }

    public static class LensNextPublishPolicy
    {
        public static IReadOnlyList<string> Validate(
            LensNextPublishRequest request
        )
        {
            var errors = new List<string>();

            if (request == null)
            {
                errors.Add("publish request is required");
                return errors;
            }

            if (request.IssueIdentity == null)
                errors.Add("issue identity is required");
            else
                errors.AddRange(request.IssueIdentity.Validate());

            if (string.IsNullOrWhiteSpace(request.DisplayName))
                errors.Add("displayName is required");

            if (string.IsNullOrWhiteSpace(request.ConfirmationReason))
                errors.Add("explicit publish confirmation reason is required");

            if (string.IsNullOrWhiteSpace(request.OperationId))
                errors.Add("operationId is required");

            if (
                string.IsNullOrWhiteSpace(request.ExpectedVisualDigest) ||
                request.ExpectedVisualDigest.Length != 64
            )
                errors.Add("expectedVisualDigest must be an exact SHA-256 digest");

            if (request.UpdateExisting)
            {
                if (request.ExistingPublishedIdentity == null)
                    errors.Add(
                        "existing published identity is required for update"
                    );
                else
                    errors.AddRange(
                        request.ExistingPublishedIdentity.Validate()
                    );
            }

            return errors;
        }
    }
}
