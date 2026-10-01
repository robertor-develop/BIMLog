using System;
using System.IO;
using System.Web.Script.Serialization;

namespace BIMLogLensNext
{
    public sealed class LensNextPendingUpdate
    {
        public string ContractVersion { get; set; } = "lens-next-pending-update.v1";
        public string Version { get; set; }
        public string PackagePath { get; set; }
        public string InstallRoot { get; set; }
        public string BackupRoot { get; set; }
        public int NavisworksYear { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
    }

    public static class LensNextUpdateStaging
    {
        public static string WritePlan(string stateRoot, LensNextUpdateManifest manifest, string verifiedPackagePath, string installRoot, int navisworksYear, DateTimeOffset now)
        {
            if (manifest == null || !File.Exists(verifiedPackagePath)) throw new InvalidOperationException("A verified update package is required.");
            var fullState = Path.GetFullPath(stateRoot);
            var staging = Path.Combine(fullState, "updates", "staged", manifest.Version);
            Directory.CreateDirectory(staging);
            var packageTarget = Path.Combine(staging, "package.zip");
            File.Copy(verifiedPackagePath, packageTarget, true);
            if (!LensNextUpdateSecurity.VerifyPackage(packageTarget, manifest.PackageSize, manifest.PackageSha256))
            {
                File.Delete(packageTarget);
                throw new InvalidDataException("The staged package failed integrity verification.");
            }
            var plan = new LensNextPendingUpdate {
                Version = manifest.Version, PackagePath = packageTarget, InstallRoot = Path.GetFullPath(installRoot),
                BackupRoot = Path.Combine(fullState, "updates", "backup"), NavisworksYear = navisworksYear, CreatedAt = now
            };
            var planPath = Path.Combine(staging, "pending-update.json");
            File.WriteAllText(planPath, new JavaScriptSerializer().Serialize(plan));
            return planPath;
        }
    }
}
