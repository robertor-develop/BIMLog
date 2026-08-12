using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;

namespace BIMLogLensNext
{
    public sealed class LensNextFeatureFlags
    {
        private readonly IReadOnlyDictionary<string, bool> _values;

        private LensNextFeatureFlags(IReadOnlyDictionary<string, bool> values)
        {
            _values = values;
        }

        public static LensNextFeatureFlags Phase1ReadOnly()
        {
            var values = LensNextConstants.WriteFeatureFlags.ToDictionary(
                name => name,
                name => false,
                StringComparer.Ordinal);
            return new LensNextFeatureFlags(new ReadOnlyDictionary<string, bool>(values));
        }

        public IReadOnlyDictionary<string, bool> Values => _values;

        public bool IsEnabled(string featureFlag)
        {
            bool value;
            return _values.TryGetValue(featureFlag, out value) && value;
        }

        public bool AnyWriteEnabled => _values.Values.Any(value => value);
    }
}
