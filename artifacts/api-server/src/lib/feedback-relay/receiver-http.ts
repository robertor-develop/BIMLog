import type { IncomingMessage, ServerResponse } from "node:http";
import fs from "node:fs";
import { once } from "node:events";
import {
  RelayProtocolError,
  canonicalRequest,
  safeRelayError,
  type RequestContract,
  type Signed,
} from "./protocol.js";
import {
  FeedbackReceiverCustodyService,
  type ReceiverMediaKind,
  type ScannerInspection,
} from "./receiver-service.js";
export type ReceiverScanner = (
  stagedPath: string,
  context: { request: RequestContract },
) => Promise<ScannerInspection>;
const json = (res: ServerResponse, status: number, value: unknown) => {
  const body = Buffer.from(JSON.stringify(value));
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": String(body.length),
    "cache-control": "no-store",
  });
  res.end(body);
};
const status = (code: string) =>
  code.includes("REPLAY")
    ? 409
    : code.includes("CONFLICT")
      ? 409
      : code.includes("MISMATCH")
        ? 422
        : code.includes("SCANNER") || code.includes("MEDIA")
          ? 422
          : 400;
export function createReceiverHttpsHandler(input: {
  service: FeedbackReceiverCustodyService;
  scanner: ReceiverScanner;
  maxRequestBytes: number;
  now?: () => Date;
}) {
  if (!Number.isSafeInteger(input.maxRequestBytes) || input.maxRequestBytes < 1)
    throw new RelayProtocolError(
      "FEEDBACK_RECEIVER_REQUEST_LIMIT_INVALID",
      "Receiver request limit is invalid",
    );
  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (req.method !== "PUT")
        throw new RelayProtocolError(
          "FEEDBACK_RECEIVER_METHOD_DENIED",
          "Receiver method is not allowed",
        );
      const encoded = String(req.headers["x-bimlog-signed-request"] || "");
      if (!encoded || encoded.length > 16_384)
        throw new RelayProtocolError(
          "FEEDBACK_RECEIVER_SIGNED_REQUEST_REQUIRED",
          "Signed request envelope is required",
        );
      let signed: Signed<RequestContract>;
      try {
        signed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
      } catch {
        throw new RelayProtocolError(
          "FEEDBACK_RECEIVER_SIGNED_REQUEST_INVALID",
          "Signed request envelope is invalid",
        );
      }
      canonicalRequest(signed.payload);
      const url = new URL(req.url || "/", "https://receiver.invalid"),
        query = url.search.length ? url.search.slice(1) : "";
      if (
        signed.payload.method !== req.method ||
        signed.payload.path !== url.pathname ||
        signed.payload.query !== query
      )
        throw new RelayProtocolError(
          "FEEDBACK_RECEIVER_HTTP_BINDING_MISMATCH",
          "HTTP request differs from its signed contract",
        );
      // Authenticate the signed scope before accepting or scanning any body bytes.
      await input.service.authorizeHeader(signed, input.now?.());
      const length = Number(req.headers["content-length"]);
      if (
        !Number.isSafeInteger(length) ||
        length < 0 ||
        length > input.maxRequestBytes ||
        length !== signed.payload.byteCount
      )
        throw new RelayProtocolError(
          "FEEDBACK_RECEIVER_CONTENT_LENGTH_MISMATCH",
          "HTTP content length differs from signed bytes",
        );
      const stagedPath = input.service.createUploadStage();
      let total = 0;
      try {
        const output = fs.createWriteStream(stagedPath, {
          flags: "r+",
          mode: 0o600,
        });
        try {
          for await (const chunk of req) {
            const bytes = Buffer.from(chunk);
            total += bytes.length;
            if (total > length)
              throw new RelayProtocolError(
                "FEEDBACK_RECEIVER_CONTENT_LENGTH_MISMATCH",
                "HTTP body exceeded signed bytes",
              );
            if (!output.write(bytes)) await once(output, "drain");
          }
          output.end();
          await once(output, "close");
        } catch (error) {
          output.destroy();
          throw error;
        }
        if (total !== length)
          throw new RelayProtocolError(
            "FEEDBACK_RECEIVER_CONTENT_LENGTH_MISMATCH",
            "HTTP body was truncated",
          );
        const inspection = await input.scanner(stagedPath, {
          request: signed.payload,
        });
        const declaredType = String(req.headers["content-type"] || "").split(
            ";",
            1,
          )[0],
          declaredKind = String(
            req.headers["x-bimlog-media-kind"] || "",
          ) as ReceiverMediaKind;
        const receipt = await input.service.deliverStaged({
          signedRequest: signed,
          stagedPath,
          inspection,
          clientDeclared:
            declaredType && declaredKind
              ? { mediaType: declaredType, mediaKind: declaredKind }
              : undefined,
          now: input.now?.(),
        });
        json(res, 201, receipt);
      } catch (error) {
        await input.service.discardUploadStage(stagedPath);
        throw error;
      }
    } catch (error) {
      const safe = safeRelayError(error),
        code = String(safe.code);
      json(res, status(code), safe);
    }
  };
}
