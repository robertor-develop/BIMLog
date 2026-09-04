using System;
using System.IO;

namespace BIMLogLensNext
{
    public sealed class LensNextXmlProjection
    {
        private LensNextXmlProjection(string token)
        {
            Token = token;
        }

        public string Token { get; }

        public static LensNextXmlProjection FromValidatedCamera(LensNextCameraState camera)
        {
            if (camera == null)
                throw new InvalidDataException("The BIMLog camera required for XML projection is missing.");
            if (string.Equals(camera.Projection, "Perspective", StringComparison.Ordinal))
                return new LensNextXmlProjection("persp");
            if (string.Equals(camera.Projection, "Orthographic", StringComparison.Ordinal))
                return new LensNextXmlProjection("ortho");
            throw new InvalidDataException("The BIMLog camera projection is missing or unsupported for Navisworks XML export.");
        }
    }
}
