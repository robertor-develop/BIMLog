using System;
using System.Globalization;
using System.IO;
using Autodesk.Navisworks.Api;
using Autodesk.Navisworks.Api.ComApi;
using Autodesk.Navisworks.Api.Plugins;

namespace Build19SectioningProbe
{
    [Plugin("Build19SectioningProbeV3", "BIMLog")]
    public sealed class SectioningProbePlugin : AddInPlugin
    {
        private const string Payload = "{\"Type\":\"ClipPlaneSet\",\"Version\":1,\"Planes\":[{\"Type\":\"ClipPlane\",\"Version\":1,\"Normal\":[0,0,-1],\"Distance\":-53.1620981117,\"Enabled\":true}],\"Linked\":false,\"Enabled\":true}";
        private const string MultiplePayload = "{\"Type\":\"ClipPlaneSet\",\"Version\":1,\"Planes\":[{\"Type\":\"ClipPlane\",\"Version\":1,\"Normal\":[1,0,0],\"Distance\":-10.5,\"Enabled\":true},{\"Type\":\"ClipPlane\",\"Version\":1,\"Normal\":[0,1,0],\"Distance\":20.25,\"Enabled\":false}],\"Linked\":true,\"Enabled\":true}";

        public override int Execute(params string[] parameters)
        {
            if (parameters == null || parameters.Length != 1) throw new ArgumentException("One output directory is required.");
            var outputDirectory = Path.GetFullPath(parameters[0]); Directory.CreateDirectory(outputDirectory);
            var document = Autodesk.Navisworks.Api.Application.ActiveDocument;
            document.SavedViewpoints.Clear();
            var before = document.ActiveView.GetClippingPlanes();
            var setSucceeded = document.ActiveView.TrySetClippingPlanes(Payload);
            var after = document.ActiveView.GetClippingPlanes();
            File.WriteAllText(Path.Combine(outputDirectory, "inactive-sectioning.json"), before ?? "<null>");
            File.WriteAllText(Path.Combine(outputDirectory, "requested-sectioning.json"), Payload);
            File.WriteAllText(Path.Combine(outputDirectory, "captured-sectioning.json"), after ?? "<null>");
            File.WriteAllText(Path.Combine(outputDirectory, "probe-status.txt"), "TrySetClippingPlanes=" + setSucceeded.ToString(CultureInfo.InvariantCulture));
            if (!setSucceeded) throw new InvalidOperationException("TrySetClippingPlanes rejected the controlled payload.");
            document.SavedViewpoints.AddCopy(new SavedViewpoint(document.CurrentViewpoint.CreateCopy()) { DisplayName = "BUILD19_ACTIVE_SECTION" });
            dynamic state = ComApiBridge.State; const string pluginName = "XmlViewpointsExportPlugin";
            dynamic options = state.GetIOPluginOptions(pluginName);
            var status = Convert.ToInt32(state.DriveIOPlugin(pluginName, Path.Combine(outputDirectory, "navisworks-export.xml"), options), CultureInfo.InvariantCulture);
            if (status != 0) throw new InvalidOperationException("XML export failed with status " + status + ".");
            var multipleSetSucceeded = document.ActiveView.TrySetClippingPlanes(MultiplePayload);
            File.WriteAllText(Path.Combine(outputDirectory, "multiple-requested-sectioning.json"), MultiplePayload);
            File.WriteAllText(Path.Combine(outputDirectory, "multiple-captured-sectioning.json"), document.ActiveView.GetClippingPlanes() ?? "<null>");
            File.AppendAllText(Path.Combine(outputDirectory, "probe-status.txt"), Environment.NewLine + "MultipleTrySetClippingPlanes=" + multipleSetSucceeded.ToString(CultureInfo.InvariantCulture));
            if (!multipleSetSucceeded) throw new InvalidOperationException("TrySetClippingPlanes rejected the controlled multiple-plane payload.");
            document.SavedViewpoints.Clear();
            document.SavedViewpoints.AddCopy(new SavedViewpoint(document.CurrentViewpoint.CreateCopy()) { DisplayName = "BUILD19_MULTIPLE_SECTION" });
            status = Convert.ToInt32(state.DriveIOPlugin(pluginName, Path.Combine(outputDirectory, "navisworks-multiple-export.xml"), options), CultureInfo.InvariantCulture);
            if (status != 0) throw new InvalidOperationException("Multiple-plane XML export failed with status " + status + ".");
            return 0;
        }
    }
}
