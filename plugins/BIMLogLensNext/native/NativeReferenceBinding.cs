using System.Reflection;

namespace BIMLogLensNext.Native
{
    public static class NativeReferenceBinding
    {
        public static string ProductYear => ThisAssemblyProductYear.Value;

        public static string NavisworksApiAssemblyVersion =>
            AssemblyName.GetAssemblyName(ThisAssemblyProductYear.ApiPath).Version.ToString();
    }
}
