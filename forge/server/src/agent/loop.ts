import type {
  ContentBlock,
  LLMProvider,
  Message,
  StreamEvent,
  ToolUseContent,
} from "../providers/types.js";
import { toolUsesFromBlocks } from "../providers/stream-utils.js";
import { SYSTEM_PROMPT } from "./system-prompt.js";
import { TOOL_DEFINITIONS, executeTool } from "./tools.js";

export interface AgentEvent {
  type:
    | "text_delta"
    | "tool_start"
    | "tool_result"
    | "turn_complete"
    | "error"
    | "thinking";
  text?: string;
  tool?: { name: string; input: Record<string, unknown> };
  result?: string;
  isError?: boolean;
  turn?: number;
}

const MAX_TURNS = 25;

export async function runAgentLoop(
  provider: LLMProvider,
  userMessage: string,
  history: Message[],
  onEvent: (event: AgentEvent) => void
): Promise<Message[]> {
  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: userMessage },
  ];

  const newMessages: Message[] = [{ role: "user", content: userMessage }];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    onEvent({ type: "thinking", turn: turn + 1 });

    let assistantText = "";
    const toolUses: ToolUseContent[] = [];

    const assistantMsg = await provider.streamChat(
      messages,
      TOOL_DEFINITIONS,
      (event: StreamEvent) => {
        if (event.type === "text_delta" && event.text) {
          assistantText += event.text;
          onEvent({ type: "text_delta", text: event.text });
        }
        if (event.type === "tool_use" && event.tool_use) {
          toolUses.push(event.tool_use);
        }
      }
    );

    messages.push(assistantMsg);
    newMessages.push(assistantMsg);

    const blocks =
      typeof assistantMsg.content === "string"
        ? []
        : (assistantMsg.content as ContentBlock[]);
    const pendingTools = toolUsesFromBlocks(blocks);

    if (pendingTools.length === 0 && !assistantText.includes("```")) {
      onEvent({ type: "turn_complete" });
      return newMessages;
    }

    const toolsToRun = pendingTools.length ? pendingTools : toolUses;
    if (toolsToRun.length === 0) {
      onEvent({ type: "turn_complete" });
      return newMessages;
    }

    const toolResults: ContentBlock[] = [];

    for (const tool of toolsToRun) {
      onEvent({
        type: "tool_start",
        tool: { name: tool.name, input: tool.input },
      });

      const { output, isError } = await executeTool(tool.name, tool.input);

      onEvent({
        type: "tool_result",
        tool: { name: tool.name, input: tool.input },
        result: output,
        isError,
      });

      toolResults.push({
        type: "tool_result",
        tool_use_id: tool.id,
        content: output,
        is_error: isError,
      });
    }

    const toolResultMsg: Message = { role: "user", content: toolResults };
    messages.push(toolResultMsg);
    newMessages.push(toolResultMsg);
  }

  onEvent({ type: "error", text: "Max agent turns reached" });
  return newMessages;
}
