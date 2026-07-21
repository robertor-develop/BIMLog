import type { NextFunction, Request, RequestHandler, Response } from "express";
import multer from "multer";

const KIB = 1024;

export const MULTIPART_LIMITS = {
  fieldNestingDepth: 0,
  fieldNameSize: 64,
  headerPairs: 32,
  defaultFieldSize: 64 * KIB,
} as const;

export type MultipartProfile = {
  fileSize: number;
  files?: number;
  fields?: number;
  parts?: number;
  fieldSize?: number;
};

/**
 * All BIMLog multipart uploads are memory-backed. Counts and sizes are explicit
 * so a route cannot inherit Multer/Busboy's unbounded defaults.
 */
export function createMemoryUpload(profile: MultipartProfile) {
  const files = profile.files ?? 1;
  const fields = profile.fields ?? 0;
  const parts = profile.parts ?? files + fields;
  const limits: NonNullable<multer.Options["limits"]> & { fieldNestingDepth: number } = {
    // Multer 2.2.0 supports this option; @types/multer 2.1.0 has not yet added it.
    fieldNestingDepth: MULTIPART_LIMITS.fieldNestingDepth,
    fieldNameSize: MULTIPART_LIMITS.fieldNameSize,
    headerPairs: MULTIPART_LIMITS.headerPairs,
    fields,
    files,
    // Busboy's parts limit event also fires at the configured count.
    parts: parts + 1,
    // Multer/Busboy emits a limit event when the byte count reaches the
    // configured value; add one byte so the declared BIMLog maximum passes.
    fileSize: profile.fileSize + 1,
    // Busboy marks a text field truncated when its byte count reaches the
    // configured value, so add one byte to keep the BIMLog limit inclusive.
    fieldSize: (profile.fieldSize ?? MULTIPART_LIMITS.defaultFieldSize) + 1,
  };
  return multer({
    storage: multer.memoryStorage(),
    limits,
  });
}

type MultipartClientError = {
  status: number;
  code: string;
  en: string;
  es: string;
};

function clientError(error: unknown): MultipartClientError {
  if (error instanceof multer.MulterError) {
    const status = error.code === "LIMIT_FILE_SIZE" || error.code === "LIMIT_FIELD_VALUE" ? 413 : 400;
    const byCode: Partial<Record<string, Omit<MultipartClientError, "status">>> = {
      LIMIT_FILE_SIZE: {
        code: "MULTIPART_FILE_TOO_LARGE",
        en: "The uploaded file exceeds the allowed size.",
        es: "El archivo cargado supera el tamaño permitido.",
      },
      LIMIT_FIELD_VALUE: {
        code: "MULTIPART_FIELD_TOO_LARGE",
        en: "A form field exceeds the allowed size.",
        es: "Un campo del formulario supera el tamaño permitido.",
      },
      LIMIT_FIELD_NESTING: {
        code: "MULTIPART_FIELD_NESTING_REJECTED",
        en: "Nested form field names are not accepted.",
        es: "No se aceptan nombres de campos de formulario anidados.",
      },
      LIMIT_FIELD_COUNT: {
        code: "MULTIPART_TOO_MANY_FIELDS",
        en: "The request contains too many form fields.",
        es: "La solicitud contiene demasiados campos de formulario.",
      },
      LIMIT_FILE_COUNT: {
        code: "MULTIPART_TOO_MANY_FILES",
        en: "The request contains too many files.",
        es: "La solicitud contiene demasiados archivos.",
      },
      LIMIT_PART_COUNT: {
        code: "MULTIPART_TOO_MANY_PARTS",
        en: "The multipart request contains too many parts.",
        es: "La solicitud multipart contiene demasiadas partes.",
      },
      LIMIT_FIELD_KEY: {
        code: "MULTIPART_FIELD_NAME_TOO_LARGE",
        en: "A form field name exceeds the allowed size.",
        es: "El nombre de un campo supera el tamaño permitido.",
      },
      LIMIT_UNEXPECTED_FILE: {
        code: "MULTIPART_UNEXPECTED_FILE",
        en: "The request contains an unexpected file field.",
        es: "La solicitud contiene un campo de archivo inesperado.",
      },
    };
    return {
      status,
      ...(byCode[error.code] ?? {
        code: "MULTIPART_INVALID",
        en: "The multipart upload is invalid.",
        es: "La carga multipart no es válida.",
      }),
    };
  }
  return {
    status: 400,
    code: "MULTIPART_MALFORMED",
    en: "The multipart upload could not be processed.",
    es: "No se pudo procesar la carga multipart.",
  };
}

/**
 * Converts parser, nesting, limit, truncation, and client-abort failures into a
 * bounded response without leaking parser messages or internal details.
 */
export function boundedMultipart(parser: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    parser(req, res, (error?: unknown) => {
      if (!error) {
        const uploadedFiles = [
          ...(req.file ? [req.file] : []),
          ...(Array.isArray(req.files)
            ? req.files
            : Object.values(req.files ?? {}).flat()),
        ];
        if (uploadedFiles.some(file => file.size === 0)) {
          res.status(400).json({
            code: "MULTIPART_EMPTY_FILE",
            error: {
              en: "Zero-byte files are not accepted.",
              es: "No se aceptan archivos de cero bytes.",
            },
          });
          return;
        }
        if (Object.values(req.body ?? {}).some(value => Array.isArray(value))) {
          res.status(400).json({
            code: "MULTIPART_DUPLICATE_FIELD",
            error: {
              en: "Duplicate form fields are not accepted.",
              es: "No se aceptan campos de formulario duplicados.",
            },
          });
          return;
        }
        next();
        return;
      }
      if (res.headersSent || req.destroyed) return;
      const mapped = clientError(error);
      res.status(mapped.status).json({
        code: mapped.code,
        error: { en: mapped.en, es: mapped.es },
      });
    });
  };
}

export function singleFileUpload(profile: MultipartProfile, fieldName = "file"): RequestHandler {
  return boundedMultipart(createMemoryUpload(profile).single(fieldName));
}
