using System;
using System.Globalization;
using System.IO;

namespace BIMLogLensNext
{
    public sealed class LensNextXmlUpVector
    {
        private LensNextXmlUpVector(double x, double y, double z)
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

        public static LensNextXmlUpVector FromOptionalValidatedCamera(LensNextCameraState camera)
        {
            if (camera == null)
                throw new InvalidDataException("The active BIMLog viewpoint package camera is missing.");
            if (camera.WorldUpVector == null) return null;
            if (!IsFinite(camera.WorldUpVector.X) || !IsFinite(camera.WorldUpVector.Y) || !IsFinite(camera.WorldUpVector.Z))
                throw new InvalidDataException("The active BIMLog viewpoint package camera up vector must contain three finite components.");

            var scale = Math.Max(
                Math.Max(Math.Abs(camera.WorldUpVector.X), Math.Abs(camera.WorldUpVector.Y)),
                Math.Abs(camera.WorldUpVector.Z));
            if (scale == 0d)
                throw new InvalidDataException("The active BIMLog viewpoint package camera up vector must not be zero length.");

            return new LensNextXmlUpVector(
                camera.WorldUpVector.X,
                camera.WorldUpVector.Y,
                camera.WorldUpVector.Z);
        }

        private static string Format(double value) => value.ToString("R", CultureInfo.InvariantCulture);
        private static bool IsFinite(double value) => !double.IsNaN(value) && !double.IsInfinity(value);
    }
}
