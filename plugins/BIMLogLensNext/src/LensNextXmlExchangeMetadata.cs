namespace BIMLogLensNext
{
    public sealed class LensNextXmlExchangeMetadata
    {
        public const string ProductFileName = "BIMLog";
        public const string ProductFilePath = "BIMLog";

        private LensNextXmlExchangeMetadata(string fileName, string filePath)
        {
            FileName = fileName;
            FilePath = filePath;
        }

        public string FileName { get; }
        public string FilePath { get; }

        public static LensNextXmlExchangeMetadata ProductControlled() =>
            new LensNextXmlExchangeMetadata(ProductFileName, ProductFilePath);
    }
}
