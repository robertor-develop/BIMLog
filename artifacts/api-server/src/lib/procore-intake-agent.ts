type McpTool = { name: string; [key: string]: unknown };
type ToolUse = { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };
type TextBlock = { type: "text"; text: string };
type ModelBlock = ToolUse | TextBlock | { type: string; [key: string]: unknown };
type ModelResponse = { content: ModelBlock[]; stop_reason: string | null };

export async function runDiscoveredMcpTurn(input: {
  tools: McpTool[];
  messages: any[];
  createMessage: (tools: McpTool[], messages: any[]) => Promise<ModelResponse>;
  executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}) {
  let response = await input.createMessage(input.tools, input.messages);
  const toolCalls: Array<{ name: string; result: unknown }> = [];
  for (let round = 0; round < 3 && response.stop_reason === "tool_use"; round++) {
    const uses = response.content.filter((part): part is ToolUse => part.type === "tool_use");
    if (!uses.length) break;
    input.messages.push({ role: "assistant", content: response.content });
    const results = [];
    for (const use of uses) {
      try {
        const result = await input.executeTool(use.name, use.input);
        toolCalls.push({ name: use.name, result });
        results.push({ type: "tool_result", tool_use_id: use.id, content: JSON.stringify(result) });
      } catch (error) {
        results.push({ type: "tool_result", tool_use_id: use.id, is_error: true, content: error instanceof Error ? error.message : "MCP_TOOL_FAILED" });
      }
    }
    input.messages.push({ role: "user", content: results });
    response = await input.createMessage(input.tools, input.messages);
  }
  return {
    answer: response.content.filter((part): part is TextBlock => part.type === "text").map((part) => part.text).join("\n").trim(),
    toolCalls,
  };
}
