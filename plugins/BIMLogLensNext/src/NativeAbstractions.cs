using System;
using System.Collections.Generic;

namespace BIMLogLensNext
{
    public interface INavisworksUiThreadDispatcher
    {
        T Invoke<T>(Func<T> action);
    }

    public interface ILensNextReadOnlyNavisworksAdapter
    {
        LensNextProjectContext BindProject(string projectId, string bindingSource);
        LensNextProjectContext ReadProjectContext();
        LensNextLocalInventory ReadLocalInventory();
        LensNextLocalViewpoint OpenExactManagedLocalViewpoint(string projectId, string navisworksGuid);
        IReadOnlyCollection<WorkingViewCandidate> FindExistingWorkingViews(
            ImmutableWorkingViewIdentity identity);
        bool OpenExistingWorkingView(WorkingViewCandidate candidate);
    }


    public interface ILensNextVisualNavisworksAdapter
    {
        LensNextNavigationView CaptureCurrentNavigationView(
            ImmutableWorkingViewIdentity identity,
            bool includeScreenshot);
        LensNextNavigationApplyResult ApplyNavigationViewJson(
            ImmutableWorkingViewIdentity identity,
            string navigationJson,
            string storedDigest,
            string operationId);
        LensNextVisualState CaptureCurrentVisualState(
            ImmutableWorkingViewIdentity identity,
            bool includeScreenshot);
        LensNextVisualApplyResult ApplyWorkingVisualStateJson(
            ImmutableWorkingViewIdentity identity,
            string visualStateJson,
            string storedVisualStateDigest,
            string operationId);
    }

    public sealed class LensNextProjectContext
    {
        public string SessionId { get; set; }
        public string ProjectId { get; set; }
        public string ModelFingerprint { get; set; }
        public string DisplayName { get; set; }
        public string BindingSource { get; set; }
        public string ModelBindingKey { get; set; }
        public int ManagedViewpointCount { get; set; }
    }

    public sealed class LensNextLocalInventory
    {
        public string ProjectId { get; set; }
        public string ModelFingerprint { get; set; }
        public string ModelBindingKey { get; set; }
        public IReadOnlyCollection<LensNextLocalViewpoint> Viewpoints { get; set; }
    }

    public sealed class LensNextLocalViewpoint
    {
        public string ProjectId { get; set; }
        public string ServerId { get; set; }
        public string ViewpointId { get; set; }
        public string DisplayId { get; set; }
        public string BimlogPhysicalId { get; set; }
        public string NavisworksGuid { get; set; }
        public string DisplayName { get; set; }
        public string FolderPath { get; set; }
        public string Note { get; set; }
        public string Trade { get; set; }
        public string ResponsibleCompany { get; set; }
        public string ReportType { get; set; }
        public string Floor { get; set; }
        public string Priority { get; set; }
        public string OpenItems { get; set; }
        public string Status { get; set; }
        public bool ExactManagedIdentity { get; set; }
        public bool LensNextPublished { get; set; }
    }

    public sealed class InlineUiThreadDispatcher : INavisworksUiThreadDispatcher
    {
        public T Invoke<T>(Func<T> action)
        {
            if (action == null)
            {
                throw new ArgumentNullException(nameof(action));
            }

            return action();
        }
    }
}
