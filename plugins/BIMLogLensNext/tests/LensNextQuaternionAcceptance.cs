using System;
using System.IO;

namespace BIMLogLensNext.Tests
{
    public sealed class LensNextQuaternionNorm
    {
        public LensNextQuaternionNorm(double scale, double scaledMagnitude, double[] normalizedComponents)
        {
            Scale = scale;
            ScaledMagnitude = scaledMagnitude;
            NormalizedComponents = normalizedComponents;
        }

        public double Scale { get; }
        public double ScaledMagnitude { get; }
        public double[] NormalizedComponents { get; }
    }

    public static class LensNextQuaternionAcceptance
    {
        // Covers float32 XML-import quantization with margin while remaining visually negligible.
        public const double OrientationComparisonToleranceRadians = 1e-6d;

        public static LensNextQuaternionNorm Evaluate(LensNextRotationState rotation)
        {
            if (rotation == null)
                throw new InvalidDataException("Quaternion is missing.");
            if (!IsFinite(rotation.A) || !IsFinite(rotation.B) || !IsFinite(rotation.C) || !IsFinite(rotation.D))
                throw new InvalidDataException("Quaternion components must be finite.");

            var scale = Math.Max(
                Math.Max(Math.Abs(rotation.A), Math.Abs(rotation.B)),
                Math.Max(Math.Abs(rotation.C), Math.Abs(rotation.D)));
            if (scale == 0d)
                throw new InvalidDataException("Quaternion must not be zero length.");

            var scaled = new[]
            {
                rotation.A / scale,
                rotation.B / scale,
                rotation.C / scale,
                rotation.D / scale
            };
            var scaledMagnitude = Math.Sqrt(
                (scaled[0] * scaled[0]) +
                (scaled[1] * scaled[1]) +
                (scaled[2] * scaled[2]) +
                (scaled[3] * scaled[3]));
            return new LensNextQuaternionNorm(
                scale,
                scaledMagnitude,
                new[]
                {
                    scaled[0] / scaledMagnitude,
                    scaled[1] / scaledMagnitude,
                    scaled[2] / scaledMagnitude,
                    scaled[3] / scaledMagnitude
                });
        }

        public static double AngularErrorRadians(LensNextRotationState left, LensNextRotationState right)
        {
            var first = Evaluate(left).NormalizedComponents;
            var second = Evaluate(right).NormalizedComponents;
            var dot = Math.Abs(
                (first[0] * second[0]) +
                (first[1] * second[1]) +
                (first[2] * second[2]) +
                (first[3] * second[3]));
            return 2d * Math.Acos(Math.Min(1d, Math.Max(0d, dot)));
        }

        public static bool Equivalent(LensNextRotationState left, LensNextRotationState right) =>
            AngularErrorRadians(left, right) <= OrientationComparisonToleranceRadians;

        private static bool IsFinite(double value) => !double.IsNaN(value) && !double.IsInfinity(value);
    }
}
