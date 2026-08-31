using System;
using System.Collections.Generic;

namespace BIMLogLensNext
{
    public static class LensNextConstants
    {
        public const string ProductVersionLabel = "v1.05.N01-P01";
        public const string AssemblyName = "BIMLogLensNext";
        public const string DllName = "BIMLogLensNext.dll";
        public const string NativePluginAssemblyName2021 = "BIMLogLensNext.Native2021";
        public const string NativePluginDllName2021 = "BIMLogLensNext.Native2021.dll";
        public const string RootNamespace = "BIMLogLensNext";
        public const string DockPluginId = "BIMLogLensNext.IgniteSmart";
        public const string DockPanelId = "BIMLogLensNext.IgniteSmart";
        public const string ButtonPluginId = "BIMLogLensNextButton.IgniteSmart";
        public const string CommandPrefix = "BIMLogLensNext";
        public const string InstallationFolder = "BIMLogLensNext";
        public const string InstallerDefinition = "Install-BIMLogLensNext";
        public const string UninstallerDefinition = "Uninstall-BIMLogLensNext";

        public const string ConfigurationRoot = @"%LOCALAPPDATA%\BIMLog\LensNext";
        public const string ConfigurationFile = "lens-next.config.json";
        public const string CacheRoot = @"%LOCALAPPDATA%\BIMLog\LensNext\cache";
        public const string LogRoot = @"%LOCALAPPDATA%\BIMLog\LensNext\logs";

        public const string FeatureFlagPrefix = "lens_next.";
        public const string MetadataNamespace = "bimlog.lens_next.v1";
        public const string MetadataSource = "BIMLogLensNext";
        public const string PublishedViewpointFolder = "BIMLog Lens Next Published";
        public const string PublishedViewpointMarker = "bimlog.lens_next.published.v1";

        public const string BridgeHost = "127.0.0.1";
        public const int BridgeMinimumPort = 8766;
        public const int BridgeMaximumPort = 8865;
        public const int BridgePort = BridgeMinimumPort;
        public const string BridgeOrigin = "http://127.0.0.1:8766";
        public const int BridgeProtocolVersion = 1;
        public const int BridgeRequestTimeoutMilliseconds = 5000;
        public const int BridgeCaptureRequestTimeoutMilliseconds = 60000;
        public const int BridgeMaximumFieldCount = 16;
        public const int BridgeMaximumFieldLength = 4 * 1024 * 1024;
        public const int BridgeMaximumTokenLifetimeMinutes = 15;

        public static IReadOnlyList<string> WriteFeatureFlags { get; } = Array.AsReadOnly(new[]
        {
            "lens_next.platform_metadata_writes",
            "lens_next.status_updates",
            "lens_next.comments",
            "lens_next.camera_capture",
            "lens_next.visual_state_updates",
            "lens_next.viewpoint_publishing",
            "lens_next.project_migration",
            "lens_next.duplicate_recovery"
        });
    }
}
