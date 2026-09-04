using System;
using System.Globalization;
using System.IO;
using Autodesk.Navisworks.Api;
using Autodesk.Navisworks.Api.ComApi;
using Autodesk.Navisworks.Api.Plugins;

namespace Build17PerspectiveProbe
{
    [Plugin("Build17PerspectiveProbe", "BIMLog")]
    public sealed class PerspectiveProbePlugin : AddInPlugin
    {
        public override int Execute(params string[] parameters)
        {
            if (parameters == null || parameters.Length != 1)
                throw new ArgumentException("One output directory is required.");
            var outputDirectory = Path.GetFullPath(parameters[0]);
            Directory.CreateDirectory(outputDirectory);
            var document = Autodesk.Navisworks.Api.Application.ActiveDocument;
            document.SavedViewpoints.Clear();

            var wide = AddProbe(document, "BUILD17_WIDE", 10d, 30d, 20d);
            var medium = AddProbe(document, "BUILD17_MEDIUM", 10d, 8d, 6d);
            var narrow = AddProbe(document, "BUILD17_NARROW", 100d, 10d, 5d);
            File.WriteAllLines(Path.Combine(outputDirectory, "api-values.csv"), new[]
            {
                "Name,FocalDistance,HorizontalExtent,VerticalExtent,HeightField,AspectRatio",
                Format("BUILD17_WIDE", wide),
                Format("BUILD17_MEDIUM", medium),
                Format("BUILD17_NARROW", narrow)
            });

            dynamic state = ComApiBridge.State;
            const string pluginName = "XmlViewpointsExportPlugin";
            dynamic options = state.GetIOPluginOptions(pluginName);
            var status = Convert.ToInt32(state.DriveIOPlugin(pluginName, Path.Combine(outputDirectory, "navisworks-export.xml"), options), CultureInfo.InvariantCulture);
            if (status != 0) throw new InvalidOperationException("XML export failed with status " + status + ".");
            return 0;
        }

        private static Viewpoint AddProbe(Document document, string name, double focal, double horizontal, double vertical)
        {
            var viewpoint = new Viewpoint { Projection = ViewpointProjection.Perspective, FocalDistance = focal };
            viewpoint.SetExtentsAtFocalDistance(horizontal, vertical);
            document.SavedViewpoints.AddCopy(new SavedViewpoint(viewpoint) { DisplayName = name });
            return viewpoint;
        }

        private static string Format(string name, Viewpoint viewpoint) => string.Join(",", new[]
        {
            name,
            R(viewpoint.FocalDistance),
            R(viewpoint.HorizontalExtentAtFocalDistance),
            R(viewpoint.VerticalExtentAtFocalDistance),
            R(viewpoint.HeightField),
            R(viewpoint.AspectRatio)
        });

        private static string R(double value) => value.ToString("R", CultureInfo.InvariantCulture);
    }
}
