import { z } from "zod/v4";
import { providerPolicy } from "./provider-governance";

const inputSchema = z.object({
  provider: z.string().trim().min(1).max(128).regex(/^[a-z0-9_]+$/),
  configured: z.boolean(),
  approved: z.boolean(),
  credentialState: z.enum(["active", "expired", "revoked", "missing"]),
}).strict();

export type ConnectorMatrixStatus = {
  provider: string;
  supported: boolean;
  state: "available" | "setup_required" | "approval_required" | "credential_expired" | "credential_revoked" | "unsupported";
  customerMessage: string;
  retryable: boolean;
};

export function connectorMatrixStatus(input: unknown): ConnectorMatrixStatus {
  const value = inputSchema.parse(input);
  const policy = providerPolicy(value.provider);
  if (!policy) return { provider: value.provider, supported: false, state: "unsupported", customerMessage: "This connector is not supported.", retryable: false };
  if (!value.approved && policy.category === "governed") return { provider: value.provider, supported: true, state: "approval_required", customerMessage: "This connector requires an approved customer agreement.", retryable: false };
  if (!value.configured || value.credentialState === "missing") return { provider: value.provider, supported: true, state: "setup_required", customerMessage: "This connector must be configured before use.", retryable: false };
  if (value.credentialState === "expired") return { provider: value.provider, supported: true, state: "credential_expired", customerMessage: "The connector authorization expired. Reconnect it to continue.", retryable: false };
  if (value.credentialState === "revoked") return { provider: value.provider, supported: true, state: "credential_revoked", customerMessage: "The connector authorization was revoked. Reconnect it to continue.", retryable: false };
  return { provider: value.provider, supported: true, state: "available", customerMessage: "The connector is available.", retryable: true };
}

export function documentedConnectorMatrix(inputs: unknown[]): ConnectorMatrixStatus[] {
  return inputs.map(connectorMatrixStatus).sort((a, b) => a.provider.localeCompare(b.provider));
}
