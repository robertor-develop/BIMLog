import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import type { NextFunction, Request, Response } from "express";

const SAFE_CORRELATION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

export type DiagnosticRecord = Readonly<{
  event: "http_request_complete";
  correlationId: string;
  method: string;
  path: string;
  status: number;
  elapsedMs: number;
}>;

export function resolveCorrelationId(value: unknown): string {
  return typeof value === "string" && SAFE_CORRELATION_ID.test(value) ? value : randomUUID();
}

export function safeDiagnosticPath(request: Pick<Request, "path">): string {
  const path = request.path || "/";
  return path.length <= 240 ? path : `${path.slice(0, 237)}...`;
}

export function requestDiagnostics(
  emit: (record: DiagnosticRecord) => void = (record) => console.log(JSON.stringify(record)),
) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const startedAt = performance.now();
    const correlationId = resolveCorrelationId(request.headers["x-correlation-id"]);
    response.setHeader("X-Correlation-Id", correlationId);
    response.once("finish", () => emit({
      event: "http_request_complete",
      correlationId,
      method: request.method,
      path: safeDiagnosticPath(request),
      status: response.statusCode,
      elapsedMs: Math.max(0, Math.round(performance.now() - startedAt)),
    }));
    next();
  };
}
