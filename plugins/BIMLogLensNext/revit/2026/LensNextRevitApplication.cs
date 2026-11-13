using Autodesk.Revit.UI;

namespace BIMLogLensNext.Revit2026;

public sealed class LensNextRevitApplication : IExternalApplication
{
    public Result OnStartup(UIControlledApplication application)
    {
        ArgumentNullException.ThrowIfNull(application);
        return Result.Succeeded;
    }

    public Result OnShutdown(UIControlledApplication application)
    {
        return Result.Succeeded;
    }
}
