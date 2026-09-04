using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using Autodesk.Navisworks.Api;
using Autodesk.Navisworks.Api.ComApi;
using Autodesk.Navisworks.Api.Plugins;

namespace Build18OrthographicProbe
{
    [Plugin("Build18OrthographicProbe", "BIMLog")]
    public sealed class OrthographicProbePlugin : AddInPlugin
    {
        public override int Execute(params string[] parameters)
        {
            if (parameters == null || parameters.Length != 1) throw new ArgumentException("One output directory is required.");
            var outputDirectory = Path.GetFullPath(parameters[0]);
            Directory.CreateDirectory(outputDirectory);
            var document = Autodesk.Navisworks.Api.Application.ActiveDocument;
            document.SavedViewpoints.Clear();
            var lines = new List<string> { "Name,FocalDistance,HorizontalExtent,VerticalExtent,HeightField,AspectRatio" };
            Add(document, lines, "BUILD18_LARGE", 10d, 300d, 200d);
            Add(document, lines, "BUILD18_MEDIUM", 10d, 80d, 60d);
            Add(document, lines, "BUILD18_SMALL", 100d, 10d, 5d);
            AddAngle(document, lines, "BUILD18_10DEG_MINUS", 100d, Math.PI / 18d - 0.000001d);
            AddAngle(document, lines, "BUILD18_10DEG_EXACT", 100d, Math.PI / 18d);
            AddAngle(document, lines, "BUILD18_10DEG_PLUS", 100d, Math.PI / 18d + 0.000001d);
            File.WriteAllLines(Path.Combine(outputDirectory, "api-values.csv"), lines);
            dynamic state = ComApiBridge.State;
            const string pluginName = "XmlViewpointsExportPlugin";
            dynamic options = state.GetIOPluginOptions(pluginName);
            var status = Convert.ToInt32(state.DriveIOPlugin(pluginName, Path.Combine(outputDirectory, "navisworks-export.xml"), options), CultureInfo.InvariantCulture);
            if (status != 0) throw new InvalidOperationException("XML export failed with status " + status + ".");
            return 0;
        }

        private static void AddAngle(Document document, ICollection<string> lines, string name, double focal, double angle)
        {
            var vertical = 2d * focal * Math.Tan(angle / 2d);
            Add(document, lines, name, focal, 1.5d * vertical, vertical);
        }

        private static void Add(Document document, ICollection<string> lines, string name, double focal, double horizontal, double vertical)
        {
            var viewpoint = new Viewpoint { Projection = ViewpointProjection.Orthographic, FocalDistance = focal };
            viewpoint.SetExtentsAtFocalDistance(horizontal, vertical);
            document.SavedViewpoints.AddCopy(new SavedViewpoint(viewpoint) { DisplayName = name });
            lines.Add(string.Join(",", new[] { name, R(viewpoint.FocalDistance), R(viewpoint.HorizontalExtentAtFocalDistance), R(viewpoint.VerticalExtentAtFocalDistance), R(viewpoint.HeightField), R(viewpoint.AspectRatio) }));
        }

        private static string R(double value) => value.ToString("R", CultureInfo.InvariantCulture);
    }
}
