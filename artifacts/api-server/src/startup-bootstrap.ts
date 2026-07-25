import { createServer, type RequestListener } from "node:http";

export type StartupState = "starting" | "ready" | "failed";

interface StartupLogger {
  info(message: string): void;
  error(message: string, error: unknown): void;
}

interface ApplicationModule {
  default: RequestListener;
}

const NOT_READY_BODY = {
  starting: JSON.stringify({ status: "starting" }),
  failed: JSON.stringify({ status: "failed" }),
} as const;

export function createApplicationBootstrap(
  loadApplication: () => Promise<ApplicationModule>,
  logger: StartupLogger = console,
) {
  let state: StartupState = "starting";
  let application: RequestListener | undefined;
  let initialization: Promise<void> | undefined;

  const server = createServer((request, response) => {
    if (state !== "ready" || !application) {
      response.statusCode = 503;
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(NOT_READY_BODY[state === "failed" ? "failed" : "starting"]);
      return;
    }

    application(request, response);
  });

  const initialize = (): Promise<void> => {
    initialization ??= loadApplication()
      .then((module) => {
        if (typeof module.default !== "function") {
          throw new TypeError(
            "Application module did not provide a request handler.",
          );
        }

        application = module.default;
        state = "ready";
        logger.info("Application initialization completed; readiness enabled.");
      })
      .catch((error: unknown) => {
        state = "failed";
        logger.error("Application initialization failed; readiness disabled.", error);
      });

    return initialization;
  };

  return {
    server,
    initialize,
    getState: (): StartupState => state,
  };
}
