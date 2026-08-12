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
        LensNextProjectContext ReadProjectContext();
        IReadOnlyCollection<WorkingViewCandidate> FindExistingWorkingViews(
            ImmutableWorkingViewIdentity identity);
        bool OpenExistingWorkingView(WorkingViewCandidate candidate);
    }

    public sealed class LensNextProjectContext
    {
        public string SessionId { get; set; }
        public string ProjectId { get; set; }
        public string ModelFingerprint { get; set; }
        public string DisplayName { get; set; }
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
