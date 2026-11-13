export type ProcoreEnvironment = "sandbox" | "production";

export interface ProcoreEndpointSet {
  environment: ProcoreEnvironment;
  loginBaseUrl: string;
  apiBaseUrl: string;
}

const ENDPOINTS: Record<ProcoreEnvironment, ProcoreEndpointSet> = {
  sandbox: {
    environment: "sandbox",
    loginBaseUrl: "https://login-sandbox.procore.com",
    apiBaseUrl: "https://sandbox.procore.com",
  },
  production: {
    environment: "production",
    loginBaseUrl: "https://login.procore.com",
    apiBaseUrl: "https://api.procore.com",
  },
};

export function parseProcoreEnvironment(value = process.env.PROCORE_ENVIRONMENT): ProcoreEnvironment | null {
  return value === "sandbox" || value === "production" ? value : null;
}

export function procoreEndpointSet(value = process.env.PROCORE_ENVIRONMENT): ProcoreEndpointSet {
  const environment = parseProcoreEnvironment(value);
  if (!environment) throw new Error("PROCORE_ENVIRONMENT_NOT_CONFIGURED");
  return ENDPOINTS[environment];
}

export function procoreConfigurationIssue(env: NodeJS.ProcessEnv = process.env): string | null {
  if (!parseProcoreEnvironment(env.PROCORE_ENVIRONMENT)) return "PROCORE_ENVIRONMENT_NOT_CONFIGURED";
  if (!env.PROCORE_CLIENT_ID || !env.PROCORE_CLIENT_SECRET) return "PROCORE_CREDENTIALS_NOT_CONFIGURED";
  return null;
}

export function procoreApiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${procoreEndpointSet().apiBaseUrl}${normalized}`;
}
