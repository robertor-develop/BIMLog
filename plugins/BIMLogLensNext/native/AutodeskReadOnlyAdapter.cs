using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using Autodesk.Navisworks.Api;
using BIMLogLensNext;

namespace BIMLogLensNext.Native
{
    public sealed class AutodeskReadOnlyAdapterContract
    {
        private readonly string _projectId;
        private readonly string _modelFingerprint;

        public AutodeskReadOnlyAdapterContract(string projectId, string modelFingerprint)
        {
            int parsedProjectId;
            if (!int.TryParse(projectId, out parsedProjectId) || parsedProjectId <= 0)
            {
                throw new ArgumentException("A positive BIMLog project ID is required.", nameof(projectId));
            }
            if (!IsSha256(modelFingerprint))
            {
                throw new ArgumentException("An exact SHA-256 model fingerprint is required.", nameof(modelFingerprint));
            }

            _projectId = projectId;
            _modelFingerprint = modelFingerprint;
        }

        public string ProjectId => _projectId;
        public string ModelFingerprint => _modelFingerprint;

        public bool Matches(ImmutableWorkingViewIdentity identity)
        {
            return identity != null &&
                string.Equals(identity.ProjectId, _projectId, StringComparison.Ordinal) &&
                string.Equals(identity.ModelFingerprint, _modelFingerprint, StringComparison.Ordinal) &&
                TryParseNonEmptyGuid(identity.NavisworksGuid, out _);
        }

        public static bool TryParseNonEmptyGuid(string value, out Guid guid)
        {
            return Guid.TryParse(value, out guid) && guid != Guid.Empty;
        }

        private static bool IsSha256(string value)
        {
            return value != null && value.Length == 64 && value.All(character =>
                (character >= '0' && character <= '9') ||
                (character >= 'a' && character <= 'f') ||
                (character >= 'A' && character <= 'F'));
        }
    }

    public sealed class AutodeskNavisworksUiThreadDispatcher : INavisworksUiThreadDispatcher
    {
        private readonly int _ownerThreadId;

        public AutodeskNavisworksUiThreadDispatcher()
        {
            _ownerThreadId = Thread.CurrentThread.ManagedThreadId;
        }

        public T Invoke<T>(Func<T> action)
        {
            if (action == null) throw new ArgumentNullException(nameof(action));
            if (Thread.CurrentThread.ManagedThreadId != _ownerThreadId)
            {
                throw new InvalidOperationException("Navisworks read/navigation calls require the owning UI thread.");
            }
            return action();
        }
    }

    public sealed class AutodeskLensNextReadOnlyAdapter : ILensNextReadOnlyNavisworksAdapter
    {
        private readonly Document _document;
        private readonly string _documentFileName;
        private readonly AutodeskReadOnlyAdapterContract _contract;

        public AutodeskLensNextReadOnlyAdapter(Document document, string projectId, string modelFingerprint)
        {
            _document = document ?? throw new ArgumentNullException(nameof(document));
            if (_document.IsDisposed || _document.IsClear || string.IsNullOrWhiteSpace(_document.FileName))
            {
                throw new InvalidOperationException("An open named Navisworks document is required.");
            }
            _documentFileName = Path.GetFullPath(_document.FileName);
            _contract = new AutodeskReadOnlyAdapterContract(projectId, modelFingerprint);
        }

        public LensNextProjectContext ReadProjectContext()
        {
            EnsureSameDocument();
            return new LensNextProjectContext
            {
                ProjectId = _contract.ProjectId,
                ModelFingerprint = _contract.ModelFingerprint,
                DisplayName = string.IsNullOrWhiteSpace(_document.Title)
                    ? Path.GetFileName(_documentFileName)
                    : _document.Title
            };
        }

        public IReadOnlyCollection<WorkingViewCandidate> FindExistingWorkingViews(
            ImmutableWorkingViewIdentity identity)
        {
            EnsureSameDocument();
            if (!_contract.Matches(identity)) return Array.Empty<WorkingViewCandidate>();

            Guid nativeGuid;
            if (!AutodeskReadOnlyAdapterContract.TryParseNonEmptyGuid(identity.NavisworksGuid, out nativeGuid))
            {
                return Array.Empty<WorkingViewCandidate>();
            }

            var savedViewpoint = _document.SavedViewpoints.ResolveGuid(nativeGuid) as SavedViewpoint;
            if (savedViewpoint == null || savedViewpoint.Guid != nativeGuid)
            {
                return Array.Empty<WorkingViewCandidate>();
            }

            return Array.AsReadOnly(new[]
            {
                new WorkingViewCandidate
                {
                    ProjectId = identity.ProjectId,
                    ServerId = identity.ServerId,
                    ViewpointId = identity.ViewpointId,
                    LifecycleStatus = identity.LifecycleStatus,
                    RevisionNumber = identity.RevisionNumber,
                    ModelFingerprint = identity.ModelFingerprint,
                    BimlogPhysicalId = identity.BimlogPhysicalId,
                    NavisworksGuid = nativeGuid.ToString("D"),
                    NativeHandle = savedViewpoint
                }
            });
        }

        public bool OpenExistingWorkingView(WorkingViewCandidate candidate)
        {
            EnsureSameDocument();
            if (candidate == null || candidate.NativeHandle == null) return false;
            if (!string.Equals(candidate.ProjectId, _contract.ProjectId, StringComparison.Ordinal) ||
                !string.Equals(candidate.ModelFingerprint, _contract.ModelFingerprint, StringComparison.Ordinal))
            {
                return false;
            }

            var savedViewpoint = candidate.NativeHandle as SavedViewpoint;
            Guid requestedGuid;
            if (savedViewpoint == null ||
                !AutodeskReadOnlyAdapterContract.TryParseNonEmptyGuid(candidate.NavisworksGuid, out requestedGuid) ||
                savedViewpoint.Guid != requestedGuid)
            {
                return false;
            }

            var currentObject = _document.SavedViewpoints.ResolveGuid(requestedGuid) as SavedViewpoint;
            if (currentObject == null || currentObject.Guid != requestedGuid) return false;
            _document.SavedViewpoints.CurrentSavedViewpoint = currentObject;
            return true;
        }

        private void EnsureSameDocument()
        {
            if (_document.IsDisposed || _document.IsClear || string.IsNullOrWhiteSpace(_document.FileName) ||
                !string.Equals(Path.GetFullPath(_document.FileName), _documentFileName, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("The active Navisworks document changed; recreate the bridge session.");
            }
        }
    }
}
