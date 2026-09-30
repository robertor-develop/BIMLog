using System;
using System.Linq;
using System.Reflection;
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

            var redlineSource = _document.SavedViewpoints.CurrentSavedViewpoint as SavedViewpoint;
            var hasRedline = HasCurrentSavedViewpointRedlines();
            var detached = hasRedline
                ? CreateUniqueRedlineCopy(redlineSource)
                : new SavedViewpoint(current);
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
                HasRedline = hasRedline,
                RedlinePersistence = hasRedline ? "native-saved-viewpoint-copy" : "not-present",
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
                HasRedline = HasRedlines(exact),
                RedlinePersistence = HasRedlines(exact) ? "native-saved-viewpoint" : "not-present",
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
                hasRedline = HasRedlines(viewpoint),
                redlinePersistence = HasRedlines(viewpoint) ? "native-saved-viewpoint-copy" : "not-present",
                confirmationReason = request.ConfirmationReason,
                publishedAt = DateTimeOffset.UtcNow.ToString("o")
            });

            _document.SavedViewpoints.AddComment(
                viewpoint,
                new Comment(marker, CommentStatus.New)
            );
        }

        private static SavedViewpoint CreateUniqueRedlineCopy(SavedViewpoint source)
        {
            if (source == null || !HasRedlines(source))
                throw new InvalidOperationException("A native redline Saved Viewpoint is required before publishing a redline-bearing BIMLog viewpoint.");
            var method = source.GetType().GetMethod("CreateUniqueCopy", BindingFlags.Public | BindingFlags.Instance, null, Type.EmptyTypes, null);
            if (method == null)
                throw new InvalidOperationException("This Navisworks version cannot create a redline-preserving Saved Viewpoint copy.");
            var copy = method.Invoke(source, null) as SavedViewpoint;
            if (copy == null || ReferenceEquals(copy, source))
                throw new InvalidOperationException("Navisworks did not return an independent redline-preserving Saved Viewpoint copy.");
            if (!HasRedlines(copy))
                throw new InvalidOperationException("The copied Saved Viewpoint did not preserve its native redline markup.");
            return copy;
        }

        private static bool HasRedlines(SavedViewpoint viewpoint)
        {
            if (viewpoint == null) return false;
            var property = viewpoint.GetType().GetProperty("ContainsRedlines") ?? viewpoint.GetType().GetProperty("HasRedlines");
            var value = property == null ? null : property.GetValue(viewpoint, null);
            return value is bool && (bool)value;
        }
    }
}
