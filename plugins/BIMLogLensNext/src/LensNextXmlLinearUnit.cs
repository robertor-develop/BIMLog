using System;
using System.Collections.Generic;
using System.IO;

namespace BIMLogLensNext
{
    public sealed class LensNextXmlLinearUnit
    {
        private static readonly IReadOnlyDictionary<string, double> FeetPerSourceUnit =
            new Dictionary<string, double>(StringComparer.Ordinal)
            {
                { "Feet", 1d },
                { "Inches", 1d / 12d },
                { "Meters", 3.280839895013123d },
                { "Centimeters", 0.03280839895013123d },
                { "Millimeters", 0.003280839895013123d },
                { "Yards", 3d },
                { "Kilometers", 3280.839895013123d },
                { "Miles", 5280d },
                { "Micrometers", 0.000003280839895013123d },
                { "Mils", 1d / 12000d },
                { "Microinches", 1d / 12000000d }
            };

        private LensNextXmlLinearUnit(string sourceUnit, double feetFactor)
        {
            SourceUnit = sourceUnit;
            FeetFactor = feetFactor;
        }

        public string SourceUnit { get; }
        public double FeetFactor { get; }

        public double ToFeet(double value)
        {
            // Preserve the already field-proven inches conversion bit-for-bit.
            return string.Equals(SourceUnit, "Inches", StringComparison.Ordinal)
                ? value / 12d
                : value * FeetFactor;
        }

        public static LensNextXmlLinearUnit FromCamera(LensNextCameraState camera)
        {
            if (camera == null) throw new InvalidDataException("The BIMLog camera required for XML unit conversion is missing.");
            var sourceUnit = camera.SourceLinearUnit == null ? null : camera.SourceLinearUnit.Trim();
            double factor;
            if (string.IsNullOrEmpty(sourceUnit) || !FeetPerSourceUnit.TryGetValue(sourceUnit, out factor))
                throw new InvalidDataException("The BIMLog camera source linear unit is missing or unsupported for Navisworks XML export.");
            return new LensNextXmlLinearUnit(sourceUnit, factor);
        }
    }
}
