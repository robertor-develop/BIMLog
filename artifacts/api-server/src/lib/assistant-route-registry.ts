export const BIMLOG_ASSISTANT_ROUTES = Object.freeze({
  conversation: { agentId: "bimlog-dedicated-agent", threadId: "01a10a95-a2e5-73d3-a471-6738addc7e42", contractVersion: "bimlog-page-assistant/v1" },
  feedback: { agentId: "ignitesmart-central-feedback-agent", threadId: "01a10d7d-ffa2-71e2-a085-ec1b954a3d4f", contractVersion: "feedback-case/v1" },
  repair: { agentId: "orion-main", threadId: "01a0eaec-81ed-7381-a9fc-74fb7e1d9c37", contractVersion: "bimlog-repair/v1" },
});

export function assertSeparateAssistantRoutes(){const ids=Object.values(BIMLOG_ASSISTANT_ROUTES).map(route=>route.threadId);if(new Set(ids).size!==ids.length)throw new Error("ASSISTANT_ROUTE_IDENTITY_COLLISION");return true;}
