using System;
using System.Globalization;
using System.IO;
using System.Linq;
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

    [Plugin("Build26AInternalCameraRoundtrip", "BIMLog", DisplayName = "BUILD 26A Internal Camera Roundtrip")]
    public sealed class InternalRoundtripPlugin : AddInPlugin
    {
        private sealed class CameraCase
        {
            public string Id; public double[] Position; public double[] Rotation; public double[] Up;
            public ViewpointProjection Projection; public double Focal; public double Horizontal; public double Vertical;
        }

        public override int Execute(params string[] parameters)
        {
            if (parameters == null || parameters.Length != 1) throw new ArgumentException("One evidence output path is required.");
            var outputPath = Path.GetFullPath(parameters[0]);
            var cases = new[]
            {
                new CameraCase { Id="CASE_1", Position=new[]{1.5,0,1250.75}, Rotation=new[]{0.0,0.5,-0.25,1.0}, Up=new[]{0.0,1.0,0.0}, Projection=ViewpointProjection.Perspective, Focal=42.125, Horizontal=100.25, Vertical=50.125 },
                new CameraCase { Id="CASE_2", Position=new[]{12.25,-4.5,99.0}, Rotation=new[]{Math.Sqrt(0.5),0.0,0.0,Math.Sqrt(0.5)}, Up=new[]{-0.25,0.5,0.75}, Projection=ViewpointProjection.Orthographic, Focal=10.0, Horizontal=8.0, Vertical=6.0 },
                new CameraCase { Id="CASE_3", Position=new[]{-1.0,-2.5,-300.125}, Rotation=new[]{0.18257418583505536,-0.36514837167011072,0.5477225575051661,0.73029674334022143}, Up=new[]{0.0,0.0,1.0}, Projection=ViewpointProjection.Perspective, Focal=10.0, Horizontal=8.0, Vertical=6.0 }
            };
            var document = Autodesk.Navisworks.Api.Application.ActiveDocument;
            var report = new StringBuilder().AppendLine("BUILD26A_INTERNAL_CAMERA_API_ROUNDTRIP");
            foreach (var value in cases)
            {
                using (var writable = document.CurrentViewpoint.CreateCopy())
                {
                    writable.Position = new Point3D(value.Position[0], value.Position[1], value.Position[2]);
                    writable.Rotation = new Rotation3D(value.Rotation[0], value.Rotation[1], value.Rotation[2], value.Rotation[3]);
                    writable.WorldUpVector = new UnitVector3D(value.Up[0], value.Up[1], value.Up[2]);
                    writable.Projection = value.Projection;
                    writable.FocalDistance = value.Focal;
                    writable.SetExtentsAtFocalDistance(value.Horizontal, value.Vertical);
                    document.CurrentViewpoint.CopyFrom(writable);
                }
                using (var actual = document.CurrentViewpoint.ToViewpoint())
                {
                    var positionError = MaxAbs(value.Position, new[]{actual.Position.X,actual.Position.Y,actual.Position.Z});
                    var rotationError = AngularError(value.Rotation, new[]{actual.Rotation.A,actual.Rotation.B,actual.Rotation.C,actual.Rotation.D});
                    var upError = VectorAngularError(value.Up, new[]{actual.WorldUpVector.X,actual.WorldUpVector.Y,actual.WorldUpVector.Z});
                    var focalError = Math.Abs(value.Focal - actual.FocalDistance);
                    var horizontalError = Math.Abs(value.Horizontal - actual.HorizontalExtentAtFocalDistance);
                    var verticalError = Math.Abs(value.Vertical - actual.VerticalExtentAtFocalDistance);
                    report.AppendLine(value.Id + "_POSITION_ERROR=" + R(positionError));
                    report.AppendLine(value.Id + "_ROTATION_ANGULAR_ERROR=" + R(rotationError));
                    report.AppendLine(value.Id + "_UP_ANGULAR_ERROR=" + R(upError));
                    report.AppendLine(value.Id + "_PROJECTION_EXPECTED=" + value.Projection);
                    report.AppendLine(value.Id + "_PROJECTION_ACTUAL=" + actual.Projection);
                    report.AppendLine(value.Id + "_FOCAL_ERROR=" + R(focalError));
                    report.AppendLine(value.Id + "_HORIZONTAL_EXTENT_ERROR=" + R(horizontalError));
                    report.AppendLine(value.Id + "_VERTICAL_EXTENT_ERROR=" + R(verticalError));
                }
            }
            Directory.CreateDirectory(Path.GetDirectoryName(outputPath));
            File.WriteAllText(outputPath, report.ToString(), new UTF8Encoding(false));
            return 0;
        }

        private static string R(double value) => value.ToString("R", CultureInfo.InvariantCulture);
        private static double MaxAbs(double[] a, double[] b) => a.Zip(b, (x,y) => Math.Abs(x-y)).Max();
        private static double AngularError(double[] a, double[] b)
        {
            var an=Math.Sqrt(a.Sum(x=>x*x)); var bn=Math.Sqrt(b.Sum(x=>x*x));
            var dot=Math.Abs(a.Zip(b,(x,y)=>x*y).Sum()/(an*bn));
            return 2.0*Math.Acos(Math.Min(1.0,Math.Max(-1.0,dot)));
        }
        private static double VectorAngularError(double[] a, double[] b)
        {
            var an=Math.Sqrt(a.Sum(x=>x*x)); var bn=Math.Sqrt(b.Sum(x=>x*x));
            var dot=a.Zip(b,(x,y)=>x*y).Sum()/(an*bn);
            return Math.Acos(Math.Min(1.0,Math.Max(-1.0,dot)));
        }
    }
}
