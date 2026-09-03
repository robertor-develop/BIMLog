using System;
using System.Globalization;
using System.IO;

namespace BIMLogLensNext.Tests
{
    // Build 11 contract proof only. This type is intentionally not connected to the XML writer.
    public sealed class LensNextXmlOrientationProof
    {
        private LensNextXmlOrientationProof(double a, double b, double c, double d)
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

        public static LensNextXmlOrientationProof FromNativeRotation(LensNextRotationState rotation)
        {
            if (rotation == null)
                throw new InvalidDataException("The active BIMLog viewpoint package camera rotation is missing.");
            if (!IsFinite(rotation.A) || !IsFinite(rotation.B) || !IsFinite(rotation.C) || !IsFinite(rotation.D))
                throw new InvalidDataException("The active BIMLog viewpoint package camera rotation must contain four finite components.");

            var scale = Math.Max(Math.Max(Math.Abs(rotation.A), Math.Abs(rotation.B)), Math.Max(Math.Abs(rotation.C), Math.Abs(rotation.D)));
            if (scale == 0d)
                throw new InvalidDataException("The active BIMLog viewpoint package camera rotation must not be a zero-length quaternion.");

            // The proven contract is a raw A/B/C/D mapping. Do not normalize or canonicalize stored values.
            return new LensNextXmlOrientationProof(rotation.A, rotation.B, rotation.C, rotation.D);
        }

        public static bool SpatiallyEquivalent(LensNextRotationState left, LensNextRotationState right, double tolerance = 1e-12d)
        {
            if (!IsFinite(tolerance) || tolerance < 0d)
                throw new ArgumentOutOfRangeException(nameof(tolerance));

            var first = UnitComponents(FromNativeRotation(left));
            var second = UnitComponents(FromNativeRotation(right));
            var direct = SquaredDistance(first, second, 1d);
            var negated = SquaredDistance(first, second, -1d);
            return Math.Min(direct, negated) <= tolerance * tolerance;
        }

        private static double[] UnitComponents(LensNextXmlOrientationProof value)
        {
            var scale = Math.Max(Math.Max(Math.Abs(value.A), Math.Abs(value.B)), Math.Max(Math.Abs(value.C), Math.Abs(value.D)));
            var a = value.A / scale;
            var b = value.B / scale;
            var c = value.C / scale;
            var d = value.D / scale;
            var magnitude = Math.Sqrt((a * a) + (b * b) + (c * c) + (d * d));
            return new[] { a / magnitude, b / magnitude, c / magnitude, d / magnitude };
        }

        private static double SquaredDistance(double[] left, double[] right, double sign)
        {
            var result = 0d;
            for (var index = 0; index < 4; index++)
            {
                var delta = left[index] - (sign * right[index]);
                result += delta * delta;
            }
            return result;
        }

        private static string Format(double value) => value.ToString("R", CultureInfo.InvariantCulture);
        private static bool IsFinite(double value) => !double.IsNaN(value) && !double.IsInfinity(value);
    }
}
