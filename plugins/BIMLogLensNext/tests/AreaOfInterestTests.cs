using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace BIMLogLensNext.Tests
{
    internal static partial class Program
    {
        private static readonly string AreaFingerprint = new string('a', 64);

        private static LensNextAreaRequest AreaRequest()
        {
            return new LensNextAreaRequest
            {
                Identity = new ImmutableWorkingViewIdentity
                {
                    SessionId = "bounded-local-session", ProjectId = "26", ServerId = "101",
                    ViewpointId = "a01f4f9a-3e26-40ee-a19a-645ccb853e72", LifecycleStatus = "active",
                    RevisionNumber = "1", ModelFingerprint = AreaFingerprint
                },
                ExactClashKey = "navisworks-test-guid:clash-01",
                ClashElementAKey = "model-a:element-1", ClashElementBKey = "model-b:element-2",
                SourceLinearUnit = "Meters", Focus = new LensNextAreaPoint { X = 0, Y = 0, Z = 0 },
                RadiusMeters = 2, GeometryExportAuthorized = true
            };
        }

        private static LensNextAreaSourceElement Element(string key, double x, double length = 0.5)
        {
            var a = new LensNextAreaPoint { X = x, Y = -0.25, Z = 0 };
            var b = new LensNextAreaPoint { X = x + length, Y = 0.25, Z = 0 };
            var c = new LensNextAreaPoint { X = x + length, Y = -0.25, Z = 0.5 };
            return new LensNextAreaSourceElement
            {
                ExactElementKey = key, ModelFingerprint = AreaFingerprint,
                Bounds = new LensNextAreaBounds
                {
                    Min = new LensNextAreaPoint { X = x, Y = -0.25, Z = 0 },
                    Max = new LensNextAreaPoint { X = x + length, Y = 0.25, Z = 0.5 }
                },
                Triangles = new[] { new LensNextAreaTriangle { A = a, B = b, C = c } }
            };
        }

        private static LensNextAreaSourceElement[] AreaFixture()
        {
            return new[]
            {
                Element("model-a:element-1", -0.5), Element("model-b:element-2", 0.5),
                Element("model-c:nearby-duct", 1.0), Element("model-c:remote-wall", 30.0)
            };
        }

        private static void AreaRequiresExactActiveAuthorizedIdentity()
        {
            var request = AreaRequest(); request.GeometryExportAuthorized = false;
            Throws<UnauthorizedAccessException>(() => LensNextAreaOfInterestPrototype.Build(request, AreaFixture()));
            request.GeometryExportAuthorized = true; request.Identity.LifecycleStatus = "superseded";
            Throws<InvalidDataException>(() => LensNextAreaOfInterestPrototype.Build(request, AreaFixture()));
            request.Identity.LifecycleStatus = "active"; request.ExactClashKey = null;
            Throws<InvalidDataException>(() => LensNextAreaOfInterestPrototype.Build(request, AreaFixture()));
        }

        private static void AreaRetainsPairAndSpatialContext()
        {
            var package = LensNextAreaOfInterestPrototype.Build(AreaRequest(), AreaFixture());
            Equal(3, package.Elements.Count);
            Equal("26", package.ProjectId);
            Equal(AreaFingerprint, package.ModelFingerprint);
            True(package.EstimatedGeometryBytes > 0 && package.EstimatedGeometryBytes <= LensNextAreaOfInterestPrototype.MaximumEstimatedGeometryBytes);
            True(package.Elements.Any(item => item.Role == "clash-a"));
            True(package.Elements.Any(item => item.Role == "clash-b"));
            True(package.Elements.Any(item => item.Role == "context" && item.ExactElementKey == "model-c:nearby-duct"));
            False(package.Elements.Any(item => item.ExactElementKey == "model-c:remote-wall"));
        }

        private static void AreaClipsLongCrossingElement()
        {
            var fixture = AreaFixture().Take(2).Concat(new[] { Element("model-c:long-pipe", -100, 200) }).ToArray();
            var package = LensNextAreaOfInterestPrototype.Build(AreaRequest(), fixture);
            var pipe = package.Elements.Single(item => item.ExactElementKey == "model-c:long-pipe");
            True(pipe.Triangles.Count > 0);
            foreach (var triangle in pipe.Triangles)
                foreach (var point in new[] { triangle.A, triangle.B, triangle.C })
                    True(point.X >= package.Region.Min.X - 0.000001 && point.X <= package.Region.Max.X + 0.000001);
        }

        private static void AreaConvertsMetersToSourceUnits()
        {
            var request = AreaRequest(); request.SourceLinearUnit = "Feet";
            var feet = LensNextAreaOfInterestPrototype.Build(request, AreaFixture());
            True(feet.Region.Max.X > 6.5 && feet.Region.Max.X < 6.6);
            request.SourceLinearUnit = "Meters";
            var meters = LensNextAreaOfInterestPrototype.Build(request, AreaFixture());
            True(meters.Region.Max.X > 1.99 && meters.Region.Max.X < 2.01);
            request.SourceLinearUnit = "Unknown";
            Throws<InvalidDataException>(() => LensNextAreaOfInterestPrototype.Build(request, AreaFixture()));
        }

        private static void AreaRejectsMissingPairAndCrossModel()
        {
            Throws<InvalidDataException>(() => LensNextAreaOfInterestPrototype.Build(AreaRequest(), AreaFixture().Take(1)));
            var fixture = AreaFixture(); fixture[1].ModelFingerprint = new string('b', 64);
            Throws<InvalidDataException>(() => LensNextAreaOfInterestPrototype.Build(AreaRequest(), fixture));
            fixture = AreaFixture(); fixture[1].ExactElementKey = fixture[0].ExactElementKey;
            Throws<InvalidDataException>(() => LensNextAreaOfInterestPrototype.Build(AreaRequest(), fixture));
        }

        private static void AreaRejectsFullModelRadiusAndExcessGeometry()
        {
            var request = AreaRequest(); request.RadiusMeters = LensNextAreaOfInterestPrototype.MaximumRadiusMeters + 1;
            Throws<InvalidDataException>(() => LensNextAreaOfInterestPrototype.Build(request, AreaFixture()));
            request.RadiusMeters = 2;
            var fixture = AreaFixture().Take(2).Concat(
                Enumerable.Range(0, LensNextAreaOfInterestPrototype.MaximumElements)
                    .Select(index => Element("model-c:context-" + index, 0.1))).ToArray();
            Throws<InvalidDataException>(() => LensNextAreaOfInterestPrototype.Build(request, fixture));
        }
    }
}
