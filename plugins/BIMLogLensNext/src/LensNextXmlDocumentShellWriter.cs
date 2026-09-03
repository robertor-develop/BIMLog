using System;
using System.IO;
using System.Collections.Generic;
using System.Text;
using System.Xml;

namespace BIMLogLensNext
{
    public static class LensNextXmlDocumentShellWriter
    {
        public const string RootElementName = "exchange";
        public const string ViewpointsElementName = "viewpoints";
        public const string ViewFolderElementName = "viewfolder";
        public const string ViewFolderName = "BIMLog Viewpoints";

        public static void Write(string destinationPath)
        {
            WriteShell(destinationPath);
        }

        public static IReadOnlyList<LensNextXmlExportInput> Write(
            string destinationPath,
            int authoritativeProjectId,
            IEnumerable<LensNextXmlExportInput> records)
        {
            var ordered = LensNextXmlExportInputSelector.SelectOrdered(authoritativeProjectId, records);
            WriteShell(destinationPath);
            return ordered;
        }

        private static void WriteShell(string destinationPath)
        {
            if (string.IsNullOrWhiteSpace(destinationPath))
                throw new ArgumentException("An XML output path is required.", nameof(destinationPath));

            var fullPath = Path.GetFullPath(destinationPath);
            if (!string.Equals(Path.GetExtension(fullPath), ".xml", StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException("The XML output path must use the .xml extension.", nameof(destinationPath));

            var directory = Path.GetDirectoryName(fullPath);
            if (string.IsNullOrWhiteSpace(directory) || !Directory.Exists(directory))
                throw new DirectoryNotFoundException("The XML output directory does not exist: " + directory);

            var temporaryPath = Path.Combine(directory, "." + Path.GetFileName(fullPath) + "." + Guid.NewGuid().ToString("N") + ".tmp");
            try
            {
                var settings = new XmlWriterSettings
                {
                    Encoding = new UTF8Encoding(false),
                    Indent = true,
                    IndentChars = "  ",
                    NewLineChars = "\n",
                    NewLineHandling = NewLineHandling.Replace,
                    OmitXmlDeclaration = false,
                    CloseOutput = true
                };

                using (var writer = XmlWriter.Create(temporaryPath, settings))
                {
                    writer.WriteStartDocument();
                    writer.WriteStartElement(RootElementName);
                    writer.WriteStartElement(ViewpointsElementName);
                    writer.WriteStartElement(ViewFolderElementName);
                    writer.WriteAttributeString("name", ViewFolderName);
                    writer.WriteEndElement();
                    writer.WriteEndElement();
                    writer.WriteEndElement();
                    writer.WriteEndDocument();
                }

                if (File.Exists(fullPath)) File.Replace(temporaryPath, fullPath, null);
                else File.Move(temporaryPath, fullPath);
            }
            catch
            {
                try { if (File.Exists(temporaryPath)) File.Delete(temporaryPath); } catch { }
                throw;
            }
        }
    }
}
