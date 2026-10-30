import { browseCloud } from "./cloud-files";
import { isProviderOperationAllowed } from "./provider-governance";

export type IntakeMcpActor = {
  userId: number;
  companyId: number;
  projectId: number;
};

type McpTool = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties: false;
  };
};

const projectIdSchema = {
  type: "integer",
  description: "The BIMLog project currently authorized for this request.",
};

export async function discoverProcoreIntakeTools(companyId: number): Promise<McpTool[]> {
  if (!isProviderOperationAllowed("procore", companyId, "browse")) return [];
  return [
    {
      name: "procore_browse",
      description:
        "Read the current user's authorized Procore companies, projects, folders, or files. Pass the opaque ref returned by a prior call; an empty ref lists companies. This is read-only and never imports.",
      input_schema: {
        type: "object",
        properties: {
          projectId: projectIdSchema,
          ref: { type: "string", description: "Opaque Procore company/project/folder reference; empty string lists companies." },
          query: { type: "string", description: "Optional provider search text." },
        },
        required: ["projectId", "ref"],
        additionalProperties: false,
      },
    },
    {
      name: "bimlog_propose_intake_plan",
      description:
        "Create a non-mutating proposal for exact selected Procore refs and their observed versions. Never claim that a preview is an import or agent handoff.",
      input_schema: {
        type: "object",
        properties: {
          projectId: projectIdSchema,
          sources: {
            type: "array",
            minItems: 1,
            maxItems: 100,
            items: {
              type: "object",
              properties: {
                ref: { type: "string" },
                name: { type: "string" },
                mimeType: { type: "string" },
              },
              required: ["ref", "name"],
              additionalProperties: false,
            },
          },
          goal: { type: "string", maxLength: 2000 },
          destination: { type: "string", maxLength: 200 },
        },
        required: ["projectId", "sources", "goal", "destination"],
        additionalProperties: false,
      },
    },
  ];
}

export async function callProcoreIntakeTool(
  actor: IntakeMcpActor,
  name: string,
  input: Record<string, unknown>,
) {
  if (Number(input.projectId) !== actor.projectId) throw new Error("INTAKE_PROJECT_SCOPE_MISMATCH");
  if (!isProviderOperationAllowed("procore", actor.companyId, "browse")) throw new Error("PROVIDER_NOT_APPROVED");

  if (name === "procore_browse") {
    const ref = typeof input.ref === "string" ? input.ref : "";
    const query = typeof input.query === "string" ? input.query.slice(0, 200) : "";
    const { items } = await browseCloud(actor.userId, "procore", ref, query);
    return {
      readOnly: true,
      canonicalMutation: false,
      items: items.slice(0, 100).map((item) => ({
        name: item.name,
        type: item.type,
        ref: item.ref,
        mimeType: item.mimeType ?? null,
        size: item.size ?? null,
      })),
      unsupported: [
        "Procore write-back and continuous synchronization are not available through this intake.",
        "The Procore file API response currently does not provide a pinned version selector in this browse capability.",
      ],
    };
  }

  if (name === "bimlog_propose_intake_plan") {
    if (!Array.isArray(input.sources) || input.sources.length < 1 || input.sources.length > 100) {
      throw new Error("INTAKE_SOURCE_SELECTION_INVALID");
    }
    const sources = input.sources.map((source) => {
      if (!source || typeof source !== "object") throw new Error("INTAKE_SOURCE_SELECTION_INVALID");
      const item = source as Record<string, unknown>;
      const ref = typeof item.ref === "string" ? item.ref.trim() : "";
      const name = typeof item.name === "string" ? item.name.trim() : "";
      if (!ref || !name) throw new Error("INTAKE_SOURCE_SELECTION_INVALID");
      return { ref, name, versionId: null, versionStatus: "not_exposed_by_current_procore_browse_api", mimeType: typeof item.mimeType === "string" ? item.mimeType : null };
    });
    return {
      state: "proposal_only",
      goal: typeof input.goal === "string" ? input.goal.slice(0, 2000) : "",
      destination: typeof input.destination === "string" ? input.destination.slice(0, 200) : "",
      projectId: actor.projectId,
      sources,
      confirmationRequired: true,
      canonicalMutation: false,
      importAvailable: false,
      versionLimitation: "The current Procore browse/download path does not expose a pinned version identifier; do not treat this proposal as version-exact.",
      nextAction:
        "Review the exact source list and destination. Import is not available in this MCP intake yet; use an existing governed BIMLog import workflow where supported.",
    };
  }

  throw new Error("MCP_TOOL_NOT_FOUND");
}

export function parseMcpToolArguments(value: unknown): Record<string, unknown> {
  if (typeof value !== "string") throw new Error("MCP_TOOL_ARGUMENTS_INVALID");
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("MCP_TOOL_ARGUMENTS_INVALID");
  }
  return parsed as Record<string, unknown>;
}
