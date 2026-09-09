using System;
using System.IO;
using System.Collections.Generic;
using System.Text;
using System.Xml;
using System.Linq;

namespace BIMLogLensNext
{
    public static class LensNextXmlDocumentShellWriter
    {
        public const string RootElementName = "exchange";
        public const string ViewpointsElementName = "viewpoints";
        public const string ViewFolderElementName = "viewfolder";
        public const string ViewFolderName = "BIMLog Viewpoints";
        public const string XmlSchemaInstanceNamespace = "http://www.w3.org/2001/XMLSchema-instance";
        public const string NavisworksExchangeSchemaLocation = "http://download.autodesk.com/us/navisworks/schemas/nw-exchange-12.0.xsd";

        public static void Write(string destinationPath)
        {
            WriteDocument(destinationPath, new LensNextXmlExportView[0]);
        }

        public static LensNextXmlExportResult Write(
            string destinationPath,
            int authoritativeProjectId,
            IEnumerable<LensNextXmlExportInput> records)
        {
            LensNextXmlExportResult result;
            try
            {
                result = LensNextXmlExportInputSelector.SelectForExport(authoritativeProjectId, records);
            }
            catch (InvalidDataException exception)
            {
                var requested = exception.Data.Contains("BIMLog.RequestedCount") ? (int?)Convert.ToInt32(exception.Data["BIMLog.RequestedCount"]) : null;
                var skipped = exception.Data.Contains("BIMLog.SkippedCount") ? (int?)Convert.ToInt32(exception.Data["BIMLog.SkippedCount"]) : null;
                AttachFailure(destinationPath, exception, requested, skipped);
                throw;
            }
            var ordered = result.SerializedViewpoints;
            var names = LensNextXmlExportNamePolicy.UniqueNames(ordered);
            var views = new LensNextXmlExportView[ordered.Count];
            for (var index = 0; index < ordered.Count; index++)
                views[index] = new LensNextXmlExportView(
                    names[index],
                    LensNextXmlExportGuidPolicy.ForRecord(ordered[index]),
                    LensNextXmlPosition.FromValidatedCamera(ordered[index].PackageCamera),
                    LensNextXmlRotation.FromValidatedCamera(ordered[index].PackageCamera),
                    LensNextXmlUpVector.FromOptionalValidatedCamera(ordered[index].PackageCamera),
                    LensNextXmlProjection.FromValidatedCamera(ordered[index].PackageCamera),
                    LensNextXmlCameraScale.FromOptionalValidatedCamera(ordered[index].PackageCamera),
                    LensNextXmlSectioning.FromOptionalJson(ordered[index].PackageSectioningJson, LensNextXmlLinearUnit.FromCamera(ordered[index].PackageCamera)));
            WriteDocument(destinationPath, views);
            var outputPath = Path.GetFullPath(destinationPath);
            ValidateWrittenDocument(outputPath, result.SerializedCount);
            result.Summary = LensNextXmlExportSummary.Passed(
                outputPath, result.RequestedCount, result.SerializedCount, result.SkippedCount);
            return result;
        }

        private static void AttachFailure(
            string destinationPath,
            InvalidDataException exception,
            int? requestedCount,
            int? skippedCount)
        {
            string outputPath;
            try { outputPath = string.IsNullOrWhiteSpace(destinationPath) ? destinationPath : Path.GetFullPath(destinationPath); }
            catch { outputPath = destinationPath; }
            exception.Data[LensNextXmlExportFailure.SummaryDataKey] =
                LensNextXmlExportSummary.Failed(outputPath, requestedCount, skippedCount, exception.Message);
        }

