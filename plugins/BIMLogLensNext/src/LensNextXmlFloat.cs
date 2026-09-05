using System;
using System.Globalization;
using System.IO;

namespace BIMLogLensNext
{
    internal static class LensNextXmlFloat
    {
        internal static double RequireRepresentable(double value, string field)
        {
            if (double.IsNaN(value) || double.IsInfinity(value))
                throw Invalid(field, "must be finite");

            var converted = (float)value;
            if (float.IsNaN(converted) || float.IsInfinity(converted))
                throw Invalid(field, "is outside the finite xs:float range");
            if (value != 0d && converted == 0f)
                throw Invalid(field, "is too small to remain non-zero as xs:float");

            return value;
        }

        internal static string Format(double value, string field)
        {
            return RequireRepresentable(value, field).ToString("R", CultureInfo.InvariantCulture);
        }

        private static InvalidDataException Invalid(string field, string reason)
        {
            return new InvalidDataException("The BIMLog " + field + " cannot be represented faithfully as a finite Navisworks XML xs:float: " + reason + ".");
        }
    }
}
