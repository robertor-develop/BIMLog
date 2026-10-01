using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;

namespace BIMLogLensNext.Tests
{
    internal static partial class Program
    {
        private static LensNextUpdateManifest UpdateManifest(byte[] package)
        {
            using (var sha = SHA256.Create())
            {
                return new LensNextUpdateManifest {
                    ContractVersion = "lens-next-update.v1", Channel = "stable", Version = "2.0.0.0",
                    MinimumBimLogVersion = "1.0.0", PackageUrl = "https://bimlog.app/releases/lens-next-2.0.zip",
                    PackageSha256 = BitConverter.ToString(sha.ComputeHash(package)).Replace("-", ""), PackageSize = package.Length,
                    ReleaseNotesUrl = "https://bimlog.app/releases/2.0", Signature = "pending",
                    NavisworksYears = new System.Collections.Generic.List<int> { 2021, 2025 }
                };
            }
        }

        private static void UpdateManifestPolicyIsExact()
        {
            var manifest = UpdateManifest(new byte[] { 1, 2, 3 });
            Equal("update_available", LensNextUpdatePolicy.Evaluate(manifest, "1.5.18.36", 2025, "stable").Code);
            Equal("navisworks_incompatible", LensNextUpdatePolicy.Evaluate(manifest, "1.5.18.36", 2024, "stable").Code);
            Equal("channel_mismatch", LensNextUpdatePolicy.Evaluate(manifest, "1.5.18.36", 2025, "beta").Code);
            manifest.PackageUrl = "http://unsafe.example/update.zip";
            Equal("package_url_invalid", LensNextUpdatePolicy.Evaluate(manifest, "1.5.18.36", 2025, "stable").Code);
        }

        private static void UpdateManifestSignatureIsVerified()
        {
            var manifest = UpdateManifest(new byte[] { 1, 2, 3 });
            using (var rsa = new RSACryptoServiceProvider(2048))
            {
                manifest.Signature = Convert.ToBase64String(rsa.SignData(Encoding.UTF8.GetBytes(manifest.SignedPayload()), CryptoConfig.MapNameToOID("SHA256")));
                True(LensNextUpdateSecurity.VerifyManifest(manifest, rsa.ToXmlString(false)));
                manifest.Version = "2.0.0.1";
                False(LensNextUpdateSecurity.VerifyManifest(manifest, rsa.ToXmlString(false)));
            }
        }

        private static void UpdatePackageIntegrityIsVerified()
        {
            var root = Path.Combine(Path.GetTempPath(), "lens-update-integrity-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(root);
            try
            {
                var path = Path.Combine(root, "package.zip");
                var bytes = new byte[] { 10, 20, 30, 40 };
                File.WriteAllBytes(path, bytes);
                var manifest = UpdateManifest(bytes);
                True(LensNextUpdateSecurity.VerifyPackage(path, manifest.PackageSize, manifest.PackageSha256));
                File.AppendAllText(path, "tampered");
                False(LensNextUpdateSecurity.VerifyPackage(path, manifest.PackageSize, manifest.PackageSha256));
            }
            finally { Directory.Delete(root, true); }
        }

        private static void UpdateStagingPreservesInstallation()
        {
            var root = Path.Combine(Path.GetTempPath(), "lens-update-stage-" + Guid.NewGuid().ToString("N"));
            var install = Path.Combine(root, "installed");
            Directory.CreateDirectory(install);
            try
            {
                var package = new byte[] { 80, 75, 5, 6, 7 };
                var source = Path.Combine(root, "candidate.zip");
                File.WriteAllBytes(source, package);
                var manifest = UpdateManifest(package);
                var plan = LensNextUpdateStaging.WritePlan(root, manifest, source, install, 2025, DateTimeOffset.UtcNow);
                True(File.Exists(plan));
                True(Directory.Exists(install));
            }
            finally { Directory.Delete(root, true); }
        }

        private static void UpdateInstallerHasRollbackContract()
        {
            var path = Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "plugins", "BIMLogLensNext", "Apply-LensNextPendingUpdate.ps1"));
            True(File.Exists(path));
            var script = File.ReadAllText(path);
            True(script.Contains("Wait-Process"));
            True(script.Contains("Copy-Item -LiteralPath $backup"));
            True(script.Contains("throw 'Navisworks must be closed"));
        }
    }
}
