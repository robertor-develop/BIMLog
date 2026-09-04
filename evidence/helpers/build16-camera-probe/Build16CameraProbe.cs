using System;
using System.Globalization;
using System.IO;
using Autodesk.Navisworks.Api;
using Autodesk.Navisworks.Api.ComApi;
using Autodesk.Navisworks.Api.Plugins;

namespace Build16CameraProbe
{
    [Plugin("Build16CameraProbe", "BIMLog")]
    public sealed class CameraProbePlugin : AddInPlugin
    {
        public override int Execute(params string[] parameters)
        {
            if (parameters == null || parameters.Length != 1)
                throw new ArgumentException("One output directory is required.");
            var outputDirectory = Path.GetFullPath(parameters[0]);
            Directory.CreateDirectory(outputDirectory);

            var document = Autodesk.Navisworks.Api.Application.ActiveDocument;
            document.SavedViewpoints.Clear();
            var perspective = AddProbe(document, "BUILD16_PERSPECTIVE", ViewpointProjection.Perspective, 10d, 8d, 6d);
            var orthographic = AddProbe(document, "BUILD16_ORTHOGRAPHIC", ViewpointProjection.Orthographic, 10d, 8d, 6d);

            File.WriteAllLines(Path.Combine(outputDirectory, "api-values.txt"), new[]
            {
                Format("BUILD16_PERSPECTIVE", perspective),
                Format("BUILD16_ORTHOGRAPHIC", orthographic)
            });

            dynamic state = ComApiBridge.State;
            const string pluginName = "XmlViewpointsExportPlugin";
            dynamic options = state.GetIOPluginOptions(pluginName);
            var xmlPath = Path.Combine(outputDirectory, "navisworks-export.xml");
            var status = Convert.ToInt32(state.DriveIOPlugin(pluginName, xmlPath, options), CultureInfo.InvariantCulture);
            if (status != 0) throw new InvalidOperationException("XML export failed with status " + status + ".");
            return 0;
        }

        private static Viewpoint AddProbe(Document document, string name, ViewpointProjection projection, double focal, double horizontal, double vertical)
        {
            var viewpoint = new Viewpoint
            {
                Projection = projection,
                FocalDistance = focal
            };
            viewpoint.SetExtentsAtFocalDistance(horizontal, vertical);
            var saved = new SavedViewpoint(viewpoint) { DisplayName = name };
            document.SavedViewpoints.AddCopy(saved);
            return viewpoint;
        }

        private static string Format(string name, Viewpoint viewpoint)
        {
            return string.Join("|", new[]
            {
                name,
                "Projection=" + viewpoint.Projection,
                "FocalDistance=" + R(viewpoint.FocalDistance),
                "HorizontalExtent=" + R(viewpoint.HorizontalExtentAtFocalDistance),
                "VerticalExtent=" + R(viewpoint.VerticalExtentAtFocalDistance),
                "HeightField=" + R(viewpoint.HeightField),
                "AspectRatio=" + R(viewpoint.AspectRatio)
            });
        }

        private static string R(double value) => value.ToString("R", CultureInfo.InvariantCulture);
    }
}
