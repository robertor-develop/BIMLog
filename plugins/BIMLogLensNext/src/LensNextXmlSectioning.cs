using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Web.Script.Serialization;

namespace BIMLogLensNext
{
    public sealed class LensNextXmlClipPlane
    {
        internal LensNextXmlClipPlane(bool enabled, double x, double y, double z, double distance, LensNextXmlLinearUnit unit)
        {
            State = enabled ? "enabled" : "disabled";
            XInvariant = LensNextXmlFloat.Format(x, "section plane normal X");
            YInvariant = LensNextXmlFloat.Format(y, "section plane normal Y");
            ZInvariant = LensNextXmlFloat.Format(z, "section plane normal Z");
            DistanceInvariant = LensNextXmlFloat.Format(distance, "section plane distance");
            DistanceFeetInvariant = LensNextXmlFloat.Format(unit.ToFeet(distance), "section plane distance");
        }
        public string State { get; }
        public string XInvariant { get; }
        public string YInvariant { get; }
        public string ZInvariant { get; }
        public string DistanceInvariant { get; }
        public string DistanceFeetInvariant { get; }
    }

    public sealed class LensNextXmlSectioning
    {
        private static readonly HashSet<string> SetFields = new HashSet<string>(new[] { "Type", "Version", "Planes", "Linked", "Enabled" }, StringComparer.Ordinal);
        private static readonly HashSet<string> PlaneFields = new HashSet<string>(new[] { "Type", "Version", "Normal", "Distance", "Enabled" }, StringComparer.Ordinal);

        private LensNextXmlSectioning(bool enabled, bool linked, IReadOnlyList<LensNextXmlClipPlane> planes)
        {
            EnabledToken = enabled ? "1" : "0";
            LinkedToken = linked ? "1" : "0";
            Planes = planes;
        }

        public string EnabledToken { get; }
        public string LinkedToken { get; }
        public IReadOnlyList<LensNextXmlClipPlane> Planes { get; }

        public static LensNextXmlSectioning FromOptionalJson(string json, LensNextXmlLinearUnit unit)
        {
            if (string.IsNullOrWhiteSpace(json)) return null;
            if (unit == null) throw new ArgumentNullException(nameof(unit));
            Dictionary<string, object> set;
            try { set = new JavaScriptSerializer().DeserializeObject(json) as Dictionary<string, object>; }
            catch (Exception exception) { throw new InvalidDataException("The BIMLog sectioning JSON is malformed and cannot be exported.", exception); }
            if (set == null) throw Invalid("must be a JSON object");
            RequireOnly(set, SetFields, "section set");
            RequireString(set, "Type", "ClipPlaneSet", "section set");
            RequireVersion(set, "section set");
            var enabled = RequireBoolean(set, "Enabled", "section set");
            var linked = RequireBoolean(set, "Linked", "section set");
            object planesValue;
            if (!set.TryGetValue("Planes", out planesValue) || !(planesValue is object[])) throw Invalid("Planes must be an array");
            var planes = new List<LensNextXmlClipPlane>();
            foreach (var value in (object[])planesValue)
            {
                var plane = value as Dictionary<string, object>;
                if (plane == null) throw Invalid("each plane must be an object");
                RequireOnly(plane, PlaneFields, "plane");
                RequireString(plane, "Type", "ClipPlane", "plane");
                RequireVersion(plane, "plane");
                var planeEnabled = RequireBoolean(plane, "Enabled", "plane");
                object normalValue;
                if (!plane.TryGetValue("Normal", out normalValue) || !(normalValue is object[]) || ((object[])normalValue).Length != 3)
                    throw Invalid("plane Normal must contain exactly three components");
                var normal = ((object[])normalValue).Select((component, index) => RequireFiniteNumber(component, "plane Normal[" + index + "]")).ToArray();
                if (normal.All(component => component == 0d)) throw Invalid("plane Normal must be non-zero");
                object distanceValue;
                if (!plane.TryGetValue("Distance", out distanceValue)) throw Invalid("plane Distance is required");
                planes.Add(new LensNextXmlClipPlane(planeEnabled, normal[0], normal[1], normal[2], RequireFiniteNumber(distanceValue, "plane Distance"), unit));
            }
            return new LensNextXmlSectioning(enabled, linked, planes);
        }

        public static LensNextXmlSectioning FromOptionalJson(string json)
        {
            return FromOptionalJson(json, LensNextXmlLinearUnit.FromCamera(new LensNextCameraState { SourceLinearUnit = "Inches" }));
        }

        private static void RequireOnly(Dictionary<string, object> value, ISet<string> allowed, string context)
        {
            var unsupported = value.Keys.FirstOrDefault(key => !allowed.Contains(key));
            if (unsupported != null) throw Invalid(context + " contains unsupported field " + unsupported);
            var missing = allowed.FirstOrDefault(key => !value.ContainsKey(key));
            if (missing != null) throw Invalid(context + " is missing required field " + missing);
        }

        private static void RequireString(Dictionary<string, object> value, string field, string expected, string context)
        {
            if (!(value[field] is string) || !string.Equals((string)value[field], expected, StringComparison.Ordinal))
                throw Invalid(context + " " + field + " must be " + expected);
        }

        private static void RequireVersion(Dictionary<string, object> value, string context)
        {
            if (!IsNumber(value["Version"]) || Convert.ToDouble(value["Version"], CultureInfo.InvariantCulture) != 1d)
                throw Invalid(context + " Version must be 1");
        }

        private static bool RequireBoolean(Dictionary<string, object> value, string field, string context)
        {
            if (!(value[field] is bool)) throw Invalid(context + " " + field + " must be boolean");
            return (bool)value[field];
        }

        private static double RequireFiniteNumber(object value, string field)
        {
            if (!IsNumber(value)) throw Invalid(field + " must be numeric");
            var number = Convert.ToDouble(value, CultureInfo.InvariantCulture);
            if (double.IsNaN(number) || double.IsInfinity(number)) throw Invalid(field + " must be finite");
            return number;
        }

        private static bool IsNumber(object value) => value is byte || value is sbyte || value is short || value is ushort || value is int || value is uint || value is long || value is ulong || value is float || value is double || value is decimal;
        private static InvalidDataException Invalid(string reason) => new InvalidDataException("The BIMLog sectioning payload cannot be represented faithfully in Navisworks XML: " + reason + ".");
    }
}
