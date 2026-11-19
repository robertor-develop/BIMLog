using System;
using System.Collections.Generic;

namespace BIMLogLensNext
{
    public interface ILensNextRevitHost
    {
        string ActiveDocumentGuid { get; }
        string ActiveCentralModelGuid { get; }
        int RevitMajorVersion { get; }
        bool ActivateCoordinationView(LensNextRevitNavigationTarget target);
        bool ShowPoint(LensNextPointState point);
        int SelectElements(IReadOnlyCollection<long> elementIds);
    }

    public sealed class LensNextRevitNavigator
    {
        private readonly ILensNextRevitHost _host;

        public LensNextRevitNavigator(ILensNextRevitHost host)
        {
            _host = host ?? throw new ArgumentNullException(nameof(host));
        }

        public LensNextOpenInRevitReceipt Apply(LensNextOpenInRevitRequest request, string expectedSessionId, DateTimeOffset now)
        {
            var digest = LensNextOpenInRevitPolicy.ValidateRequest(request, expectedSessionId, now);
            LensNextRevitCoordinateResolver.EnsureDocumentMatch(request.Target.Model, _host.ActiveDocumentGuid, _host.ActiveCentralModelGuid, _host.RevitMajorVersion);
            var viewActivated = _host.ActivateCoordinationView(request.Target);
            if (!viewActivated) return Receipt(request, digest, false, false, 0, now, "blocked");
            var pointShown = _host.ShowPoint(request.Target.RevitInternalPoint);
            if (!pointShown) return Receipt(request, digest, true, false, 0, now, "blocked");
            var selected = request.Target.RevitElementIds.Count == 0 ? 0 : _host.SelectElements(request.Target.RevitElementIds);
            if (selected < 0 || selected > request.Target.RevitElementIds.Count)
                throw new InvalidOperationException("Revit host returned an impossible selected-element count.");
            var receipt = Receipt(request, digest, true, true, selected, now, "opened");
            LensNextOpenInRevitPolicy.ValidateReceipt(request, receipt, digest);
            return receipt;
        }

        private LensNextOpenInRevitReceipt Receipt(LensNextOpenInRevitRequest request, string digest, bool viewActivated, bool pointShown, int selected, DateTimeOffset now, string outcome)
        {
            return new LensNextOpenInRevitReceipt {
                RequestId = request.RequestId,
                ProjectId = request.Target.ProjectId,
                IssueId = request.Target.IssueId,
                TargetDigest = digest,
                DocumentGuid = _host.ActiveDocumentGuid,
                RevitMajorVersion = _host.RevitMajorVersion,
                ViewActivated = viewActivated,
                PointShown = pointShown,
                ElementsSelected = selected,
                AppliedAt = now,
                Outcome = outcome
            };
        }
    }
}
