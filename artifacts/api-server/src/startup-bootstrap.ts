import { createServer, type RequestListener } from "node:http";
import { performance } from "node:perf_hooks";

export type StartupState = "starting" | "ready" | "failed";

interface StartupLogger {
  info(message: string): void;
  error(message: string, error: unknown): void;
}

interface ApplicationModule {
  default: RequestListener;
}

interface BootstrapOptions {
  initializationTimeoutMs?: number;
  logger?: StartupLogger;
}

const DEFAULT_INITIALIZATION_TIMEOUT_MS = 45_000;

const NOT_READY_BODY = {
  starting: JSON.stringify({ status: "starting" }),
  failed: JSON.stringify({ status: "failed" }),
} as const;

export function createApplicationBootstrap(
  loadApplication: () => Promise<ApplicationModule>,
  options: BootstrapOptions = {},
) {
  const logger = options.logger ?? console;
  const initializationTimeoutMs =
    options.initializationTimeoutMs ?? DEFAULT_INITIALIZATION_TIMEOUT_MS;
  if (!Number.isFinite(initializationTimeoutMs) || initializationTimeoutMs <= 0) {
    throw new RangeError("Application initialization timeout must be positive.");
  }

  const createdAt = performance.now();
  const elapsed = () => Math.round(performance.now() - createdAt);
  let state: StartupState = "starting";
  let application: RequestListener | undefined;
  let initialization: Promise<void> | undefined;

  const server = createServer((request, response) => {
    if (state !== "ready" || !application) {
      const path = request.url?.split("?", 1)[0];
      if (state === "starting" && path === "/api") {
        response.statusCode = 404;
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("Content-Type", "text/plain; charset=utf-8");
        response.end("Cannot GET /api\n");
        return;
      }

      response.statusCode = 503;
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(NOT_READY_BODY[state === "failed" ? "failed" : "starting"]);
      return;
    }

    application(request, response);
  });

  const initialize = (): Promise<void> => {
    initialization ??= Promise.resolve()
      .then(async () => {
        logger.info(
          `[startup] phase=app_import_begin elapsed_ms=${elapsed()}`,
        );
        let timeout: NodeJS.Timeout | undefined;
        try {
          return await Promise.race([
            loadApplication(),
            new Promise<never>((_resolve, reject) => {
              timeout = setTimeout(
                () =>
                  reject(
                    new Error(
                      `Application import exceeded ${initializationTimeoutMs}ms.`,
                    ),
                  ),
                initializationTimeoutMs,
              );
              timeout.unref?.();
            }),
          ]);
        } finally {
          if (timeout) clearTimeout(timeout);
        }
      })
      .then((module) => {
        if (typeof module.default !== "function") {
          throw new TypeError(
            "Application module did not provide a request handler.",
          );
        }

        logger.info(
          `[startup] phase=app_import_complete elapsed_ms=${elapsed()}`,
        );
        application = module.default;
        state = "ready";
        logger.info(
          `[startup] phase=ready_transition elapsed_ms=${elapsed()}`,
        );
      })
      .catch((error: unknown) => {
        state = "failed";
        logger.error(
          `[startup] phase=app_import_failure elapsed_ms=${elapsed()}`,
          error,
        );
      });

    return initialization;
  };

  return {
    server,
    initialize,
    getState: (): StartupState => state,
  };
}
