namespace BIMLogLensNext
{
    public sealed class PluginRegistrationContract
    {
        public string CoreAssemblyName => LensNextConstants.AssemblyName;
        public string CoreDllName => LensNextConstants.DllName;
        public string NativePluginAssemblyName2021 => LensNextConstants.NativePluginAssemblyName2021;
        public string NativePluginDllName2021 => LensNextConstants.NativePluginDllName2021;
        public string DockPluginId => LensNextConstants.DockPluginId;
        public string DockPanelId => LensNextConstants.DockPanelId;
        public string ButtonPluginId => LensNextConstants.ButtonPluginId;
        public string InstallationFolder => LensNextConstants.InstallationFolder;
        public string BridgeOrigin => "http://127.0.0.1:<allocated-" + LensNextConstants.BridgeMinimumPort + "-" + LensNextConstants.BridgeMaximumPort + ">";
        public bool RegistersNativePluginAttributes => true;
        public string NativeBindingState => "native_2021_field_loading_baseline_protected";
    }
}
