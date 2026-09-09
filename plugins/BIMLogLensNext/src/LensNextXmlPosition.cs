using System;
using System.IO;

namespace BIMLogLensNext
{
    public sealed class LensNextXmlPosition
    {
        private LensNextXmlPosition(double x, double y, double z, LensNextXmlLinearUnit unit)
        {
            X = x;
            Y = y;
            Z = z;
            Unit = unit;
        }

        public double X { get; }
        public double Y { get; }
        public double Z { get; }
        public LensNextXmlLinearUnit Unit { get; }

        public string XInvariant => LensNextXmlFloat.Format(X, "camera position X");
        public string YInvariant => LensNextXmlFloat.Format(Y, "camera position Y");
        public string ZInvariant => LensNextXmlFloat.Format(Z, "camera position Z");
        public string XFeetInvariant => LensNextXmlFloat.Format(Unit.ToFeet(X), "camera position X");
        public string YFeetInvariant => LensNextXmlFloat.Format(Unit.ToFeet(Y), "camera position Y");
        public string ZFeetInvariant => LensNextXmlFloat.Format(Unit.ToFeet(Z), "camera position Z");

        public static LensNextXmlPosition FromValidatedCamera(LensNextCameraState camera)
        {
            if (camera == null || camera.Position == null)
                throw new InvalidDataException("The active BIMLog viewpoint package camera position is missing.");
            if (!IsFinite(camera.Position.X) || !IsFinite(camera.Position.Y) || !IsFinite(camera.Position.Z))
                throw new InvalidDataException("The active BIMLog viewpoint package camera position must contain three finite coordinates.");
            var unit = LensNextXmlLinearUnit.FromCamera(camera);
            LensNextXmlFloat.RequireRepresentable(unit.ToFeet(camera.Position.X), "camera position X");
            LensNextXmlFloat.RequireRepresentable(unit.ToFeet(camera.Position.Y), "camera position Y");
            LensNextXmlFloat.RequireRepresentable(unit.ToFeet(camera.Position.Z), "camera position Z");
            return new LensNextXmlPosition(camera.Position.X, camera.Position.Y, camera.Position.Z, unit);
        }

        private static bool IsFinite(double value) => !double.IsNaN(value) && !double.IsInfinity(value);
    }
}
