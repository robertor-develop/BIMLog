using System;
using System.Globalization;
using System.IO;
using System.Text;
using System.Windows.Forms;
using Autodesk.Navisworks.Api;
using Autodesk.Navisworks.Api.Plugins;

namespace Build26ACameraProbe
{
    internal static class CameraCapture
    {
        private const string OutputDirectory = @"F:\BIMLog\Evidence\lens-next-build25-xml-import-accepted-20260905\build26-camera-captures";

        public static int Execute(string caseId, string expectedViewName)
        {
            try
            {
                var document = Autodesk.Navisworks.Api.Application.ActiveDocument;
                if (document == null) throw new InvalidOperationException("No active Navisworks document.");
                using (var viewpoint = document.CurrentViewpoint.ToViewpoint())
                {
                    var text = new StringBuilder()
                        .AppendLine("BUILD26A_CAMERA_CAPTURE")
                        .AppendLine("CASE=" + caseId)
                        .AppendLine("EXPECTED_OPEN_VIEW=" + expectedViewName)
                        .AppendLine("DOCUMENT_UNITS=" + document.Units)
                        .AppendLine("POSITION=" + Point(viewpoint.Position.X, viewpoint.Position.Y, viewpoint.Position.Z))
                        .AppendLine("ROTATION=" + Quaternion(viewpoint.Rotation.A, viewpoint.Rotation.B, viewpoint.Rotation.C, viewpoint.Rotation.D))
                        .AppendLine("WORLD_UP=" + Point(viewpoint.WorldUpVector.X, viewpoint.WorldUpVector.Y, viewpoint.WorldUpVector.Z))
                        .AppendLine("PROJECTION=" + viewpoint.Projection)
                        .AppendLine("FOCAL_DISTANCE=" + Optional(() => viewpoint.FocalDistance))
                        .AppendLine("HORIZONTAL_EXTENT_AT_FOCAL_DISTANCE=" + Optional(() => viewpoint.HorizontalExtentAtFocalDistance))
                        .AppendLine("VERTICAL_EXTENT_AT_FOCAL_DISTANCE=" + Optional(() => viewpoint.VerticalExtentAtFocalDistance))
                        .ToString();
                    Directory.CreateDirectory(OutputDirectory);
                    var outputPath = Path.Combine(OutputDirectory, caseId + "-" + expectedViewName + ".txt");
                    File.WriteAllText(outputPath, text, new UTF8Encoding(false));
                    MessageBox.Show(text + Environment.NewLine + "Evidence file:" + Environment.NewLine + outputPath,
                        "BUILD 26A Read-Only Camera Capture", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
                return 0;
            }
            catch (Exception exception)
            {
                MessageBox.Show(exception.ToString(), "BUILD 26A CAMERA CAPTURE FAILED", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return -1;
            }
        }

        private static string Point(double x, double y, double z) => string.Format(CultureInfo.InvariantCulture, "{0:R},{1:R},{2:R}", x, y, z);
        private static string Quaternion(double a, double b, double c, double d) => string.Format(CultureInfo.InvariantCulture, "{0:R},{1:R},{2:R},{3:R}", a, b, c, d);
        private static string Optional(Func<double> read)
        {
            try { return read().ToString("R", CultureInfo.InvariantCulture); }
            catch (Exception exception) { return "UNAVAILABLE:" + exception.GetType().FullName + ":" + exception.Message.Replace("\r", " ").Replace("\n", " "); }
        }
    }

    [Plugin("Build26ACaptureCase1", "BIMLog", DisplayName = "BUILD 26A Capture CASE 1 - VP-160")]
    [AddInPlugin(AddInLocation.AddIn)]
    public sealed class Case1Plugin : AddInPlugin { public override int Execute(params string[] parameters) => CameraCapture.Execute("CASE_1", "VP-160"); }

    [Plugin("Build26ACaptureCase2", "BIMLog", DisplayName = "BUILD 26A Capture CASE 2 - VP-161")]
    [AddInPlugin(AddInLocation.AddIn)]
    public sealed class Case2Plugin : AddInPlugin { public override int Execute(params string[] parameters) => CameraCapture.Execute("CASE_2", "VP-161"); }

    [Plugin("Build26ACaptureCase3", "BIMLog", DisplayName = "BUILD 26A Capture CASE 3 - VP-172")]
    [AddInPlugin(AddInLocation.AddIn)]
    public sealed class Case3Plugin : AddInPlugin { public override int Execute(params string[] parameters) => CameraCapture.Execute("CASE_3", "VP-172"); }
}
