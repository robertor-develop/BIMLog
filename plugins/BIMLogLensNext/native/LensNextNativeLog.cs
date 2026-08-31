using System;
using System.IO;
using System.Text;

namespace BIMLogLensNext.Native
{
    internal static class LensNextNativeLog
    {
        private static readonly object Sync = new object();

        public static string LogDirectory => Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "BIMLog", "LensNext", "logs");

        public static string LogPath => Path.Combine(LogDirectory, "lens-next-native.log");

        public static void Info(string message) { Write("INFO", message); }
        public static void Warn(string message) { Write("WARN", message); }
        public static void Error(string message) { Write("ERROR", message); }

        public static void Error(string message, Exception error)
        {
            Write("ERROR", message + (error == null ? "" : " | " + error.ToString()));
        }

        private static void Write(string level, string message)
        {
            try
            {
                Directory.CreateDirectory(LogDirectory);
                var safe = (message ?? "").Replace("\r", " ").Replace("\n", " ");
                var line = DateTimeOffset.Now.ToString("yyyy-MM-dd HH:mm:ss.fff zzz") + " | " + level + " | " + safe + Environment.NewLine;
                lock (Sync) File.AppendAllText(LogPath, line, new UTF8Encoding(false));
            }
            catch
            {
                // Logging must never destabilize Navisworks or alter workflow behavior.
            }
        }
    }
}
