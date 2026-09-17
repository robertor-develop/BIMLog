using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace BIMLogLensNext
{
    // Local feasibility core only. No bridge command, upload, persistent viewpoint, or model mutation.
    public sealed class LensNextAreaPoint
    {
        public double X { get; set; }
        public double Y { get; set; }
        public double Z { get; set; }
    }

    public sealed class LensNextAreaBounds
    {
        public LensNextAreaPoint Min { get; set; }
        public LensNextAreaPoint Max { get; set; }

        public bool Intersects(LensNextAreaBounds other) =>
            Min.X <= other.Max.X && Max.X >= other.Min.X &&
            Min.Y <= other.Max.Y && Max.Y >= other.Min.Y &&
            Min.Z <= other.Max.Z && Max.Z >= other.Min.Z;
    }

    public sealed class LensNextAreaTriangle
    {
        public LensNextAreaPoint A { get; set; }
        public LensNextAreaPoint B { get; set; }
        public LensNextAreaPoint C { get; set; }
    }

    public sealed class LensNextAreaSourceElement
    {
        // Adapter must derive this from an exactly resolved model-scoped element, not a display label.
        public string ExactElementKey { get; set; }
        public string ModelFingerprint { get; set; }
        public LensNextAreaBounds Bounds { get; set; }
        public IReadOnlyList<LensNextAreaTriangle> Triangles { get; set; }
    }

    public sealed class LensNextAreaRequest
    {
        public ImmutableWorkingViewIdentity Identity { get; set; }
        public string ExactClashKey { get; set; }
        public string ClashElementAKey { get; set; }
        public string ClashElementBKey { get; set; }
        public string SourceLinearUnit { get; set; }
        public LensNextAreaPoint Focus { get; set; }
        public double RadiusMeters { get; set; }
        public bool GeometryExportAuthorized { get; set; }
    }

    public sealed class LensNextAreaPackageElement
    {
        public string ExactElementKey { get; set; }
        public string Role { get; set; }
        public IReadOnlyList<LensNextAreaTriangle> Triangles { get; set; }
    }

    public sealed class LensNextAreaPackage
    {
        public string ProjectId { get; set; }
        public string ServerId { get; set; }
        public string ViewpointId { get; set; }
        public string ModelFingerprint { get; set; }
        public string ExactClashKey { get; set; }
        public string SourceLinearUnit { get; set; }
        public LensNextAreaBounds Region { get; set; }
        public IReadOnlyList<LensNextAreaPackageElement> Elements { get; set; }
        public int TriangleCount { get; set; }
        public long EstimatedGeometryBytes { get; set; }
    }

    public static class LensNextAreaOfInterestPrototype
    {
        public const int MaximumElements = 300;
        public const int MaximumTriangles = 200000;
        public const long MaximumEstimatedGeometryBytes = 8L * 1024L * 1024L;
        public const double MaximumRadiusMeters = 20d;

        public static LensNextAreaPackage Build(LensNextAreaRequest request, IEnumerable<LensNextAreaSourceElement> source)
        {
            Validate(request, source);
            var unit = LensNextXmlLinearUnit.FromCamera(new LensNextCameraState { SourceLinearUnit = request.SourceLinearUnit });
            var radius = request.RadiusMeters / (unit.FeetFactor * 0.3048d);
            if (!Finite(radius) || radius <= 0d) throw new InvalidDataException("Area radius cannot be represented in source model units.");
            var region = new LensNextAreaBounds
            {
                Min = new LensNextAreaPoint { X = request.Focus.X - radius, Y = request.Focus.Y - radius, Z = request.Focus.Z - radius },
                Max = new LensNextAreaPoint { X = request.Focus.X + radius, Y = request.Focus.Y + radius, Z = request.Focus.Z + radius }
            };
            ValidateBounds(region);

            var elements = new List<LensNextAreaPackageElement>();
            var seen = new HashSet<string>(StringComparer.Ordinal);
            var triangleCount = 0;
            foreach (var item in source)
            {
                if (item == null || string.IsNullOrWhiteSpace(item.ExactElementKey) || !seen.Add(item.ExactElementKey))
                    throw new InvalidDataException("Area source contains a missing or duplicate exact element identity.");
                if (!string.Equals(item.ModelFingerprint, request.Identity.ModelFingerprint, StringComparison.OrdinalIgnoreCase))
                    throw new InvalidDataException("Area source element belongs to another model.");
                ValidateBounds(item.Bounds);
                if (!item.Bounds.Intersects(region)) continue;
                if (item.Triangles == null) throw new InvalidDataException("Intersecting area element has no geometry evidence.");
                var clipped = new List<LensNextAreaTriangle>();
                foreach (var triangle in item.Triangles)
                {
                    foreach (var part in Clip(triangle, region))
                    {
                        if (++triangleCount > MaximumTriangles) throw new InvalidDataException("Area triangle limit exceeded.");
                        if (512L + (elements.Count + 1L) * 256L + triangleCount * 72L > MaximumEstimatedGeometryBytes)
                            throw new InvalidDataException("Area geometry byte budget exceeded.");
                        clipped.Add(part);
                    }
                }
                if (clipped.Count == 0) continue;
                if (elements.Count >= MaximumElements) throw new InvalidDataException("Area element limit exceeded.");
                elements.Add(new LensNextAreaPackageElement
                {
                    ExactElementKey = item.ExactElementKey,
                    Role = item.ExactElementKey == request.ClashElementAKey ? "clash-a" : item.ExactElementKey == request.ClashElementBKey ? "clash-b" : "context",
                    Triangles = clipped
                });
            }
            if (!elements.Any(item => item.Role == "clash-a") || !elements.Any(item => item.Role == "clash-b"))
                throw new InvalidDataException("Both exact clash elements need bounded geometry; no partial clash package is valid.");
            return new LensNextAreaPackage
            {
                ProjectId = request.Identity.ProjectId,
                ServerId = request.Identity.ServerId,
                ViewpointId = request.Identity.ViewpointId,
                ModelFingerprint = request.Identity.ModelFingerprint,
                ExactClashKey = request.ExactClashKey,
                SourceLinearUnit = unit.SourceUnit,
                Region = region,
                Elements = elements.OrderBy(item => item.Role, StringComparer.Ordinal).ThenBy(item => item.ExactElementKey, StringComparer.Ordinal).ToArray(),
                TriangleCount = triangleCount,
                EstimatedGeometryBytes = 512L + elements.Count * 256L + triangleCount * 72L
            };
        }

        private static void Validate(LensNextAreaRequest request, IEnumerable<LensNextAreaSourceElement> source)
        {
            if (request == null || source == null || request.Identity == null) throw new InvalidDataException("Exact area request and source are required.");
            if (!request.GeometryExportAuthorized) throw new UnauthorizedAccessException("Area geometry export requires explicit authorization.");
            if (request.Identity.Validate().Count != 0 || request.Identity.LifecycleStatus != "active" ||
                string.IsNullOrWhiteSpace(request.Identity.ModelFingerprint) || request.Identity.ModelFingerprint.Length != 64 ||
                request.Identity.ModelFingerprint.Any(character => !Uri.IsHexDigit(character)))
                throw new InvalidDataException("An active exact issue and model identity are required.");
            if (string.IsNullOrWhiteSpace(request.ExactClashKey) || string.IsNullOrWhiteSpace(request.ClashElementAKey) ||
                string.IsNullOrWhiteSpace(request.ClashElementBKey) || request.ClashElementAKey == request.ClashElementBKey)
                throw new InvalidDataException("One exact clash and two distinct element identities are required.");
            if (request.Focus == null || !Finite(request.Focus.X) || !Finite(request.Focus.Y) || !Finite(request.Focus.Z) ||
                !Finite(request.RadiusMeters) || request.RadiusMeters <= 0d || request.RadiusMeters > MaximumRadiusMeters)
                throw new InvalidDataException("A finite focus and bounded positive radius are required.");
        }

        private static void ValidateBounds(LensNextAreaBounds bounds)
        {
            if (bounds == null || bounds.Min == null || bounds.Max == null ||
                !Finite(bounds.Min.X) || !Finite(bounds.Min.Y) || !Finite(bounds.Min.Z) ||
                !Finite(bounds.Max.X) || !Finite(bounds.Max.Y) || !Finite(bounds.Max.Z) ||
                bounds.Min.X > bounds.Max.X || bounds.Min.Y > bounds.Max.Y || bounds.Min.Z > bounds.Max.Z)
                throw new InvalidDataException("Area bounds are missing, non-finite or inverted.");
        }

        private static IEnumerable<LensNextAreaTriangle> Clip(LensNextAreaTriangle triangle, LensNextAreaBounds bounds)
        {
            if (triangle == null || triangle.A == null || triangle.B == null || triangle.C == null)
                throw new InvalidDataException("Area triangle is incomplete.");
            var polygon = new List<LensNextAreaPoint> { triangle.A, triangle.B, triangle.C };
            foreach (var point in polygon)
                if (!Finite(point.X) || !Finite(point.Y) || !Finite(point.Z)) throw new InvalidDataException("Area triangle is non-finite.");
            for (var axis = 0; axis < 3; axis++)
            {
                polygon = ClipPlane(polygon, axis, Coordinate(bounds.Min, axis), true);
                polygon = ClipPlane(polygon, axis, Coordinate(bounds.Max, axis), false);
                if (polygon.Count < 3) yield break;
            }
            for (var i = 1; i < polygon.Count - 1; i++)
                yield return new LensNextAreaTriangle { A = polygon[0], B = polygon[i], C = polygon[i + 1] };
        }

        private static List<LensNextAreaPoint> ClipPlane(List<LensNextAreaPoint> input, int axis, double boundary, bool lower)
        {
            var output = new List<LensNextAreaPoint>();
            if (input.Count == 0) return output;
            var previous = input[input.Count - 1];
            var previousInside = lower ? Coordinate(previous, axis) >= boundary : Coordinate(previous, axis) <= boundary;
            foreach (var current in input)
            {
                var currentInside = lower ? Coordinate(current, axis) >= boundary : Coordinate(current, axis) <= boundary;
                if (currentInside != previousInside)
                {
                    var distance = Coordinate(current, axis) - Coordinate(previous, axis);
                    if (distance == 0d) throw new InvalidDataException("Area clipping has a degenerate edge.");
                    var fraction = (boundary - Coordinate(previous, axis)) / distance;
                    output.Add(new LensNextAreaPoint
                    {
                        X = previous.X + fraction * (current.X - previous.X),
                        Y = previous.Y + fraction * (current.Y - previous.Y),
                        Z = previous.Z + fraction * (current.Z - previous.Z)
                    });
                }
                if (currentInside) output.Add(current);
                previous = current;
                previousInside = currentInside;
            }
            return output;
        }

        private static double Coordinate(LensNextAreaPoint point, int axis) => axis == 0 ? point.X : axis == 1 ? point.Y : point.Z;
        private static bool Finite(double value) => !double.IsNaN(value) && !double.IsInfinity(value);
    }
}
