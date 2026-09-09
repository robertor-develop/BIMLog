import { ConnectorValidationUnavailableError } from "./coordination-hub-configuration-service";
import type { ProtectedProviderProbeExecutor } from "./sharepoint-credential-validator";

const GRAPH_PROBE_URL = "https://graph.microsoft.com/v1.0/sites/root?$select=id";
const requestIdPattern = /^[A-Za-z0-9._:-]{1,256}$/;

export interface ProtectedBearerLeaseResolver {
  withBearerToken<T>(input: {
    credentialId: string;
    companyId: number;
    provider: "sharepoint";
  }, operation: (token: Uint8Array) => Promise<T>): Promise<T>;
}

export const unavailableProtectedBearerLeaseResolver: ProtectedBearerLeaseResolver = {
  async withBearerToken(): Promise<never> {
    throw new ConnectorValidationUnavailableError("A protected connector credential resolver is not configured");
  },
};

interface BoundedResponse {
  status: number;
  headers: { get(name: string): string | null };
  body: { cancel(): Promise<void> } | null;
}

export type ProtectedFetchTransport = (url: string, init: {
  method: "GET";
  redirect: "error";
  signal: AbortSignal;
  headers: { accept: "application/json"; authorization: string };
}) => Promise<BoundedResponse>;

function assertFixedRequest(input: Parameters<ProtectedProviderProbeExecutor["execute"]>[0]): void {
  if (!input.credentialId.trim() || !Number.isSafeInteger(input.companyId) || input.companyId <= 0 || input.provider !== "sharepoint") {
    throw new ConnectorValidationUnavailableError("Protected provider scope is invalid");
  }
  const request = input.request;
  if (request.method !== "GET" || request.url !== GRAPH_PROBE_URL || request.redirect !== "error" || request.timeoutMs !== 10_000 || request.maxResponseBytes !== 4_096 || request.accept !== "application/json") {
    throw new ConnectorValidationUnavailableError("Protected SharePoint request is outside the governed contract");
  }
}

function runtimeFetch(url: string, init: Parameters<ProtectedFetchTransport>[1]): Promise<BoundedResponse> {
  return fetch(url, init) as Promise<BoundedResponse>;
}

export class FixedGraphProtectedProviderProbeExecutor implements ProtectedProviderProbeExecutor {
  constructor(
    private readonly resolver: ProtectedBearerLeaseResolver,
    private readonly transport: ProtectedFetchTransport = runtimeFetch,
  ) {}

  async execute(input: Parameters<ProtectedProviderProbeExecutor["execute"]>[0]): Promise<{ status: number; providerRequestId?: string }> {
    assertFixedRequest(input);
    return this.resolver.withBearerToken({ credentialId: input.credentialId, companyId: input.companyId, provider: input.provider }, async (token) => {
      if (!(token instanceof Uint8Array) || token.byteLength < 16 || token.byteLength > 8_192) {
        if (token instanceof Uint8Array) token.fill(0);
        throw new ConnectorValidationUnavailableError("Protected SharePoint credential lease is invalid");
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), input.request.timeoutMs);
      let authorization: string | undefined;
      try {
        const tokenView = Buffer.from(token.buffer, token.byteOffset, token.byteLength);
        authorization = `Bearer ${tokenView.toString("utf8")}`;
        const response = await this.transport(input.request.url, {
          method: "GET",
          redirect: "error",
          signal: controller.signal,
          headers: { accept: "application/json", authorization },
        });
        if (!Number.isInteger(response.status) || response.status < 100 || response.status > 599 || !response.headers || typeof response.headers.get !== "function") {
          throw new ConnectorValidationUnavailableError("Protected SharePoint transport returned invalid metadata");
        }
        if (response.body) {
          try {
            await response.body.cancel();
          } catch {
            throw new ConnectorValidationUnavailableError("Protected SharePoint response could not be discarded safely");
          }
        }
        const rawRequestId = response.headers.get("request-id") ?? response.headers.get("x-ms-request-id");
        const providerRequestId = rawRequestId && requestIdPattern.test(rawRequestId) ? rawRequestId : undefined;
        return providerRequestId ? { status: response.status, providerRequestId } : { status: response.status };
      } catch (error) {
        if (error instanceof ConnectorValidationUnavailableError) throw error;
        throw new ConnectorValidationUnavailableError("Protected SharePoint request failed");
      } finally {
        clearTimeout(timeout);
        authorization = undefined;
        token.fill(0);
      }
    });
  }
}

export function createRuntimeProtectedProviderProbeExecutor(): ProtectedProviderProbeExecutor {
  return new FixedGraphProtectedProviderProbeExecutor(unavailableProtectedBearerLeaseResolver);
}
