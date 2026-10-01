using System;
using System.IO;
using System.Reflection;
using System.Threading.Tasks;
using System.Diagnostics;

namespace BIMLogLensNext.Native
{
    internal sealed class LensNextNativeUpdateService
    {
        private readonly LensNextNativeConfig _config;
        private readonly int _navisworksYear;

        public LensNextNativeUpdateService(LensNextNativeConfig config, int navisworksYear)
        {
            _config = config ?? throw new ArgumentNullException(nameof(config));
            _navisworksYear = navisworksYear;
        }

        public Task CheckOnStartupAsync()
        {
            if (!_config.AutomaticUpdatesEnabled) return Task.CompletedTask;
            return Task.Run(() => Check());
        }

        private void Check()
        {
            try
            {
                if (string.IsNullOrWhiteSpace(_config.UpdatePublicKeyXml))
                {
                    LensNextNativeLog.Warn("Automatic update check skipped: trusted release key is not installed.");
                    return;
                }
                var current = Assembly.GetExecutingAssembly().GetName().Version.ToString();
                var root = LensNextNativeConfig.ConfigDirectory;
                var installRoot = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
                var result = new LensNextUpdateCoordinator(new LensNextUpdateClient()).CheckAndStage(
                    new Uri(_config.UpdateManifestUrl), current, _navisworksYear, _config.UpdateChannel,
                    _config.UpdatePublicKeyXml, root, installRoot);
                LensNextNativeLog.Info("Automatic update result: " + result.Code + (result.Manifest == null ? "" : " version=" + result.Manifest.Version));
                if (result.Code == "update_staged") LaunchUpdater(result.StagedPlanPath, installRoot);
            }
            catch (Exception error)
            {
                LensNextNativeLog.Warn("Automatic update check unavailable; installed Lens remains active. " + error.GetType().Name);
            }
        }

        private static void LaunchUpdater(string planPath, string installRoot)
        {
            var script = Path.Combine(installRoot, "Apply-LensNextPendingUpdate.ps1");
            if (!File.Exists(script)) throw new FileNotFoundException("Lens Next updater helper is missing.", script);
            var arguments = "-NoProfile -ExecutionPolicy Bypass -File \"" + script + "\" -PlanPath \"" + planPath + "\" -WaitForProcessId " + Process.GetCurrentProcess().Id;
            Process.Start(new ProcessStartInfo("powershell.exe", arguments) { UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden });
        }
    }
}
