import { createServer, type RequestListener } from "node:http";
import { performance } from "node:perf_hooks";

export type StartupState = "starting" | "ready" | "failed";

interface StartupLogger {
  info(message: string): void;
  error(message: string): void;
}

interface ApplicationModule {
  default: RequestListener;
  startupBarrier?: Promise<void>;
  startWorkers?: () => void;
}

interface BootstrapOptions {
  initializationTimeoutMs?: number;
  logger?: StartupLogger;
}

const DEFAULT_INITIALIZATION_TIMEOUT_MS = 45_000;

const NOT_READY_BODY = {
  starting: JSON.stringify({
    status: "starting",
    service: "bimlog-api",
    ready: false,
  }),
  failed: JSON.stringify({ status: "failed" }),
} as const;

function sanitizedStartupError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("FEEDBACK_STORAGE_AUTHORITY_INVALID")) {
    return "FEEDBACK_STORAGE_AUTHORITY_INVALID";
  }
  if (message.includes("FEEDBACK_STORAGE_AUTHORITY_REQUIRED")) {
    return "FEEDBACK_STORAGE_AUTHORITY_REQUIRED";
  }
  return "APPLICATION_INITIALIZATION_FAILED";
}

export function createApplicationBootstrap(
  loadApplication: () => Promise<ApplicationModule>,
  options: BootstrapOptions = {},
) {
  const logger = options.logger ?? console;
  const initializationTimeoutMs =
    options.initializationTimeoutMs ?? DEFAULT_INITIALIZATION_TIMEOUT_MS;
  if (
    !Number.isFinite(initializationTimeoutMs) ||
    initializationTimeoutMs <= 0
  ) {
    throw new RangeError(
      "Application initialization timeout must be positive.",
    );
  }

  const createdAt = performance.now();
  const elapsed = () => Math.round(performance.now() - createdAt);
  let state: StartupState = "starting";
  let application: RequestListener | undefined;
  let applicationModule: ApplicationModule | undefined;
  let workersStarted = false;
  let initialization: Promise<void> | undefined;

  const server = createServer((request, response) => {
    if (state !== "ready" || !application) {
      const path = request.url?.split("?", 1)[0];
      if (state === "starting" && path === "/api") {
        // Replit's deployment promoter probes the artifact service path, /api,
        // as a liveness check while the application import is still running.
        // This response means only that the process is alive. The canonical
        // /api/v1/healthz endpoint remains 503 until the app is actually ready.
        response.statusCode = 200;
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.setHeader("Retry-After", "1");
        response.end(NOT_READY_BODY.starting);
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
        logger.info(`[startup] phase=app_import_begin elapsed_ms=${elapsed()}`);
        let timeout: NodeJS.Timeout | undefined;
        try {
          return await Promise.race([
            loadApplication().then(async (module) => {
              if (typeof module.default !== "function") {
                throw new TypeError(
                  "Application module did not provide a request handler.",
                );
              }
              await module.startupBarrier;
              return module;
            }),
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
            }),
          ]);
        } finally {
          if (timeout) clearTimeout(timeout);
        }
      })
      .then((module) => {
        logger.info(
          `[startup] phase=app_import_complete elapsed_ms=${elapsed()}`,
        );
        application = module.default;
        applicationModule = module;
        state = "ready";
        logger.info(`[startup] phase=ready_transition elapsed_ms=${elapsed()}`);
      })
      .catch((error: unknown) => {
        state = "failed";
        logger.error(
          `[startup] phase=app_import_failure elapsed_ms=${elapsed()} error=${sanitizedStartupError(error)}`,
        );
        throw error;
      });

    return initialization;
  };

  return {
    server,
    initialize,
    startWorkers: () => {
      if (state !== "ready" || workersStarted) return;
      workersStarted = true;
      applicationModule?.startWorkers?.();
    },
    getState: (): StartupState => state,
  };
}
