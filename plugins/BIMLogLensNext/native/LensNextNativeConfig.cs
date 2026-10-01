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
        public bool ViewpointPublishingEnabled { get; set; } = false;
        public bool AutomaticUpdatesEnabled { get; set; } = true;
        public string UpdateChannel { get; set; } = "stable";
        public string UpdateManifestUrl { get; set; } = "https://bimlog.app/lens-next/updates/stable/manifest.json";
        public string UpdatePublicKeyXml { get; set; } = "<RSAKeyValue><Modulus>2NyTAB5mC8CdBAj2ZiQU+XELtljaKmaf1oAwBYMSrYvgcn1j60gOwl8McJfbv3vpr7Gf8dD0UJKJ6TSXVxi8cuoT+6PIrx6j9I78Cw4Qf9DpqaX4N9hyKBzylQuWWbz2hTiLRkXAszNtRYkJ+iwfA3qqkspBBK5GVKheoOTI7JlVYbDGGpSdiok3a+WSiLda9l5hr3eP/2ew87FZzoEaIJKgWjLww3zP3sDekDrP1VOgeqaEEXoXTktDI3FA2erNWrmUCOliEvTkuDEgqxXJa9I7WsU0HPj1HTPhMSANYh0NEbT6YWizPvD9ONRS71r0aI/9UFdyBNAXyTNvZbPTKfjZ39UsLV1ITtlpq7atGMbQMYOrSNSM3HiTS4qWVZUWrzWav+SPcuWonLWOqm9KCVY92mMgtNuwfMWZpFvy15waMRJrnllHbfMgVHpufRId9h9c5yzzsTcz3fTmznhX5FOPbnnFzkpbHM9u6waThpgNS4sYeBLOjiOgJZh40TRd</Modulus><Exponent>AQAB</Exponent></RSAKeyValue>";
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
            config.UpdateChannel = string.Equals(config.UpdateChannel, "beta", StringComparison.OrdinalIgnoreCase) ? "beta" : "stable";
            config.UpdateManifestUrl = (config.UpdateManifestUrl ?? "https://bimlog.app/lens-next/updates/stable/manifest.json").Trim();
            config.UpdatePublicKeyXml = string.IsNullOrWhiteSpace(config.UpdatePublicKeyXml) ? new LensNextNativeConfig().UpdatePublicKeyXml : config.UpdatePublicKeyXml.Trim();
            config.AllowedWebOrigins = (config.AllowedWebOrigins ?? new List<string>())
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Select(value => value.Trim().TrimEnd('/'))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            return config;
        }
    }
}
