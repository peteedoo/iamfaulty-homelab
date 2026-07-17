import type {
  ContentBlock,
  LLMProvider,
  Message,
  StreamEvent,
  ToolDefinition,
  ToolUseContent,
} from "./types.js";

interface OllamaToolCall {
  function: { name: string; arguments: Record<string, unknown> };
}

export class OllamaProvider implements LLMProvider {
  constructor(
    private baseUrl: string,
    private model: string
  ) {}

  async streamChat(
    messages: Message[],
    tools: ToolDefinition[],
    onEvent: (event: StreamEvent) => void
  ): Promise<Message> {
    const ollamaMessages = messages.flatMap(toOllamaMessages);

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: ollamaMessages,
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
      throw new Error(`Ollama error: ${response.status} ${err}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let fullText = "";
    const toolCalls: ToolUseContent[] = [];
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        const chunk = JSON.parse(line) as {
          message?: {
            content?: string;
            tool_calls?: OllamaToolCall[];
          };
          done?: boolean;
        };

        if (chunk.message?.content) {
          fullText += chunk.message.content;
          onEvent({ type: "text_delta", text: chunk.message.content });
        }

        if (chunk.message?.tool_calls) {
          for (const tc of chunk.message.tool_calls) {
            const toolUse: ToolUseContent = {
              type: "tool_use",
              id: `ollama_${toolCalls.length}`,
              name: tc.function.name,
              input: tc.function.arguments,
            };
            toolCalls.push(toolUse);
            onEvent({ type: "tool_use", tool_use: toolUse });
          }
        }
      }
    }

    onEvent({ type: "done" });

    const content: ContentBlock[] = [];
    if (fullText) content.push({ type: "text", text: fullText });
    content.push(...toolCalls);

    return { role: "assistant", content: content.length ? content : "" };
  }
}

function toOllamaMessages(msg: Message): Record<string, unknown>[] {
  if (typeof msg.content === "string") {
    return [{ role: msg.role, content: msg.content }];
  }

  const textParts = msg.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const toolCalls = msg.content
    .filter((b): b is ToolUseContent => b.type === "tool_use")
    .map((b) => ({
      function: { name: b.name, arguments: b.input },
    }));

  const toolResults = msg.content
    .filter((b) => b.type === "tool_result")
    .map((b) => ({
      role: "tool",
      content: (b as { content: string }).content,
    }));

  // Emit one `tool` message per result rather than dropping all but the first.
  if (toolResults.length) return toolResults;

  const result: Record<string, unknown> = {
    role: msg.role === "tool" ? "tool" : msg.role,
    content: textParts || "",
  };
  if (toolCalls.length) result.tool_calls = toolCalls;
  return [result];
}
