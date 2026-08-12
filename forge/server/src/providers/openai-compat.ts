import type {
  ContentBlock,
  Message,
  StreamEvent,
  ToolDefinition,
  ToolUseContent,
} from "./types.js";

interface OpenAIToolCall {
  id: string;
  function: { name: string; arguments: string };
}

export function toOpenAIMessages(msg: Message): Record<string, unknown>[] {
  if (typeof msg.content === "string") {
    const role = msg.role === "tool" ? "tool" : msg.role;
    return [{ role, content: msg.content }];
  }

  const toolResults = msg.content.filter(
    (b): b is Extract<typeof b, { type: "tool_result" }> =>
      b.type === "tool_result"
  );
  if (toolResults.length) {
    // OpenAI requires one `tool` message per tool_call_id — never merge them.
    return toolResults.map((b) => ({
      role: "tool",
      tool_call_id: b.tool_use_id,
      content: b.content,
    }));
  }

  const text = msg.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const toolCalls = msg.content
    .filter((b): b is ToolUseContent => b.type === "tool_use")
    .map((b) => ({
      id: b.id,
      type: "function",
      function: { name: b.name, arguments: JSON.stringify(b.input) },
    }));

  const result: Record<string, unknown> = { role: msg.role, content: text || null };
  if (toolCalls.length) result.tool_calls = toolCalls;
  return [result];
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
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({
      model,
      messages: messages.flatMap(toOpenAIMessages),
      tools: tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      })),
      stream: true,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`${errorLabel} error: ${response.status} ${err}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let fullText = "";
  const toolCalls = new Map<number, OpenAIToolCall>();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") continue;

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

  const content: ContentBlock[] = [];
  if (fullText) content.push({ type: "text", text: fullText });
  content.push(...parsedTools);

  return { role: "assistant", content: content.length ? content : "" };
}
