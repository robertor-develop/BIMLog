import { z } from "zod/v4";
import {
  ConnectorValidationUnavailableError,
  type ConnectorCredentialValidationPort,
} from "./coordination-hub-configuration-service";
import { isSharePointValidationAllowed } from "./provider-governance";
import { createRuntimeProtectedProviderProbeExecutor } from "./protected-provider-probe-executor";

const GRAPH_ORIGIN = "https://graph.microsoft.com";
const siteIdSchema = z.string().trim().min(1).max(1_024).regex(/^[^\x00-\x1f]+$/);

const protectedProbeResultSchema = z.object({
  status: z.number().int().min(100).max(599),
  providerRequestId: z.string().trim().min(1).max(256).regex(/^[A-Za-z0-9._:-]+$/).optional(),
}).strict();

export interface ProtectedProviderProbeExecutor {
  execute(input: {
    credentialId: string;
    companyId: number;
    provider: "sharepoint";
    request: {
      method: "GET";
      url: string;
      redirect: "error";
      timeoutMs: 10_000;
      maxResponseBytes: 4_096;
      accept: "application/json";
    };
  }): Promise<unknown>;
}

export interface SharePointCredentialValidatorConfiguration {
  enabled: boolean;
  providerApprovals: string;
  graphOrigin: string;
  executor: ProtectedProviderProbeExecutor;
  selectedSiteForProject: (projectId: number) => string | null;
}

function unavailable(): never {
  throw new ConnectorValidationUnavailableError("SharePoint credential validation is not enabled for this company");
}

export class SharePointCredentialValidator implements ConnectorCredentialValidationPort {
  constructor(private readonly configuration: SharePointCredentialValidatorConfiguration) {}

  async validate(input: Parameters<ConnectorCredentialValidationPort["validate"]>[0]): Promise<{ valid: boolean; evidenceCode: string }> {
    if (input.provider !== "sharepoint") unavailable();
    if (!this.configuration.enabled || !isSharePointValidationAllowed(input.companyId, this.configuration.providerApprovals)) unavailable();
    if (this.configuration.graphOrigin !== GRAPH_ORIGIN) throw new ConnectorValidationUnavailableError("SharePoint Graph origin is not governed");
    if (!/^[a-f0-9]{64}$/.test(input.configurationDigest)) throw new Error("Credential configuration digest is invalid");
    const selectedSiteId = this.configuration.selectedSiteForProject(input.projectId);
    if (!selectedSiteId || !siteIdSchema.safeParse(selectedSiteId).success) throw new ConnectorValidationUnavailableError("An authorized selected SharePoint site is required");

    let rawResult: unknown;
    try {
      rawResult = await this.configuration.executor.execute({
        credentialId: input.credentialId,
        companyId: input.companyId,
        provider: "sharepoint",
        request: {
          method: "GET",
          url: `${GRAPH_ORIGIN}/v1.0/sites/${encodeURIComponent(selectedSiteId)}?$select=id`,
          redirect: "error",
          timeoutMs: 10_000,
          maxResponseBytes: 4_096,
          accept: "application/json",
        },
      });
    } catch (error) {
      if (error instanceof ConnectorValidationUnavailableError) throw error;
      throw new ConnectorValidationUnavailableError("The protected SharePoint validation probe failed");
    }

    const parsed = protectedProbeResultSchema.safeParse(rawResult);
    if (!parsed.success) throw new Error("Protected SharePoint probe returned an invalid governed result");
    switch (parsed.data.status) {
      case 200: return { valid: true, evidenceCode: "SHAREPOINT_SELECTED_SITE_AUTHORIZED" };
      case 401: return { valid: false, evidenceCode: "SHAREPOINT_CREDENTIAL_REJECTED" };
      case 403: return { valid: false, evidenceCode: "SHAREPOINT_SCOPE_DENIED" };
      case 404: return { valid: false, evidenceCode: "SHAREPOINT_SELECTED_SITE_UNAVAILABLE" };
      case 408:
      case 425:
      case 429:
      case 500:
      case 502:
      case 503:
      case 504:
        throw new ConnectorValidationUnavailableError("Microsoft Graph is temporarily unavailable for credential validation");
      default:
        throw new ConnectorValidationUnavailableError("Microsoft Graph returned an unsupported validation status");
    }
  }
}

export function createRuntimeSharePointCredentialValidator(): ConnectorCredentialValidationPort {
  let selectedSites: Record<string, string> = {};
  try { selectedSites = z.record(z.string(), siteIdSchema).parse(JSON.parse(process.env.BIMLOG_SHAREPOINT_SELECTED_SITES ?? "{}")); } catch { selectedSites = {}; }
  return new SharePointCredentialValidator({
    enabled: process.env.BIMLOG_SHAREPOINT_VALIDATION_ENABLED === "true",
    providerApprovals: process.env.BIMLOG_PROVIDER_APPROVALS ?? "",
    graphOrigin: process.env.BIMLOG_SHAREPOINT_GRAPH_ORIGIN ?? GRAPH_ORIGIN,
    executor: createRuntimeProtectedProviderProbeExecutor(),
    selectedSiteForProject: projectId => selectedSites[String(projectId)] ?? null,
  });
}
