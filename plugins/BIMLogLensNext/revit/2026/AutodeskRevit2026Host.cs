using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using BIMLogLensNext;

namespace BIMLogLensNext.Revit2026;

/// <summary>Real Revit 2026 adapter. It deliberately refuses document or coordinate guesses.</summary>
public sealed class AutodeskRevit2026Host : ILensNextRevitHost
{
    private readonly UIApplication _application;
    private readonly UIDocument _uiDocument;

    public AutodeskRevit2026Host(UIApplication application)
    {
        _application = application ?? throw new ArgumentNullException(nameof(application));
        _uiDocument = application.ActiveUIDocument ?? throw new InvalidOperationException("Open in Revit requires an active project document.");
    }

    public string ActiveDocumentGuid => _uiDocument.Document.GetDocumentVersion().VersionGUID.ToString("D");

    public string ActiveCentralModelGuid => _uiDocument.Document.IsWorkshared
        ? WorksharingUtils.GetCentralGUID(_uiDocument.Document).ToString("D")
        : string.Empty;

    public int RevitMajorVersion => int.TryParse(_application.Application.VersionNumber, out var version) ? version : 0;

    public bool ActivateCoordinationView(LensNextRevitNavigationTarget target)
    {
        ArgumentNullException.ThrowIfNull(target);
        var view = new FilteredElementCollector(_uiDocument.Document)
            .OfClass(typeof(View3D))
            .Cast<View3D>()
            .Where(candidate => !candidate.IsTemplate)
            .OrderByDescending(candidate => string.Equals(candidate.Name, "{3D}", StringComparison.OrdinalIgnoreCase))
            .ThenBy(candidate => candidate.Name, StringComparer.OrdinalIgnoreCase)
            .FirstOrDefault();
        if (view is null) return false;
        _uiDocument.ActiveView = view;
        return true;
    }

    public bool ShowPoint(LensNextPointState point)
    {
        ArgumentNullException.ThrowIfNull(point);
        const double radiusInFeet = 5.0;
        var center = new XYZ(point.X, point.Y, point.Z);
        _uiDocument.GetOpenUIViews()
            .FirstOrDefault(candidate => candidate.ViewId == _uiDocument.ActiveView.Id)?
            .ZoomAndCenterRectangle(
                center - new XYZ(radiusInFeet, radiusInFeet, radiusInFeet),
                center + new XYZ(radiusInFeet, radiusInFeet, radiusInFeet));
        return true;
    }

    public int SelectElements(IReadOnlyCollection<long> elementIds)
    {
        ArgumentNullException.ThrowIfNull(elementIds);
        var existing = elementIds
            .Select(value => new ElementId(value))
            .Where(id => _uiDocument.Document.GetElement(id) is not null)
            .ToList();
        _uiDocument.Selection.SetElementIds(existing);
        if (existing.Count > 0) _uiDocument.ShowElements(existing);
        return existing.Count;
    }
}