        private static void ValidateWrittenDocument(string outputPath, int expectedViewCount)
        {
            var document = new XmlDocument { XmlResolver = null };
            document.Load(outputPath);
            var declaration = document.FirstChild as XmlDeclaration;
            if (declaration == null || !string.Equals(declaration.Encoding, "utf-8", StringComparison.OrdinalIgnoreCase))
                throw new InvalidDataException("The written BIMLog XML export encoding declaration is invalid.");
            if (document.DocumentElement == null ||
                !string.Equals(document.DocumentElement.Name, RootElementName, StringComparison.Ordinal))
                throw new InvalidDataException("The written BIMLog XML export root is invalid.");
            if (!string.Equals(
                    document.DocumentElement.GetAttribute("noNamespaceSchemaLocation", XmlSchemaInstanceNamespace),
                    NavisworksExchangeSchemaLocation,
                    StringComparison.Ordinal))
                throw new InvalidDataException("The written BIMLog XML export Navisworks schema declaration is invalid.");
            var viewpoints = document.DocumentElement.SelectNodes(ViewpointsElementName);
            var folders = document.DocumentElement.SelectNodes(ViewpointsElementName + "/" + ViewFolderElementName);
            if (viewpoints.Count != 1 || folders.Count != 1 ||
                !string.Equals(((XmlElement)folders[0]).GetAttribute("name"), ViewFolderName, StringComparison.Ordinal))
                throw new InvalidDataException("The written BIMLog XML export structure is invalid.");
            if (((XmlElement)folders[0]).SelectNodes("view").Count != expectedViewCount)
                throw new InvalidDataException("The written BIMLog XML export viewpoint count does not match the serialized result.");

            if (!string.Equals(document.DocumentElement.GetAttribute("units"), "ft", StringComparison.Ordinal))
                throw new InvalidDataException("The written BIMLog XML export unit is invalid.");
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
                    writer.WriteAttributeString("xmlns", "xsi", null, XmlSchemaInstanceNamespace);
                    writer.WriteAttributeString("xsi", "noNamespaceSchemaLocation", XmlSchemaInstanceNamespace, NavisworksExchangeSchemaLocation);
                    writer.WriteAttributeString("filename", metadata.FileName);
                    writer.WriteAttributeString("filepath", metadata.FilePath);
                    writer.WriteAttributeString("units", "ft");
                    writer.WriteStartElement(ViewpointsElementName);
                    writer.WriteStartElement(ViewFolderElementName);
                    writer.WriteAttributeString("name", ViewFolderName);
                    foreach (var view in views)
                    {
                        writer.WriteStartElement("view");
                        writer.WriteAttributeString("name", view.Name);
                        writer.WriteAttributeString("guid", view.Guid.ToString("D"));
                        writer.WriteStartElement("viewpoint");
                        writer.WriteStartElement("camera");
                        writer.WriteAttributeString("projection", view.Projection.Token);
                        writer.WriteAttributeString("near", "1.0000000000");
                        writer.WriteAttributeString("far", "10.0000000000");
                        writer.WriteAttributeString("aspect", "1.0000000000");
                        writer.WriteAttributeString("height", "0.7853980000");
                        writer.WriteStartElement("position");
                        writer.WriteStartElement("pos3f");
                        writer.WriteAttributeString("x", view.Position.XFeetInvariant);
                        writer.WriteAttributeString("y", view.Position.YFeetInvariant);
                        writer.WriteAttributeString("z", view.Position.ZFeetInvariant);
                        writer.WriteEndElement();
                        writer.WriteEndElement();
                        writer.WriteStartElement("rotation");
                        writer.WriteStartElement("quaternion");
                        writer.WriteAttributeString("a", view.Rotation.AInvariant);
                        writer.WriteAttributeString("b", view.Rotation.BInvariant);
                        writer.WriteAttributeString("c", view.Rotation.CInvariant);
                        writer.WriteAttributeString("d", view.Rotation.DInvariant);
                        writer.WriteEndElement();
                        writer.WriteEndElement();
                        writer.WriteEndElement();
                        if (view.UpVector != null)
                        {
                            writer.WriteStartElement("up");
                            writer.WriteStartElement("vec3f");
                            writer.WriteAttributeString("x", view.UpVector.XInvariant);
                            writer.WriteAttributeString("y", view.UpVector.YInvariant);
                            writer.WriteAttributeString("z", view.UpVector.ZInvariant);
                            writer.WriteEndElement();
                            writer.WriteEndElement();
                        }
                        writer.WriteEndElement();
                        if (view.Sectioning != null)
                        {
                            writer.WriteStartElement("clipplaneset");
                            writer.WriteAttributeString("linked", "0");
                            writer.WriteAttributeString("current", "0");
                            writer.WriteAttributeString("mode", "planes");
                            writer.WriteAttributeString("enabled", view.Sectioning.EnabledToken);
                            WriteSentinelBox(writer, "range");
                            writer.WriteStartElement("clipplanes");
                            foreach (var plane in view.Sectioning.Planes)
                            {
                                writer.WriteStartElement("clipplane");
                                writer.WriteAttributeString("state", plane.State);
                                writer.WriteAttributeString("distance", "0.0000000000");
                                writer.WriteAttributeString("alignment", "view");
                                writer.WriteStartElement("plane");
                                writer.WriteAttributeString("distance", plane.DistanceFeetInvariant);
                                writer.WriteStartElement("vec3f");
                                writer.WriteAttributeString("x", plane.XInvariant);
                                writer.WriteAttributeString("y", plane.YInvariant);
                                writer.WriteAttributeString("z", plane.ZInvariant);
                                writer.WriteEndElement();
                                writer.WriteEndElement();
                                writer.WriteEndElement();
                            }
                            writer.WriteEndElement();
                            WriteSentinelBox(writer, "box");
                            writer.WriteStartElement("box-rotation");
                            writer.WriteStartElement("rotation");
                            writer.WriteStartElement("quaternion");
                            writer.WriteAttributeString("a", "0.0000000000");
                            writer.WriteAttributeString("b", "0.0000000000");
                            writer.WriteAttributeString("c", "0.0000000000");
                            writer.WriteAttributeString("d", "1.0000000000");
                            writer.WriteEndElement();
                            writer.WriteEndElement();
                            writer.WriteEndElement();
                            writer.WriteEndElement();
                        }
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

        private static void WriteSentinelBox(XmlWriter writer, string elementName)
        {
            writer.WriteStartElement(elementName);
            writer.WriteStartElement("box3f");
            writer.WriteStartElement("min");
            WriteSentinelPosition(writer, "1.0000000000");
            writer.WriteEndElement();
            writer.WriteStartElement("max");
            WriteSentinelPosition(writer, "0.0000000000");
            writer.WriteEndElement();
            writer.WriteEndElement();
            writer.WriteEndElement();
        }

        private static void WriteSentinelPosition(XmlWriter writer, string value)
        {
            writer.WriteStartElement("pos3f");
            writer.WriteAttributeString("x", value);
            writer.WriteAttributeString("y", value);
            writer.WriteAttributeString("z", value);
            writer.WriteEndElement();
        }

        private sealed class LensNextXmlExportView
        {
            public LensNextXmlExportView(string name, Guid guid, LensNextXmlPosition position, LensNextXmlRotation rotation, LensNextXmlUpVector upVector, LensNextXmlProjection projection, LensNextXmlCameraScale cameraScale, LensNextXmlSectioning sectioning)
            {
                Name = name;
                Guid = guid;
                Position = position;
                Rotation = rotation;
                UpVector = upVector;
                Projection = projection;
                CameraScale = cameraScale;
                Sectioning = sectioning;
            }
            public string Name { get; }
            public Guid Guid { get; }
            public LensNextXmlPosition Position { get; }
            public LensNextXmlRotation Rotation { get; }
            public LensNextXmlUpVector UpVector { get; }
            public LensNextXmlProjection Projection { get; }
            public LensNextXmlCameraScale CameraScale { get; }
            public LensNextXmlSectioning Sectioning { get; }
        }
    }
}
