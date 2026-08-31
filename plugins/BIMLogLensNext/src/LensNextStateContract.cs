using System;
using System.IO;

namespace BIMLogLensNext
{
    public sealed class LensNextStateContract
    {
        public string ConfigurationRoot => LensNextConstants.ConfigurationRoot;
        public string ConfigurationFile => LensNextConstants.ConfigurationFile;
        public string CacheRoot => LensNextConstants.CacheRoot;
        public string LogRoot => LensNextConstants.LogRoot;

        public string ResolveConfigurationRoot(string localApplicationData)
        {
            if (string.IsNullOrWhiteSpace(localApplicationData))
            {
                throw new ArgumentException("LOCALAPPDATA is required.", nameof(localApplicationData));
            }

            return Path.Combine(localApplicationData, "BIMLog", "LensNext");
        }

        public bool IsLegacyPath(string candidate)
        {
            if (string.IsNullOrWhiteSpace(candidate))
            {
                return false;
            }

            var normalized = Normalize(candidate);
            return IsRootOrDescendant(normalized, @"%APPDATA%\BIMLog") ||
                   ContainsRootOrDescendant(normalized, @"AppData\Roaming\BIMLog");
        }

        private static string Normalize(string candidate)
        {
            var normalized = candidate.Trim().Replace('/', '\\');
            while (normalized.Contains(@"\\"))
            {
                normalized = normalized.Replace(@"\\", @"\");
            }

            return normalized.TrimEnd('\\');
        }

        private static bool IsRootOrDescendant(string candidate, string root)
        {
            return candidate.Equals(root, StringComparison.OrdinalIgnoreCase) ||
                   candidate.StartsWith(root + @"\", StringComparison.OrdinalIgnoreCase);
        }

        private static bool ContainsRootOrDescendant(string candidate, string root)
        {
            if (IsRootOrDescendant(candidate, root))
            {
                return true;
            }

            var segmentRoot = @"\" + root;
            var index = candidate.IndexOf(segmentRoot, StringComparison.OrdinalIgnoreCase);
            if (index < 0)
            {
                return false;
            }

            var boundary = index + segmentRoot.Length;
            return boundary == candidate.Length || candidate[boundary] == '\\';
        }
    }
}
