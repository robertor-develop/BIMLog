using System;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace BIMLogLensNext
{
    public static class LensNextXmlExportGuidPolicy
    {
        // RFC 4122 URL namespace. The versioned BIMLog canonical name below
        // provides the product/export identity boundary.
        public static readonly Guid NamespaceId = new Guid("6ba7b811-9dad-11d1-80b4-00c04fd430c8");

        public static string CanonicalInput(LensNextXmlExportInput record)
        {
            if (record == null) throw new ArgumentNullException(nameof(record));
            var viewpointId = record.ViewpointId ?? string.Empty;
            return "bimlog:lens-next:xml-view-guid:v1" +
                   "|project=" + record.ProjectId.ToString(CultureInfo.InvariantCulture) +
                   "|server=" + record.ServerId.ToString(CultureInfo.InvariantCulture) +
                   "|viewpoint=" + Encoding.UTF8.GetByteCount(viewpointId).ToString(CultureInfo.InvariantCulture) + ":" + viewpointId +
                   "|revision=" + record.RevisionNumber.ToString(CultureInfo.InvariantCulture);
        }

        public static Guid ForRecord(LensNextXmlExportInput record) =>
            CreateVersion5(NamespaceId, CanonicalInput(record));

        public static Guid CreateVersion5(Guid namespaceId, string name)
        {
            if (name == null) throw new ArgumentNullException(nameof(name));
            var namespaceBytes = ToNetworkOrder(namespaceId.ToByteArray());
            var nameBytes = Encoding.UTF8.GetBytes(name);
            var input = new byte[namespaceBytes.Length + nameBytes.Length];
            Buffer.BlockCopy(namespaceBytes, 0, input, 0, namespaceBytes.Length);
            Buffer.BlockCopy(nameBytes, 0, input, namespaceBytes.Length, nameBytes.Length);

            byte[] hash;
            using (var sha1 = SHA1.Create()) hash = sha1.ComputeHash(input);
            var uuid = new byte[16];
            Buffer.BlockCopy(hash, 0, uuid, 0, uuid.Length);
            uuid[6] = (byte)((uuid[6] & 0x0f) | 0x50);
            uuid[8] = (byte)((uuid[8] & 0x3f) | 0x80);
            return new Guid(FromNetworkOrder(uuid));
        }

        private static byte[] ToNetworkOrder(byte[] value)
        {
            Swap(value, 0, 3); Swap(value, 1, 2); Swap(value, 4, 5); Swap(value, 6, 7);
            return value;
        }

        private static byte[] FromNetworkOrder(byte[] value) => ToNetworkOrder(value);

        private static void Swap(byte[] value, int left, int right)
        {
            var current = value[left]; value[left] = value[right]; value[right] = current;
        }
    }
}
