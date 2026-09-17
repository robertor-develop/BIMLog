using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using Autodesk.Navisworks.Api;
using Autodesk.Navisworks.Api.ComApi;
using Autodesk.Navisworks.Api.Interop.ComApi;

namespace BIMLogLensNext.AreaSpike2021
{
    // Not part of the installed plugin. Proves the 2021 COM primitive signatures only.
    // Fragment-local coordinates and transform are deliberately kept separate until
    // world-coordinate semantics are verified on a real known-distance clash.
    public sealed class AreaPrimitiveSpike2021
    {
        public sealed class Fragment
        {
            public double[] LocalToWorldRaw { get; set; }
            public IReadOnlyList<double[]> LocalTriangles { get; set; }
        }

        public IReadOnlyList<Fragment> ReadExactItem(ModelItem exactItem)
        {
            if (exactItem == null || exactItem.InstanceGuid == Guid.Empty)
                throw new InvalidDataException("An exact Navisworks item identity is required.");
            var path = ComApiBridge.ToInwOaPath(exactItem);
            if (path == null) throw new InvalidDataException("The exact item has no COM geometry path.");
            var fragments = new List<Fragment>();
            foreach (InwOaFragment3 fragment in path.Fragments())
            {
                if (fragments.Count >= 128) throw new InvalidDataException("Fragment cap exceeded.");
                var callback = new TriangleCollector();
                fragment.GenerateSimplePrimitives(nwEVertexProperty.eNONE, callback);
                fragments.Add(new Fragment
                {
                    LocalToWorldRaw = Numbers(fragment.GetLocalToWorldMatrix().Matrix, 16),
                    LocalTriangles = callback.Triangles
                });
            }
            if (fragments.Count == 0) throw new InvalidDataException("The exact item has no geometry fragments.");
            return fragments;
        }

        private static double[] Numbers(object value, int count)
        {
            var collection = value as IEnumerable;
            if (collection == null) throw new InvalidDataException("Navisworks primitive coordinate array is missing.");
            var result = new List<double>();
            foreach (var number in collection)
            {
                var parsed = Convert.ToDouble(number, CultureInfo.InvariantCulture);
                if (double.IsNaN(parsed) || double.IsInfinity(parsed)) throw new InvalidDataException("Non-finite geometry coordinate.");
                result.Add(parsed);
            }
            if (result.Count != count) throw new InvalidDataException("Unexpected Navisworks primitive coordinate length.");
            return result.ToArray();
        }

        private sealed class TriangleCollector : InwSimplePrimitivesCB
        {
            public readonly List<double[]> Triangles = new List<double[]>();

            public void Triangle(InwSimpleVertex a, InwSimpleVertex b, InwSimpleVertex c)
            {
                if (Triangles.Count >= 50000) throw new InvalidDataException("Primitive triangle cap exceeded.");
                var first = Numbers(a.coord, 3);
                var second = Numbers(b.coord, 3);
                var third = Numbers(c.coord, 3);
                Triangles.Add(new[] { first[0], first[1], first[2], second[0], second[1], second[2], third[0], third[1], third[2] });
            }

            public void Line(InwSimpleVertex a, InwSimpleVertex b) { }
            public void Point(InwSimpleVertex a) { }
            public void SnapPoint(InwSimpleVertex a) { }
        }
    }
}
