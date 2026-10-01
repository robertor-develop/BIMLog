using System;
using System.IO;
using System.Net;
using System.Web.Script.Serialization;

namespace BIMLogLensNext
{
    public sealed class LensNextUpdateClient
    {
        public LensNextUpdateManifest ReadManifest(string json)
        {
            if (string.IsNullOrWhiteSpace(json) || json.Length > 128 * 1024) throw new InvalidDataException("Update manifest is empty or too large.");
            return new JavaScriptSerializer { MaxJsonLength = 128 * 1024 }.Deserialize<LensNextUpdateManifest>(json);
        }

        public string DownloadText(Uri address)
        {
            RequireHttps(address);
            using (var client = NewClient()) return client.DownloadString(address);
        }

        public void DownloadPackage(Uri address, string destination)
        {
            RequireHttps(address);
            Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(destination)));
            var temporary = destination + ".download";
            try
            {
                using (var client = NewClient()) client.DownloadFile(address, temporary);
                if (File.Exists(destination)) File.Delete(destination);
                File.Move(temporary, destination);
            }
            finally { if (File.Exists(temporary)) File.Delete(temporary); }
        }

        private static WebClient NewClient()
        {
            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
            var client = new WebClient();
            client.Headers[HttpRequestHeader.UserAgent] = "BIMLog-Lens-Next-Updater/1";
            return client;
        }

        private static void RequireHttps(Uri address)
        {
            if (address == null || !string.Equals(address.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Lens Next updates require HTTPS.");
        }
    }

    public sealed class LensNextUpdateCheckResult
    {
        public string Code { get; set; }
        public LensNextUpdateManifest Manifest { get; set; }
        public string StagedPlanPath { get; set; }
    }

    public sealed class LensNextUpdateCoordinator
    {
        private readonly LensNextUpdateClient _client;
        public LensNextUpdateCoordinator(LensNextUpdateClient client) { _client = client ?? throw new ArgumentNullException(nameof(client)); }

        public LensNextUpdateCheckResult CheckAndStage(Uri manifestUri, string installedVersion, int year, string channel, string publicKeyXml, string stateRoot, string installRoot)
        {
            var manifest = _client.ReadManifest(_client.DownloadText(manifestUri));
            var decision = LensNextUpdatePolicy.Evaluate(manifest, installedVersion, year, channel);
            if (!decision.UpdateAvailable) return new LensNextUpdateCheckResult { Code = decision.Code, Manifest = manifest };
            if (!LensNextUpdateSecurity.VerifyManifest(manifest, publicKeyXml)) return new LensNextUpdateCheckResult { Code = "manifest_signature_invalid", Manifest = manifest };
            var packagePath = Path.Combine(Path.GetFullPath(stateRoot), "updates", "downloads", manifest.Version + ".zip");
            _client.DownloadPackage(new Uri(manifest.PackageUrl), packagePath);
            if (!LensNextUpdateSecurity.VerifyPackage(packagePath, manifest.PackageSize, manifest.PackageSha256))
            {
                File.Delete(packagePath);
                return new LensNextUpdateCheckResult { Code = "package_integrity_invalid", Manifest = manifest };
            }
            var plan = LensNextUpdateStaging.WritePlan(stateRoot, manifest, packagePath, installRoot, year, DateTimeOffset.UtcNow);
            return new LensNextUpdateCheckResult { Code = "update_staged", Manifest = manifest, StagedPlanPath = plan };
        }
    }
}
