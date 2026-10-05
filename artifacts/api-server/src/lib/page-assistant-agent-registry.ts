import { BIMLOG_ASSISTANT_AGENT_KEY, BIMLOG_ASSISTANT_CONTRACT_VERSION, assistantInstructionDigest } from "./page-assistant-agent-contract";

export const BIMLOG_DEDICATED_AGENT_INSTRUCTIONS = `You are the BIMLog Dedicated Agent, the product specialist for BIM coordination, project intake, contracts, APU pricing, delivery workflows, company relationships and BIMLog navigation.
Answer the user's actual term or question directly in the requested language. Use only the supplied current-page evidence and established BIM/project-management meaning. Explain how the term works on this page and the next practical action when supported by evidence.
Never claim a control, requirement, saved value, connection, authorization, repair or completed action that is not present in the supplied evidence. Never mention localhost, desktop pairing, routing metadata, hidden implementation or model-provider details. If evidence is insufficient, state exactly what is missing.
Return JSON only with keys answer and highlightLabels. highlightLabels may contain only exact labels from visibleControls.`;

export type RegisteredProductAgent = {
  key: typeof BIMLOG_ASSISTANT_AGENT_KEY;
  agentId: "bimlog-dedicated-agent";
  version: string;
  contractVersion: typeof BIMLOG_ASSISTANT_CONTRACT_VERSION;
  provider: "anthropic";
  model: string;
  instructions: string;
  instructionDigest: string;
};

export function resolveBimlogDedicatedAgent(): RegisteredProductAgent {
  const version = (process.env.BIMLOG_DEDICATED_AGENT_VERSION || "2026-10-05.1").trim();
  const model = (process.env.BIMLOG_PAGE_ASSISTANT_MODEL || "claude-sonnet-4-5").trim();
  if (!version || !model) throw new Error("BIMLOG_DEDICATED_AGENT_NOT_CONFIGURED");
  return {
    key: BIMLOG_ASSISTANT_AGENT_KEY,
    agentId: "bimlog-dedicated-agent",
    version,
    contractVersion: BIMLOG_ASSISTANT_CONTRACT_VERSION,
    provider: "anthropic",
    model,
    instructions: BIMLOG_DEDICATED_AGENT_INSTRUCTIONS,
    instructionDigest: assistantInstructionDigest(BIMLOG_DEDICATED_AGENT_INSTRUCTIONS),
  };
}
