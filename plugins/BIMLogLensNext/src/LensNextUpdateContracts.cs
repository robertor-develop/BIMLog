using System;
using System.Collections.Generic;
using System.Linq;

namespace BIMLogLensNext
{
    public sealed class LensNextUpdateManifest
    {
        public string ContractVersion { get; set; }
        public string Channel { get; set; }
        public string Version { get; set; }
        public string MinimumBimLogVersion { get; set; }
        public string PackageUrl { get; set; }
        public string PackageSha256 { get; set; }
        public long PackageSize { get; set; }
        public string Signature { get; set; }
        public string ReleaseNotesUrl { get; set; }
        public bool Mandatory { get; set; }
        public List<int> NavisworksYears { get; set; } = new List<int>();

        public string SignedPayload()
        {
            return string.Join("\n", new[] {
                ContractVersion ?? "", Channel ?? "", Version ?? "", MinimumBimLogVersion ?? "",
                PackageUrl ?? "", (PackageSha256 ?? "").ToLowerInvariant(), PackageSize.ToString(),
                string.Join(",", (NavisworksYears ?? new List<int>()).OrderBy(value => value)),
                Mandatory ? "true" : "false", ReleaseNotesUrl ?? ""
            });
        }
    }

    public sealed class LensNextUpdateDecision
    {
        public bool UpdateAvailable { get; set; }
        public string Code { get; set; }
        public LensNextUpdateManifest Manifest { get; set; }
    }

    public static class LensNextUpdatePolicy
    {
        public static LensNextUpdateDecision Evaluate(LensNextUpdateManifest manifest, string installedVersion, int navisworksYear, string expectedChannel)
        {
            if (manifest == null) return Deny("manifest_missing");
            if (!string.Equals(manifest.ContractVersion, "lens-next-update.v1", StringComparison.Ordinal)) return Deny("contract_unsupported");
            if (!string.Equals(manifest.Channel, expectedChannel, StringComparison.OrdinalIgnoreCase)) return Deny("channel_mismatch");
            if (manifest.NavisworksYears == null || !manifest.NavisworksYears.Contains(navisworksYear)) return Deny("navisworks_incompatible");
            Version available;
            Version installed;
            if (!Version.TryParse(manifest.Version, out available) || !Version.TryParse(installedVersion, out installed)) return Deny("version_invalid");
            if (!Uri.IsWellFormedUriString(manifest.PackageUrl, UriKind.Absolute) || !manifest.PackageUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase)) return Deny("package_url_invalid");
            if (manifest.PackageSize <= 0 || manifest.PackageSize > 250L * 1024L * 1024L) return Deny("package_size_invalid");
            if (string.IsNullOrWhiteSpace(manifest.PackageSha256) || manifest.PackageSha256.Length != 64 || !manifest.PackageSha256.All(Uri.IsHexDigit)) return Deny("package_digest_invalid");
            if (string.IsNullOrWhiteSpace(manifest.Signature)) return Deny("signature_missing");
            return new LensNextUpdateDecision { UpdateAvailable = available > installed, Code = available > installed ? "update_available" : "current", Manifest = manifest };
        }

        private static LensNextUpdateDecision Deny(string code) => new LensNextUpdateDecision { UpdateAvailable = false, Code = code };
    }
}
