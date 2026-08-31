using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Web.Script.Serialization;

namespace BIMLogLensNext.Native
{
    public sealed class LensNextNativeConfig
    {
        public string BimLogWebUrl { get; set; } = "https://bimlog.app";
        public int ProjectId { get; set; }
        public int AutoRefreshSeconds { get; set; } = 10;
        public bool ViewpointPublishingEnabled { get; set; } = true;
        public List<string> AllowedWebOrigins { get; set; } = new List<string> { "https://bimlog.app", "https://www.bimlog.app" };

        public static string ConfigDirectory => Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "BIMLog", "LensNext");

        public static string ConfigPath => Path.Combine(ConfigDirectory, "lens-next.config.json");

        public static string WebViewProfileDirectory => Path.Combine(ConfigDirectory, "webview2");

        public static LensNextNativeConfig Load()
        {
            try
            {
                if (!File.Exists(ConfigPath)) return new LensNextNativeConfig();
                var serializer = new JavaScriptSerializer();
                var config = serializer.Deserialize<LensNextNativeConfig>(File.ReadAllText(ConfigPath));
                return Normalize(config ?? new LensNextNativeConfig());
            }
            catch
            {
                return new LensNextNativeConfig();
            }
        }

        public void Save()
        {
            var normalized = Normalize(this);
            Directory.CreateDirectory(ConfigDirectory);
            var serializer = new JavaScriptSerializer();
            File.WriteAllText(ConfigPath, serializer.Serialize(normalized));
        }

        public Uri WebUri()
        {
            Uri uri;
            if (!Uri.TryCreate(BimLogWebUrl, UriKind.Absolute, out uri) ||
                (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp))
            {
                throw new InvalidOperationException("Lens Next BIMLog web URL is invalid.");
            }
            return uri;
        }

        public string LensNextUrl(string bridgeOrigin)
        {
            var baseUri = WebUri().ToString().TrimEnd('/');
            return baseUri + "/lens-next?launch=navisworks&bridgeOrigin=" + Uri.EscapeDataString(bridgeOrigin);
        }

        public IReadOnlyCollection<string> EffectiveAllowedOrigins()
        {
            var origins = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var raw in AllowedWebOrigins ?? new List<string>())
            {
                Uri uri;
                if (Uri.TryCreate(raw, UriKind.Absolute, out uri))
                    origins.Add(uri.GetLeftPart(UriPartial.Authority).TrimEnd('/'));
            }
            var web = WebUri();
            origins.Add(web.GetLeftPart(UriPartial.Authority).TrimEnd('/'));
            return origins.ToArray();
        }

        private static LensNextNativeConfig Normalize(LensNextNativeConfig config)
        {
            config.BimLogWebUrl = (config.BimLogWebUrl ?? "https://bimlog.app").Trim().TrimEnd('/');
            config.AutoRefreshSeconds = Math.Max(5, Math.Min(300, config.AutoRefreshSeconds));
            config.AllowedWebOrigins = (config.AllowedWebOrigins ?? new List<string>())
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Select(value => value.Trim().TrimEnd('/'))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            return config;
        }
    }
}
