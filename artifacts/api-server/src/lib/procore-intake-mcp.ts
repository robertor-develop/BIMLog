import { browseCloud, getProcoreFileVersions } from "./cloud-files";
import { isProviderOperationCurrentlyAllowed } from "./provider-governance";

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

export async function discoverProcoreIntakeTools(companyId: number, approved = isProviderOperationCurrentlyAllowed): Promise<McpTool[]> {
  if (!await approved("procore", companyId, "browse")) return [];
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
      name: "procore_file_versions",
      description: "List the exact versions currently available for one authorized Procore file.",
      input_schema: { type:"object",properties:{projectId:projectIdSchema,fileRef:{type:"string"},sourceCompanyId:{type:"string",pattern:"^[1-9][0-9]*$"}},required:["projectId","fileRef"],additionalProperties:false },
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
                versionId: { type: "string" },
                sourceCompanyId: { type:"string", pattern:"^[1-9][0-9]*$" },
                mimeType: { type: "string" },
              },
              required: ["ref", "name", "versionId"],
              additionalProperties: false,
            },
          },
          goal: { type: "string", maxLength: 2000 },
          needed: { type: "string", maxLength: 2000 },
          destination: { type: "string", maxLength: 200 },
        },
        required: ["projectId", "sources", "goal", "needed", "destination"],
        additionalProperties: false,
      },
    },
  ];
}

export async function callProcoreIntakeTool(
  actor: IntakeMcpActor,
  name: string,
  input: Record<string, unknown>,
  deps: {
    approved?: (provider:string,companyId:number|null,operation:"browse"|"catalog")=>Promise<boolean>;
    browse?: typeof browseCloud;
    versions?: typeof getProcoreFileVersions;
  } = {},
) {
  if (Number(input.projectId) !== actor.projectId) throw new Error("INTAKE_PROJECT_SCOPE_MISMATCH");
  if (!await (deps.approved ?? isProviderOperationCurrentlyAllowed)("procore", actor.companyId, "browse")) throw new Error("PROVIDER_NOT_APPROVED");

  if (name === "procore_browse") {
    const ref = typeof input.ref === "string" ? input.ref : "";
    const query = typeof input.query === "string" ? input.query.slice(0, 200) : "";
    const { items } = await (deps.browse ?? browseCloud)(actor.userId, "procore", ref, query);
    return {
      readOnly: true,
      canonicalMutation: false,
      items: items.slice(0, 100).map((item) => ({
        name: item.name,
        type: item.type,
        ref: item.ref,
        mimeType: item.mimeType ?? null,
        size: item.size ?? null,
        versions: item.versions ?? [],
      })),
      unsupported: [
        "Procore write-back and continuous synchronization are not available through this intake.",
      ],
    };
  }

  if (name === "procore_file_versions") {
    const fileRef=typeof input.fileRef==="string"?input.fileRef:"";
    const match=/^file:([^:]+):([^:]+)$/.exec(fileRef);
    if(!match)throw new Error("PROCORE_FILE_REF_INVALID");
    if(!match[2]||!match[1])throw new Error("PROCORE_FILE_REF_INVALID");
    const file=await (deps.versions ?? getProcoreFileVersions)(actor.userId,fileRef,typeof input.sourceCompanyId==="string"?input.sourceCompanyId:undefined);
    return {readOnly:true,canonicalMutation:false,fileRef,...file};
  }

  if (name === "bimlog_propose_intake_plan") {
    if(String(input.destination??"")!==String(actor.projectId))throw new Error("INTAKE_DESTINATION_SCOPE_MISMATCH");
    if (!Array.isArray(input.sources) || input.sources.length < 1 || input.sources.length > 100) {
      throw new Error("INTAKE_SOURCE_SELECTION_INVALID");
    }
    const sources = await Promise.all(input.sources.map(async (source) => {
      if (!source || typeof source !== "object") throw new Error("INTAKE_SOURCE_SELECTION_INVALID");
      const item = source as Record<string, unknown>;
      const ref = typeof item.ref === "string" ? item.ref.trim() : "";
      const name = typeof item.name === "string" ? item.name.trim() : "";
      const versionId=typeof item.versionId==="string"?item.versionId.trim():"";
      if (!ref || !name || !versionId) throw new Error("INTAKE_SOURCE_SELECTION_INVALID");
      const current=await (deps.versions ?? getProcoreFileVersions)(actor.userId,ref,typeof item.sourceCompanyId==="string"?item.sourceCompanyId:undefined);
      if(current.name!==name)throw new Error("PROCORE_SOURCE_CHANGED");
      const version=current.versions.find(v=>v.id===versionId);
      if(!version)throw new Error("PROCORE_VERSION_UNAVAILABLE");
      if(item.sourceCompanyId!==undefined&&(typeof item.sourceCompanyId!=="string"||!/^[1-9]\d*$/.test(item.sourceCompanyId)))throw new Error("INTAKE_SOURCE_SELECTION_INVALID");
      return { ...(typeof item.sourceCompanyId==="string"?{sourceCompanyId:item.sourceCompanyId}:{}), ref, fileId:current.fileId, projectRef:current.projectRef, name:current.name, versionId:version.id, versionLabel:version.label, versionStatus:"available", mimeType:current.mimeType };
    }));
    return {
      state: "proposal_only",
      goal: typeof input.goal === "string" ? input.goal.slice(0, 2000) : "",
      destination: typeof input.destination === "string" ? input.destination.slice(0, 200) : "",
      projectId: actor.projectId,
      sources,
      confirmationRequired: true,
      canonicalMutation: false,
      importAvailable: true,
      confirmationTransport:"explicit_document_review_ui",
      versionPinned: true,
      nextAction:
        "Review the exact source version, destination filename and relationship in the document import panel. Explicit user confirmation saves the document and its receipt; this proposal does not.",
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
