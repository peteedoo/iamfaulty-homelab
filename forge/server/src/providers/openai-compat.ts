import type {
  Message,
  StreamEvent,
  ToolDefinition,
  ToolUseContent,
} from "./types.js";
import {
  assembleAssistantMessage,
  openStream,
  parseSSEData,
  streamLines,
  textFromBlocks,
  toOpenAIToolDefs,
  toolUsesFromBlocks,
} from "./stream-utils.js";

interface OpenAIToolCall {
  id: string;
  function: { name: string; arguments: string };
}

export function toOpenAIMessage(msg: Message): Record<string, unknown> {
  if (typeof msg.content === "string") {
    const role = msg.role === "tool" ? "tool" : msg.role;
    return { role, content: msg.content };
  }

  if (msg.content.some((b) => b.type === "tool_result")) {
    return {
      role: "tool",
      tool_call_id: msg.content.find((b) => b.type === "tool_result")?.tool_use_id,
      content: msg.content
        .filter((b) => b.type === "tool_result")
        .map((b) => (b as { content: string }).content)
        .join("\n"),
    };
  }

  const text = textFromBlocks(msg.content);

  const toolCalls = toolUsesFromBlocks(msg.content).map((b) => ({
    id: b.id,
    type: "function",
    function: { name: b.name, arguments: JSON.stringify(b.input) },
  }));

  const result: Record<string, unknown> = { role: msg.role, content: text || null };
  if (toolCalls.length) result.tool_calls = toolCalls;
  return result;
}

export async function streamOpenAIChat(
  url: string,
  headers: Record<string, string>,
  model: string,
  messages: Message[],
  tools: ToolDefinition[],
  onEvent: (event: StreamEvent) => void,
  errorLabel: string
): Promise<Message> {
  const reader = await openStream(
    url,
    headers,
    {
      model,
      messages: messages.map(toOpenAIMessage),
      tools: toOpenAIToolDefs(tools),
      stream: true,
    },
    errorLabel
  );

  let fullText = "";
  const toolCalls = new Map<number, OpenAIToolCall>();

  for await (const line of streamLines(reader)) {
    const data = parseSSEData(line);
    if (data === null) continue;

    const chunk = JSON.parse(data) as {
      choices?: Array<{
        delta?: {
          content?: string;
          tool_calls?: Array<{
            index: number;
            id?: string;
            function?: { name?: string; arguments?: string };
          }>;
        };
      }>;
    };

    const delta = chunk.choices?.[0]?.delta;
    if (!delta) continue;

    if (delta.content) {
      fullText += delta.content;
      onEvent({ type: "text_delta", text: delta.content });
    }

    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        const existing = toolCalls.get(tc.index) ?? {
          id: tc.id ?? `tc_${tc.index}`,
          function: { name: "", arguments: "" },
        };
        if (tc.id) existing.id = tc.id;
        if (tc.function?.name) existing.function.name = tc.function.name;
        if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
        toolCalls.set(tc.index, existing);
      }
    }
  }

  const parsedTools: ToolUseContent[] = [];
  for (const tc of toolCalls.values()) {
    let input: Record<string, unknown> = {};
    try {
      input = JSON.parse(tc.function.arguments || "{}");
    } catch {
      input = { raw: tc.function.arguments };
    }
    const toolUse: ToolUseContent = {
      type: "tool_use",
      id: tc.id,
      name: tc.function.name,
      input,
    };
    parsedTools.push(toolUse);
    onEvent({ type: "tool_use", tool_use: toolUse });
  }

  onEvent({ type: "done" });

  return assembleAssistantMessage(fullText, parsedTools);
}
