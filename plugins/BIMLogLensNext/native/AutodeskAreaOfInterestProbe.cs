using System;
using System.Collections.Generic;
using System.IO;
using Autodesk.Navisworks.Api;
using Autodesk.Navisworks.Api.Clash;

namespace BIMLogLensNext.Native
{
    // Read-only feasibility probe. It locates the exact clash and nearby geometry-bearing
    // model items; it does not claim to extract triangles or publish a browser package.
    public sealed class AutodeskAreaOfInterestProbe
    {
        public sealed class Result
        {
            public Guid TestGuid { get; set; }
            public Guid ClashGuid { get; set; }
            public Point3D Focus { get; set; }
            public ModelItem ClashItem1 { get; set; }
            public ModelItem ClashItem2 { get; set; }
            public IReadOnlyList<ModelItem> NearbyItems { get; set; }
        }

        public Result Locate(Document document, Guid exactTestGuid, Guid exactClashGuid,
            BoundingBox3D region, int maximumNearbyItems)
        {
            if (document == null || exactTestGuid == Guid.Empty || exactClashGuid == Guid.Empty ||
                region == null || maximumNearbyItems <= 1 || maximumNearbyItems > LensNextAreaOfInterestPrototype.MaximumElements)
                throw new InvalidDataException("Exact clash, bounded region and item limit are required.");

            var clash = document.GetClash();
            if (clash == null || clash.TestsData == null) throw new InvalidDataException("Navisworks Clash Detective data are unavailable.");
            ClashTest exactTest = null;
            foreach (var test in EnumerateTests(clash.TestsData.Tests))
            {
                if (test.Guid != exactTestGuid) continue;
                if (exactTest != null) throw new InvalidDataException("Clash test identity is ambiguous.");
                exactTest = test;
            }
            if (exactTest == null) throw new InvalidDataException("Exact clash test is unavailable.");

            ClashResult exactResult = null;
            foreach (var result in EnumerateResults(exactTest.Children))
            {
                if (result.Guid != exactClashGuid) continue;
                if (exactResult != null) throw new InvalidDataException("Clash result identity is ambiguous.");
                exactResult = result;
            }
            if (exactResult == null || exactResult.Item1 == null || exactResult.Item2 == null ||
                exactResult.Item1.InstanceGuid == Guid.Empty || exactResult.Item2.InstanceGuid == Guid.Empty ||
                exactResult.Item1.InstanceGuid == exactResult.Item2.InstanceGuid)
                throw new InvalidDataException("The exact clash pair lacks two distinct stable item identities.");
            if (!region.Intersects(exactResult.Item1.BoundingBox()) || !region.Intersects(exactResult.Item2.BoundingBox()))
                throw new InvalidDataException("The requested region excludes an exact clash element.");

            var nearby = new List<ModelItem>();
            var seen = new HashSet<Guid>();
            foreach (ModelItem item in document.Models.RootItemDescendantsAndSelf)
            {
                if (!item.HasGeometry) continue;
                var bounds = item.BoundingBox();
                if (bounds == null || !bounds.Intersects(region)) continue;
                if (item.InstanceGuid == Guid.Empty)
                    throw new InvalidDataException("A nearby geometry item has no exact instance identity.");
                if (!seen.Add(item.InstanceGuid))
                    throw new InvalidDataException("Nearby geometry has an ambiguous instance identity.");
                if (nearby.Count >= maximumNearbyItems)
                    throw new InvalidDataException("Area-of-interest item limit exceeded before geometry extraction.");
                nearby.Add(item);
            }
            if (!seen.Contains(exactResult.Item1.InstanceGuid) || !seen.Contains(exactResult.Item2.InstanceGuid))
                throw new InvalidDataException("The exact clash pair is absent from bounded geometry inventory.");
            return new Result
            {
                TestGuid = exactTestGuid, ClashGuid = exactClashGuid, Focus = exactResult.Center,
                ClashItem1 = exactResult.Item1, ClashItem2 = exactResult.Item2, NearbyItems = nearby
            };
        }

        private static IEnumerable<ClashTest> EnumerateTests(SavedItemCollection items)
        {
            foreach (SavedItem item in items)
            {
                var test = item as ClashTest;
                if (test != null) yield return test;
                var folder = item as ClashTestFolder;
                if (folder != null)
                    foreach (var nested in EnumerateTests(folder.Children)) yield return nested;
            }
        }

        private static IEnumerable<ClashResult> EnumerateResults(SavedItemCollection items)
        {
            foreach (SavedItem item in items)
            {
                var result = item as ClashResult;
                if (result != null) yield return result;
                var group = item as ClashResultGroup;
                if (group != null)
                    foreach (var nested in EnumerateResults(group.Children)) yield return nested;
            }
        }
    }
}
