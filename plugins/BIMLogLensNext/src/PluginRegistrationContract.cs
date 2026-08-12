namespace BIMLogLensNext
{
    public sealed class PluginRegistrationContract
    {
        public string AssemblyName => LensNextConstants.AssemblyName;
        public string DllName => LensNextConstants.DllName;
        public string DockPluginId => LensNextConstants.DockPluginId;
        public string DockPanelId => LensNextConstants.DockPanelId;
        public string ButtonPluginId => LensNextConstants.ButtonPluginId;
        public string InstallationFolder => LensNextConstants.InstallationFolder;
        public string BridgeOrigin => LensNextConstants.BridgeOrigin;
        public bool RegistersNativePluginAttributes => false;
        public string NativeBindingState => "abstract_until_authoritative_f_root_navisworks_references_are_bound";
    }
}
