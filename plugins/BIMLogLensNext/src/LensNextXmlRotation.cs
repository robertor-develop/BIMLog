using System;
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

        public string AInvariant => LensNextXmlFloat.Format(A, "camera rotation A");
        public string BInvariant => LensNextXmlFloat.Format(B, "camera rotation B");
        public string CInvariant => LensNextXmlFloat.Format(C, "camera rotation C");
        public string DInvariant => LensNextXmlFloat.Format(D, "camera rotation D");

        public static LensNextXmlRotation FromValidatedCamera(LensNextCameraState camera)
        {
            if (camera == null || camera.Rotation == null)
                throw new InvalidDataException("The active BIMLog viewpoint package camera rotation is missing.");
            if (!IsFinite(camera.Rotation.A) || !IsFinite(camera.Rotation.B) ||
                !IsFinite(camera.Rotation.C) || !IsFinite(camera.Rotation.D))
                throw new InvalidDataException("The active BIMLog viewpoint package camera rotation must contain four finite components.");
            LensNextXmlFloat.RequireRepresentable(camera.Rotation.A, "camera rotation A");
            LensNextXmlFloat.RequireRepresentable(camera.Rotation.B, "camera rotation B");
            LensNextXmlFloat.RequireRepresentable(camera.Rotation.C, "camera rotation C");
            LensNextXmlFloat.RequireRepresentable(camera.Rotation.D, "camera rotation D");

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

        private static bool IsFinite(double value) => !double.IsNaN(value) && !double.IsInfinity(value);
    }
}
