using System;
using System.Globalization;
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

        public string XInvariant => Format(X);
        public string YInvariant => Format(Y);
        public string ZInvariant => Format(Z);

        public static LensNextXmlPosition FromValidatedCamera(LensNextCameraState camera)
        {
            if (camera == null || camera.Position == null)
                throw new InvalidDataException("The active BIMLog viewpoint package camera position is missing.");
            if (!IsFinite(camera.Position.X) || !IsFinite(camera.Position.Y) || !IsFinite(camera.Position.Z))
                throw new InvalidDataException("The active BIMLog viewpoint package camera position must contain three finite coordinates.");
            return new LensNextXmlPosition(camera.Position.X, camera.Position.Y, camera.Position.Z);
        }

        private static string Format(double value) => value.ToString("R", CultureInfo.InvariantCulture);

        private static bool IsFinite(double value) => !double.IsNaN(value) && !double.IsInfinity(value);
    }
}
