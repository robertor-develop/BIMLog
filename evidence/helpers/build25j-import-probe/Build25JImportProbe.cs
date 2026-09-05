using System;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Windows.Forms;
using Autodesk.Navisworks.Api;
using Autodesk.Navisworks.Api.ComApi;
using Autodesk.Navisworks.Api.Plugins;

namespace Build25JImportProbe
{
    [Plugin("Build25JGenuineXmlImportProbe", "BIMLog", DisplayName = "BUILD 25J Genuine XML Import Probe")]
    public sealed class ImportProbePlugin : AddInPlugin
    {
        private static readonly string[] AllowedHashes =
        {
            "4AEF4159BB77FC88E5659ED12CA94B8BA4669CB58B03B9DEC827CB17437593CA",
            "BED08C7F2725F7992A831596BD1F09AC35CE6139780DAE90656DB3E565D0D5F5",
            "E8D6EC4CB6F9726220DC68A156E9435A257374F37AD89234C663F6AB60CC2A99"
        };
        private const string ImportPluginName = "XmlViewpointsImportPlugin";

        public override int Execute(params string[] parameters)
        {
            if (parameters == null || parameters.Length != 1)
                throw new ArgumentException("One pipe-delimited XML path, evidence path, and mode parameter is required.");
            var values = parameters[0].Split(new[] { '|' }, 3);
            if (values.Length != 3)
                throw new ArgumentException("The probe parameter must contain XML path, evidence path, and mode.");

            var xmlPath = Path.GetFullPath(values[0]);
            var evidencePath = Path.GetFullPath(values[1]);
            var headless = string.Equals(values[2], "--headless", StringComparison.Ordinal);
            var report = new StringBuilder();
            report.AppendLine("PROBE=BUILD 25J Genuine XML Import Probe");
            report.AppendLine("IMPORT_PLUGIN_NAME=" + ImportPluginName);
            report.AppendLine("IMPORT_PLUGIN_ID=" + ImportPluginName);
            report.AppendLine("IMPORT_ENTRYPOINT=ComApiBridge.State.DriveIOPlugin");
            report.AppendLine("XML_PATH=" + xmlPath);

            Exception failure = null;
            object rawStatus = null;
            try
            {
                if (!File.Exists(xmlPath)) throw new FileNotFoundException("Target XML does not exist.", xmlPath);
                var actualHash = Hash(xmlPath);
                report.AppendLine("XML_SHA256=" + actualHash);
                if (!AllowedHashes.Contains(actualHash, StringComparer.Ordinal))
                    throw new InvalidDataException("XML SHA-256 is not one of the two locked Build 25J target/canonical hashes.");
                report.AppendLine("HASH_VERIFIED=YES");

                var record = Autodesk.Navisworks.Api.Application.Plugins.PluginRecords
                    .FirstOrDefault(value => string.Equals(value.Name, ImportPluginName, StringComparison.Ordinal));
                report.AppendLine("PLUGIN_RECORD_FOUND=" + (record != null ? "YES" : "NO"));
                if (record != null)
                {
                    report.AppendLine("PLUGIN_RECORD_TYPE=" + record.GetType().FullName);
                    report.AppendLine("PLUGIN_DEVELOPER_ID=" + (record.DeveloperId ?? ""));
                    report.AppendLine("PLUGIN_DISPLAY_NAME=" + (record.DisplayName ?? ""));
                    report.AppendLine("PLUGIN_ENABLED=" + record.IsEnabled.ToString(CultureInfo.InvariantCulture));
                }

                var before = Autodesk.Navisworks.Api.Application.ActiveDocument.SavedViewpoints.RootItem.Children.Count;
                report.AppendLine("SAVED_VIEWPOINTS_BEFORE=" + before.ToString(CultureInfo.InvariantCulture));
                dynamic state = ComApiBridge.State;
                dynamic options = state.GetIOPluginOptions(ImportPluginName);
                report.AppendLine("OPTIONS_CREATED=" + (options != null ? "YES" : "NO"));
                rawStatus = state.DriveIOPlugin(ImportPluginName, xmlPath, options);
                var status = Convert.ToInt32(rawStatus, CultureInfo.InvariantCulture);
                report.AppendLine("IMPORT_RETURN_CODE=" + status.ToString(CultureInfo.InvariantCulture));
                report.AppendLine("IMPORT_RESULT=" + (status == 0 ? "SUCCESS" : "FAIL"));
            }
            catch (Exception exception)
            {
                failure = exception;
                report.AppendLine("IMPORT_RESULT=EXCEPTION");
                report.AppendLine("IMPORT_RETURN_CODE=" + (rawStatus == null ? "NOT_RETURNED" : Convert.ToString(rawStatus, CultureInfo.InvariantCulture)));
                AppendException(report, exception);
            }
            finally
            {
                report.AppendLine("SAVED_VIEWPOINTS_AFTER=" + Autodesk.Navisworks.Api.Application.ActiveDocument.SavedViewpoints.RootItem.Children.Count.ToString(CultureInfo.InvariantCulture));
            }

            var directory = Path.GetDirectoryName(evidencePath);
            if (!string.IsNullOrWhiteSpace(directory)) Directory.CreateDirectory(directory);
            File.WriteAllText(evidencePath, report.ToString(), new UTF8Encoding(false));
            if (!headless)
                MessageBox.Show(report.ToString(), "BUILD 25J Genuine XML Import Probe", MessageBoxButtons.OK,
                    failure == null ? MessageBoxIcon.Information : MessageBoxIcon.Error);
            return 0;
        }

        private static string Hash(string path)
        {
            using (var stream = File.OpenRead(path))
            using (var sha = SHA256.Create())
                return string.Concat(sha.ComputeHash(stream).Select(value => value.ToString("X2", CultureInfo.InvariantCulture)));
        }

        private static void AppendException(StringBuilder report, Exception exception)
        {
            var depth = 0;
            for (var current = exception; current != null; current = current.InnerException)
            {
                report.AppendLine("EXCEPTION_" + depth + "_TYPE=" + current.GetType().FullName);
                report.AppendLine("EXCEPTION_" + depth + "_MESSAGE=" + OneLine(current.Message));
                report.AppendLine("EXCEPTION_" + depth + "_HRESULT=0x" + current.HResult.ToString("X8", CultureInfo.InvariantCulture));
                if (current is COMException com)
                    report.AppendLine("EXCEPTION_" + depth + "_COM_ERROR_CODE=0x" + com.ErrorCode.ToString("X8", CultureInfo.InvariantCulture));
                report.AppendLine("EXCEPTION_" + depth + "_STACK=" + OneLine(current.StackTrace));
                depth++;
            }
        }

        private static string OneLine(string value)
        {
            return string.IsNullOrEmpty(value) ? "" : value.Replace("\r", " ").Replace("\n", " ");
        }
    }
}
