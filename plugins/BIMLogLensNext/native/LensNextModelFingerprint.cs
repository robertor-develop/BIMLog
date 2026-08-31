using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace BIMLogLensNext.Native
{
    public static class LensNextModelFingerprint
    {
        public static string ComputeContextFingerprint(string fileName)
        {
            if (string.IsNullOrWhiteSpace(fileName))
                throw new ArgumentException("A named Navisworks document is required.", nameof(fileName));
            var fullPath = Path.GetFullPath(fileName);
            var info = new FileInfo(fullPath);
            if (!info.Exists) throw new FileNotFoundException("The active Navisworks document file is unavailable.", fullPath);

            // Deliberately fast model-context fingerprint. It identifies the saved NWF/NWD state
            // without hashing a potentially multi-gigabyte file on every Lens Next session.
            var canonical = fullPath.ToUpperInvariant() + "|" + info.Length + "|" + info.LastWriteTimeUtc.Ticks;
            using (var sha = SHA256.Create())
            {
                var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(canonical));
                var builder = new StringBuilder(64);
                foreach (var value in bytes) builder.Append(value.ToString("x2"));
                return builder.ToString();
            }
        }

        public static string ComputeBindingKey(string fileName)
        {
            if (string.IsNullOrWhiteSpace(fileName)) throw new ArgumentException("A named Navisworks document is required.", nameof(fileName));
            var stem = Path.GetFileNameWithoutExtension(fileName) ?? string.Empty;
            var normalized = Regex.Replace(stem.ToLowerInvariant(), "[^a-z0-9]+", "-").Trim('-');
            if (normalized.Length < 3) throw new InvalidOperationException("The active model name cannot produce a stable BIMLog binding key.");
            return normalized;
        }
    }
}
