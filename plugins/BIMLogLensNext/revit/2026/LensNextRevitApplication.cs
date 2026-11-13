using Autodesk.Revit.UI;

namespace BIMLogLensNext.Revit2026;

public sealed class LensNextRevitApplication : IExternalApplication
{
    private LensNextRevitBridgeHost? _bridge;
    public Result OnStartup(UIControlledApplication application)
    {
        ArgumentNullException.ThrowIfNull(application);
        var handler=new LensNextRevitExternalEventHandler();var externalEvent=ExternalEvent.Create(handler);_bridge=new LensNextRevitBridgeHost(handler,externalEvent);_bridge.Start();return Result.Succeeded;
    }

    public Result OnShutdown(UIControlledApplication application)
    {
        _bridge?.Dispose();_bridge=null;return Result.Succeeded;
    }
}
