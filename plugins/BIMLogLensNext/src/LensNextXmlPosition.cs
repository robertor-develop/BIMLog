using System;
using System.IO;

namespace BIMLogLensNext
{
    public sealed class LensNextXmlPosition
    {
        private LensNextXmlPosition(double x, double y, double z)
        {
            X = x;
            Y = y;
            Z = z;
        }

        public double X { get; }
        public double Y { get; }
        public double Z { get; }

        public string XInvariant => LensNextXmlFloat.Format(X, "camera position X");
        public string YInvariant => LensNextXmlFloat.Format(Y, "camera position Y");
        public string ZInvariant => LensNextXmlFloat.Format(Z, "camera position Z");
        public string XFeetInvariant => LensNextXmlFloat.Format(X / 12d, "camera position X");
        public string YFeetInvariant => LensNextXmlFloat.Format(Y / 12d, "camera position Y");
        public string ZFeetInvariant => LensNextXmlFloat.Format(Z / 12d, "camera position Z");

        public static LensNextXmlPosition FromValidatedCamera(LensNextCameraState camera)
        {
            if (camera == null || camera.Position == null)
                throw new InvalidDataException("The active BIMLog viewpoint package camera position is missing.");
            if (!IsFinite(camera.Position.X) || !IsFinite(camera.Position.Y) || !IsFinite(camera.Position.Z))
                throw new InvalidDataException("The active BIMLog viewpoint package camera position must contain three finite coordinates.");
            LensNextXmlFloat.RequireRepresentable(camera.Position.X / 12d, "camera position X");
            LensNextXmlFloat.RequireRepresentable(camera.Position.Y / 12d, "camera position Y");
            LensNextXmlFloat.RequireRepresentable(camera.Position.Z / 12d, "camera position Z");
            return new LensNextXmlPosition(camera.Position.X, camera.Position.Y, camera.Position.Z);
        }

        private static bool IsFinite(double value) => !double.IsNaN(value) && !double.IsInfinity(value);
    }
}
