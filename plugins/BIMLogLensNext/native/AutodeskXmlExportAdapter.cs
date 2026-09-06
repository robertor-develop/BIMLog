using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace BIMLogLensNext.Native
{
    public sealed partial class AutodeskLensNextReadOnlyAdapter : ILensNextXmlExportNavisworksAdapter
    {
        private sealed class XmlExportWireRecord
        {
            public int ProjectId { get; set; }
            public int ServerId { get; set; }
            public string ViewpointId { get; set; }
            public string LifecycleStatus { get; set; }
            public int RevisionNumber { get; set; }
            public string DisplayId { get; set; }
            public string Note { get; set; }
            public int? Priority { get; set; }
            public string CapturedAt { get; set; }
            public string VisualStateDigest { get; set; }
            public LensNextVisualState Package { get; set; }
        }

        public LensNextXmlExportOperationResult ExportViewpointsXml(string projectId, string modelFingerprint, string recordsJson)
        {
            EnsureSameDocument();
            var context = ReadProjectContext();
            if (!string.Equals(context.ProjectId, projectId, StringComparison.Ordinal))
                throw new InvalidDataException("The XML export project does not match the active authoritative BIMLog project.");
            if (!string.Equals(context.ModelFingerprint, modelFingerprint, StringComparison.OrdinalIgnoreCase))
                throw new InvalidDataException("The XML export model fingerprint does not match the active Navisworks model.");

            var serializer = new JavaScriptSerializer { MaxJsonLength = LensNextConstants.BridgeMaximumFieldLength };
            var wire = serializer.Deserialize<List<XmlExportWireRecord>>(recordsJson);
            if (wire == null || wire.Count == 0)
                throw new InvalidDataException("At least one authoritative BIMLog viewpoint is required for XML export.");
            var records = wire.Select(ToExportInput).ToArray();

            using (var dialog = new SaveFileDialog
            {
                Title = "Export BIMLog Viewpoints XML",
                Filter = "Navisworks Viewpoints XML (*.xml)|*.xml",
                DefaultExt = "xml",
                AddExtension = true,
                OverwritePrompt = true,
                FileName = "BIMLog-Viewpoints.xml"
            })
            {
                if (dialog.ShowDialog() != DialogResult.OK)
                    return new LensNextXmlExportOperationResult { Cancelled = true, Diagnostics = Array.Empty<LensNextXmlExportDiagnostic>() };
                try
                {
                    var result = LensNextXmlDocumentShellWriter.Write(dialog.FileName, int.Parse(projectId), records);
                    return new LensNextXmlExportOperationResult { Summary = result.Summary, Diagnostics = result.Diagnostics };
                }
                catch (InvalidDataException exception)
                {
                    return new LensNextXmlExportOperationResult
                    {
                        Summary = LensNextXmlExportFailure.SummaryFor(exception),
                        Diagnostics = Array.Empty<LensNextXmlExportDiagnostic>()
                    };
                }
            }
        }

        private static LensNextXmlExportInput ToExportInput(XmlExportWireRecord wire)
        {
            if (wire == null || wire.Package == null)
                throw new InvalidDataException("The BIMLog XML export collection contains a missing visual package.");
            DateTimeOffset capturedAt;
            return new LensNextXmlExportInput
            {
                ProjectId = wire.ProjectId,
                ServerId = wire.ServerId,
                ViewpointId = wire.ViewpointId,
                LifecycleStatus = wire.LifecycleStatus,
                RevisionNumber = wire.RevisionNumber,
                DisplayId = wire.DisplayId,
                Note = wire.Note,
                Priority = wire.Priority,
                CapturedAt = DateTimeOffset.TryParse(wire.CapturedAt, out capturedAt) ? capturedAt : (DateTimeOffset?)null,
                VisualStateDigest = wire.VisualStateDigest,
                PackageProjectId = wire.Package.ProjectId,
                PackageServerId = wire.Package.ServerId,
                PackageViewpointId = wire.Package.ViewpointId,
                PackageLifecycleStatus = wire.Package.LifecycleStatus,
                PackageRevisionNumber = wire.Package.RevisionNumber,
                PackageDigest = wire.Package.DigestSha256,
                PackageCamera = wire.Package.Camera,
                PackageSectioningJson = wire.Package.SectioningJson
            };
        }
    }
}
