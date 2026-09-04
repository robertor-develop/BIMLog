using System;
using System.Globalization;
using System.IO;

namespace BIMLogLensNext
{
    public sealed class LensNextXmlCameraScale
    {
        private const double NavisworksPerspectiveFovAttributeMinimum = Math.PI / 18d;

        private LensNextXmlCameraScale(double focal, double fieldOfView, double aspect, double height, bool emitFieldOfViewAttribute)
        {
            FocalInvariant = Invariant(focal);
            FieldOfViewInvariant = Invariant(fieldOfView);
            AspectInvariant = Invariant(aspect);
            HeightInvariant = Invariant(height);
            EmitFieldOfViewAttribute = emitFieldOfViewAttribute;
        }

        public string FocalInvariant { get; }
        public string FieldOfViewInvariant { get; }
        public string AspectInvariant { get; }
        public string HeightInvariant { get; }
        public bool EmitFieldOfViewAttribute { get; }

        public static LensNextXmlCameraScale FromValidatedCamera(LensNextCameraState camera)
        {
            if (camera == null)
                throw new InvalidDataException("The BIMLog camera required for XML scale is missing.");
            var focal = Positive(camera.FocalDistance, "focal distance");
            var horizontal = Positive(camera.HorizontalExtentAtFocalDistance, "horizontal focal extent");
            var vertical = Positive(camera.VerticalExtentAtFocalDistance, "vertical focal extent");
            var fieldScale = Math.Max(vertical, focal);
            var fieldOfView = 2d * Math.Atan2(vertical / fieldScale, 2d * (focal / fieldScale));
            var aspect = horizontal / vertical;
            var perspective = string.Equals(camera.Projection, "Perspective", StringComparison.Ordinal);
            var height = perspective
                ? fieldOfView
                : string.Equals(camera.Projection, "Orthographic", StringComparison.Ordinal)
                    ? vertical
                    : throw new InvalidDataException("The BIMLog camera projection is unsupported for XML scale mapping.");
            if (!FinitePositive(fieldOfView) || fieldOfView >= Math.PI || !FinitePositive(aspect) || !FinitePositive(height))
                throw new InvalidDataException("The BIMLog camera scale geometry is invalid for Navisworks XML export.");
            return new LensNextXmlCameraScale(
                focal,
                fieldOfView,
                aspect,
                height,
                !perspective || fieldOfView >= NavisworksPerspectiveFovAttributeMinimum);
        }

        private static double Positive(double? value, string field)
        {
            if (!value.HasValue || !FinitePositive(value.Value))
                throw new InvalidDataException("The BIMLog camera " + field + " is missing or invalid for Navisworks XML export.");
            return value.Value;
        }

        private static bool FinitePositive(double value) =>
            value > 0d && !double.IsNaN(value) && !double.IsInfinity(value);

        private static string Invariant(double value) => value.ToString("R", CultureInfo.InvariantCulture);
    }
}
