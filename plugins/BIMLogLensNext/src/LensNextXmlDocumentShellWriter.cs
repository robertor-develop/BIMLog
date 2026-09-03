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
            WriteDocument(destinationPath, new LensNextXmlExportView[0]);
        }

        public static IReadOnlyList<LensNextXmlExportInput> Write(
            string destinationPath,
            int authoritativeProjectId,
            IEnumerable<LensNextXmlExportInput> records)
        {
            var ordered = LensNextXmlExportInputSelector.SelectOrdered(authoritativeProjectId, records);
            var names = LensNextXmlExportNamePolicy.UniqueNames(ordered);
            var views = new LensNextXmlExportView[ordered.Count];
            for (var index = 0; index < ordered.Count; index++)
                views[index] = new LensNextXmlExportView(
                    names[index],
                    LensNextXmlExportGuidPolicy.ForRecord(ordered[index]),
                    LensNextXmlPosition.FromValidatedCamera(ordered[index].PackageCamera));
            WriteDocument(destinationPath, views);
            return ordered;
        }

        private static void WriteDocument(string destinationPath, IReadOnlyList<LensNextXmlExportView> views)
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
            var metadata = LensNextXmlExchangeMetadata.ProductControlled();
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
                    writer.WriteAttributeString("filename", metadata.FileName);
                    writer.WriteAttributeString("filepath", metadata.FilePath);
                    writer.WriteStartElement(ViewpointsElementName);
                    writer.WriteStartElement(ViewFolderElementName);
                    writer.WriteAttributeString("name", ViewFolderName);
                    foreach (var view in views)
                    {
                        writer.WriteStartElement("view");
                        writer.WriteAttributeString("name", view.Name);
                        writer.WriteAttributeString("guid", view.Guid.ToString("D"));
                        writer.WriteStartElement("viewpoint");
                        writer.WriteStartElement("position");
                        writer.WriteStartElement("pos3f");
                        writer.WriteAttributeString("x", view.Position.XInvariant);
                        writer.WriteAttributeString("y", view.Position.YInvariant);
                        writer.WriteAttributeString("z", view.Position.ZInvariant);
                        writer.WriteEndElement();
                        writer.WriteEndElement();
                        writer.WriteEndElement();
                        writer.WriteEndElement();
                    }
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

        private sealed class LensNextXmlExportView
        {
            public LensNextXmlExportView(string name, Guid guid, LensNextXmlPosition position)
            {
                Name = name;
                Guid = guid;
                Position = position;
            }
            public string Name { get; }
            public Guid Guid { get; }
            public LensNextXmlPosition Position { get; }
        }
    }
}
