using System;
using System.Globalization;
using System.IO;

namespace BIMLogLensNext
{
    public sealed class LensNextXmlRotation
    {
        private LensNextXmlRotation(double a, double b, double c, double d)
        {
            A = a;
            B = b;
            C = c;
            D = d;
        }

        public double A { get; }
        public double B { get; }
        public double C { get; }
        public double D { get; }

        public string AInvariant => Format(A);
        public string BInvariant => Format(B);
        public string CInvariant => Format(C);
        public string DInvariant => Format(D);

        public static LensNextXmlRotation FromValidatedCamera(LensNextCameraState camera)
        {
            if (camera == null || camera.Rotation == null)
                throw new InvalidDataException("The active BIMLog viewpoint package camera rotation is missing.");
            if (!IsFinite(camera.Rotation.A) || !IsFinite(camera.Rotation.B) ||
                !IsFinite(camera.Rotation.C) || !IsFinite(camera.Rotation.D))
                throw new InvalidDataException("The active BIMLog viewpoint package camera rotation must contain four finite components.");

            var scale = Math.Max(
                Math.Max(Math.Abs(camera.Rotation.A), Math.Abs(camera.Rotation.B)),
                Math.Max(Math.Abs(camera.Rotation.C), Math.Abs(camera.Rotation.D)));
            if (scale == 0d)
                throw new InvalidDataException("The active BIMLog viewpoint package camera rotation must not be a zero-length quaternion.");

            return new LensNextXmlRotation(
                camera.Rotation.A,
                camera.Rotation.B,
                camera.Rotation.C,
                camera.Rotation.D);
        }

        private static string Format(double value) => value.ToString("R", CultureInfo.InvariantCulture);
        private static bool IsFinite(double value) => !double.IsNaN(value) && !double.IsInfinity(value);
    }
}
