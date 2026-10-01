using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;

namespace BIMLogLensNext
{
    public static class LensNextUpdateSecurity
    {
        public static bool VerifyManifest(LensNextUpdateManifest manifest, string rsaPublicKeyXml)
        {
            if (manifest == null || string.IsNullOrWhiteSpace(rsaPublicKeyXml) || string.IsNullOrWhiteSpace(manifest.Signature)) return false;
            byte[] signature;
            try { signature = Convert.FromBase64String(manifest.Signature); }
            catch (FormatException) { return false; }
            try
            {
                using (var rsa = new RSACryptoServiceProvider())
                {
                    rsa.FromXmlString(rsaPublicKeyXml);
                    return rsa.VerifyData(Encoding.UTF8.GetBytes(manifest.SignedPayload()), CryptoConfig.MapNameToOID("SHA256"), signature);
                }
            }
            catch (CryptographicException) { return false; }
        }

        public static bool VerifyPackage(string path, long expectedSize, string expectedSha256)
        {
            if (!File.Exists(path) || new FileInfo(path).Length != expectedSize) return false;
            using (var stream = File.OpenRead(path))
            using (var sha = SHA256.Create())
            {
                var actual = BitConverter.ToString(sha.ComputeHash(stream)).Replace("-", "");
                return string.Equals(actual, expectedSha256, StringComparison.OrdinalIgnoreCase);
            }
        }
    }
}
