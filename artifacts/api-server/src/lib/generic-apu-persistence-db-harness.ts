export const GENERIC_APU_DISPOSABLE_DB = Object.freeze({
  hosts: ["127.0.0.1", "localhost"] as const,
  port: "55436",
  database: "bimlog_financial_build2",
});

export const GENERIC_APU_PERSISTENCE_COMMAND =
  "pnpm --filter @workspace/api-server exec tsx ./src/lib/generic-apu-persistence-db.behavior.ts";

export type PersistenceHarnessLaunch = {
  command: typeof GENERIC_APU_PERSISTENCE_COMMAND;
  cwd: "artifacts/api-server";
  environmentVariable: "PROD_DATABASE_URL";
  target: "postgresql://127.0.0.1:55436/bimlog_financial_build2" | "postgresql://localhost:55436/bimlog_financial_build2";
};

function reject(message: string): never {
  throw new Error(message);
}

export function prepareGenericApuPersistenceHarness(
  environment: Readonly<Record<string, string | undefined>>,
): PersistenceHarnessLaunch {
  const raw = environment.PROD_DATABASE_URL;
  if (!raw?.trim()) reject("APU_DB_HARNESS_CREDENTIAL_MISSING");

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    reject("APU_DB_HARNESS_URL_INVALID");
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    reject("APU_DB_HARNESS_PROTOCOL_REJECTED");
  }
  if (!(GENERIC_APU_DISPOSABLE_DB.hosts as readonly string[]).includes(url.hostname)) {
    reject("APU_DB_HARNESS_HOST_REJECTED");
  }
  if (url.port !== GENERIC_APU_DISPOSABLE_DB.port) {
    reject("APU_DB_HARNESS_PORT_REJECTED");
  }
  if (url.pathname !== `/${GENERIC_APU_DISPOSABLE_DB.database}`) {
    reject("APU_DB_HARNESS_DATABASE_REJECTED");
  }
  if (!url.username || !url.password) {
    reject("APU_DB_HARNESS_CREDENTIAL_MISSING");
  }
  if (url.search || url.hash) {
    reject("APU_DB_HARNESS_URL_OPTIONS_REJECTED");
  }

  const hostname = url.hostname as "127.0.0.1" | "localhost";
  return {
    command: GENERIC_APU_PERSISTENCE_COMMAND,
    cwd: "artifacts/api-server",
    environmentVariable: "PROD_DATABASE_URL",
    target: `postgresql://${hostname}:55436/bimlog_financial_build2`,
  };
}
