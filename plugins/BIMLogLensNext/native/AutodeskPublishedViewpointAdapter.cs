using System;
using System.Linq;
using System.Web.Script.Serialization;
using Autodesk.Navisworks.Api;

namespace BIMLogLensNext.Native
{
    public sealed partial class AutodeskLensNextReadOnlyAdapter :
        ILensNextPublishNavisworksAdapter
    {
        private readonly JavaScriptSerializer _publishJson =
            new JavaScriptSerializer();

        public LensNextPublishResult PublishCurrentWorkingView(
            LensNextPublishRequest request
        )
        {
            EnsureSameDocument();

            var errors = LensNextPublishPolicy.Validate(request);
            if (errors.Count != 0)
                throw new InvalidOperationException(
                    string.Join("; ", errors)
                );

            if (!_contract.MatchesContext(request.IssueIdentity))
                throw new InvalidOperationException(
                    "Publish request does not match the active BIMLog project/model context."
                );

            return request.UpdateExisting
                ? UpdateExactPublishedViewpoint(request)
                : CreatePublishedViewpoint(request);
        }

        private LensNextPublishResult CreatePublishedViewpoint(
            LensNextPublishRequest request
        )
        {
            var currentProperty = _document.CurrentViewpoint
                .GetType()
                .GetProperty("Viewpoint");

            var current = currentProperty == null
                ? null
                : currentProperty.GetValue(
                    _document.CurrentViewpoint,
                    null
                ) as Viewpoint;

            if (current == null)
                throw new InvalidOperationException(
                    "Current Navisworks viewpoint could not be captured for publishing."
                );

            var detached = new SavedViewpoint(current);
            detached.DisplayName = request.DisplayName.Trim();

            _document.SavedViewpoints.AddCopy(detached);

            var candidates = _document.SavedViewpoints.Value
                .OfType<SavedViewpoint>()
                .Where(view =>
                    string.Equals(
                        view.DisplayName,
                        detached.DisplayName,
                        StringComparison.Ordinal
                    )
                )
                .ToArray();

            if (candidates.Length != 1)
                throw new InvalidOperationException(
                    "Published viewpoint creation could not be proven uniquely after insertion."
                );

            var created = candidates[0];
            AddPublishMarker(created, request);

            var exact = _document.SavedViewpoints.ResolveGuid(
                created.Guid
            ) as SavedViewpoint;

            if (exact == null || exact.Guid == Guid.Empty)
                throw new InvalidOperationException(
                    "Published viewpoint identity could not be reacquired."
                );

            return new LensNextPublishResult
            {
                Published = true,
                UpdatedExisting = false,
                NavisworksGuid = exact.Guid.ToString("D"),
                DisplayName = exact.DisplayName,
                Message =
                    "Published exact current Working View as a new SavedViewpoint."
            };
        }

        private LensNextPublishResult UpdateExactPublishedViewpoint(
            LensNextPublishRequest request
        )
        {
            Guid guid;

            if (
                !Guid.TryParse(
                    request.ExistingPublishedIdentity.NavisworksGuid,
                    out guid
                ) ||
                guid == Guid.Empty
            )
                throw new InvalidOperationException(
                    "Existing published Navisworks GUID is invalid."
                );

            var current = _document.SavedViewpoints.ResolveGuid(
                guid
            ) as SavedViewpoint;

            if (current == null || current.Guid != guid)
                throw new InvalidOperationException(
                    "The exact published SavedViewpoint no longer exists. Update is blocked."
                );

            _document.SavedViewpoints.ReplaceFromCurrentView(current);

            var reacquired = _document.SavedViewpoints.ResolveGuid(
                guid
            ) as SavedViewpoint;

            if (reacquired == null || reacquired.Guid != guid)
                throw new InvalidOperationException(
                    "Published SavedViewpoint identity changed during update; operation is blocked."
                );

            if (
                !string.Equals(
                    reacquired.DisplayName,
                    request.DisplayName.Trim(),
                    StringComparison.Ordinal
                )
            )
                _document.SavedViewpoints.EditDisplayName(
                    reacquired,
                    request.DisplayName.Trim()
                );

            reacquired = _document.SavedViewpoints.ResolveGuid(
                guid
            ) as SavedViewpoint;

            if (reacquired == null || reacquired.Guid != guid)
                throw new InvalidOperationException(
                    "Published SavedViewpoint could not be reacquired after rename."
                );

            AddPublishMarker(reacquired, request);

            var exact = _document.SavedViewpoints.ResolveGuid(
                guid
            ) as SavedViewpoint;

            if (exact == null || exact.Guid != guid)
                throw new InvalidOperationException(
                    "Published SavedViewpoint could not be reacquired after metadata update."
                );

            return new LensNextPublishResult
            {
                Published = true,
                UpdatedExisting = true,
                NavisworksGuid = exact.Guid.ToString("D"),
                DisplayName = exact.DisplayName,
                Message =
                    "Updated exact published SavedViewpoint from the current Working View."
            };
        }

        private void AddPublishMarker(
            SavedViewpoint viewpoint,
            LensNextPublishRequest request
        )
        {
            var marker = _publishJson.Serialize(new
            {
                marker = LensNextConstants.PublishedViewpointMarker,
                projectId = request.IssueIdentity.ProjectId,
                serverId = request.IssueIdentity.ServerId,
                viewpointId = request.IssueIdentity.ViewpointId,
                lifecycleStatus =
                    request.IssueIdentity.LifecycleStatus,
                revisionNumber =
                    request.IssueIdentity.RevisionNumber,
                modelFingerprint =
                    request.IssueIdentity.ModelFingerprint,
                operationId = request.OperationId,
                visualDigest = request.ExpectedVisualDigest,
                confirmationReason = request.ConfirmationReason,
                publishedAt = DateTimeOffset.UtcNow.ToString("o")
            });

            _document.SavedViewpoints.AddComment(
                viewpoint,
                new Comment(marker, CommentStatus.New)
            );
        }
    }
}