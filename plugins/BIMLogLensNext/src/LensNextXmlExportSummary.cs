using System;
using System.IO;

namespace BIMLogLensNext
{
    [Serializable]
    public sealed class LensNextXmlExportSummary
    {
        internal LensNextXmlExportSummary(
            int? requestedCount,
            int? serializedCount,
            int? skippedCount,
            string outputPath,
            bool outputWritten,
            string validationResult,
            string exportResult,
            string failureDetail)
        {
            RequestedCount = requestedCount;
            SerializedCount = serializedCount;
            SkippedCount = skippedCount;
            OutputPath = outputPath;
            OutputWritten = outputWritten;
            XmlEncoding = "utf-8";
            XmlRoot = LensNextXmlDocumentShellWriter.RootElementName;
            ViewFolderName = LensNextXmlDocumentShellWriter.ViewFolderName;
            UnitsStatus = "NOT_EMITTED";
            SchemaStatus = "PROVEN";
            ValidationResult = validationResult;
            ExportResult = exportResult;
            FailureDetail = failureDetail;
        }

        public int? RequestedCount { get; }
        public int? SerializedCount { get; }
        public int? SkippedCount { get; }
        public string OutputPath { get; }
        public bool OutputWritten { get; }
        public string XmlEncoding { get; }
        public string XmlRoot { get; }
        public string ViewFolderName { get; }
        public string UnitsStatus { get; }
        public string SchemaStatus { get; }
        public string ValidationResult { get; }
        public string ExportResult { get; }
        public string FailureDetail { get; }

        internal static LensNextXmlExportSummary Passed(string outputPath, int requested, int serialized, int skipped)
        {
            if (requested != serialized + skipped)
                throw new InvalidDataException("The BIMLog XML export summary counts do not reconcile.");
            return new LensNextXmlExportSummary(requested, serialized, skipped, outputPath, true, "PASS",
                skipped == 0 ? "SUCCESS" : "PARTIAL_SUCCESS", null);
        }

        internal static LensNextXmlExportSummary Failed(string outputPath, int? requested, int? skipped, string detail)
        {
            return new LensNextXmlExportSummary(requested, 0, skipped, outputPath, false, "FAIL", "FAIL", detail);
        }
    }

    public static class LensNextXmlExportFailure
    {
        internal const string SummaryDataKey = "BIMLog.XmlExportSummary";

        public static LensNextXmlExportSummary SummaryFor(Exception exception)
        {
            if (exception == null) throw new ArgumentNullException(nameof(exception));
            return exception.Data[SummaryDataKey] as LensNextXmlExportSummary;
        }
    }
}
