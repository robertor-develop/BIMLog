using System;
using System.Globalization;
using System.IO;
using Autodesk.Navisworks.Api;
using Autodesk.Navisworks.Api.ComApi;
using Autodesk.Navisworks.Api.Plugins;

namespace Build17PerspectiveProbe
{
    [Plugin("Build17APerspectiveProbe", "BIMLog")]
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

            var lines = new System.Collections.Generic.List<string>
            {
                "Name,RequestedAngleRadians,FocalDistance,HorizontalExtent,VerticalExtent,HeightField,AspectRatio"
            };
            AddAngleProbe(document, lines, "BUILD17_WIDE", Math.PI / 2d);
            AddAngleProbe(document, lines, "BUILD17_MEDIUM", 0.5829135889557342d);
            AddAngleProbe(document, lines, "BUILD17_NARROW", 0.049989587237840319d);
            AddAngleProbe(document, lines, "BUILD17A_0_049", 0.049d);
            AddAngleProbe(document, lines, "BUILD17A_0_050", 0.050d);
            AddAngleProbe(document, lines, "BUILD17A_0_075", 0.075d);
            AddAngleProbe(document, lines, "BUILD17A_0_099999", 0.099999d);
            AddAngleProbe(document, lines, "BUILD17A_0_100000", 0.100000d);
            AddAngleProbe(document, lines, "BUILD17A_0_100001", 0.100001d);
            AddAngleProbe(document, lines, "BUILD17A_0_125", 0.125d);
            AddAngleProbe(document, lines, "BUILD17A_0_150", 0.150d);
            AddAngleProbe(document, lines, "BUILD17A_10DEG_MINUS", Math.PI / 18d - 0.000001d);
            AddAngleProbe(document, lines, "BUILD17A_10DEG_EXACT", Math.PI / 18d);
            AddAngleProbe(document, lines, "BUILD17A_10DEG_PLUS", Math.PI / 18d + 0.000001d);
            AddAngleProbe(document, lines, "BUILD17A_0_200", 0.200d);
            AddAngleProbe(document, lines, "BUILD17A_0_250", 0.250d);
            AddFocalProbe(document, lines, "BUILD17A_FOCAL_9_999", 9.999d, 0.05d);
            AddFocalProbe(document, lines, "BUILD17A_FOCAL_10_000", 10d, 0.05d);
            AddFocalProbe(document, lines, "BUILD17A_FOCAL_10_001", 10.001d, 0.05d);
            AddFocalProbe(document, lines, "BUILD17A_FOCAL_20", 20d, 0.5829135889557342d);
            AddFocalProbe(document, lines, "BUILD17A_FOCAL_100_MEDIUM", 100d, 0.5829135889557342d);
            File.WriteAllLines(Path.Combine(outputDirectory, "api-values.csv"), lines);

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

        private static void AddAngleProbe(Document document, System.Collections.Generic.ICollection<string> lines, string name, double angle)
        {
            AddFocalProbe(document, lines, name, 100d, angle);
        }

        private static void AddFocalProbe(Document document, System.Collections.Generic.ICollection<string> lines, string name, double focal, double angle)
        {
            var vertical = 2d * focal * Math.Tan(angle / 2d);
            var viewpoint = AddProbe(document, name, focal, 1.5d * vertical, vertical);
            lines.Add(Format(name, angle, viewpoint));
        }

        private static string Format(string name, double requestedAngle, Viewpoint viewpoint) => string.Join(",", new[]
        {
            name,
            R(requestedAngle),
            R(viewpoint.FocalDistance),
            R(viewpoint.HorizontalExtentAtFocalDistance),
            R(viewpoint.VerticalExtentAtFocalDistance),
            R(viewpoint.HeightField),
            R(viewpoint.AspectRatio)
        });

        private static string R(double value) => value.ToString("R", CultureInfo.InvariantCulture);
    }
}
