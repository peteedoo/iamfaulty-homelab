import type {
  ContentBlock,
  LLMProvider,
  Message,
  StreamEvent,
  ToolDefinition,
  ToolUseContent,
} from "./types.js";

export class AnthropicProvider implements LLMProvider {
  constructor(
    private apiKey: string,
    private model: string
  ) {}

  async streamChat(
    messages: Message[],
    tools: ToolDefinition[],
    onEvent: (event: StreamEvent) => void
  ): Promise<Message> {
    const system = messages.find((m) => m.role === "system");
    const chatMessages = messages
      .filter((m) => m.role !== "system")
      .map(toAnthropicMessage);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 8192,
        system:
          typeof system?.content === "string"
            ? system.content
            : undefined,
        messages: chatMessages,
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.input_schema,
        })),
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic error: ${response.status} ${err}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let fullText = "";
    const toolCalls: ToolUseContent[] = [];
    let currentTool: Partial<ToolUseContent> | null = null;
    let toolJson = "";
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

        const event = JSON.parse(data) as {
          type: string;
          delta?: { type: string; text?: string; partial_json?: string };
          content_block?: { type: string; id?: string; name?: string };
        };

        if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
          const text = event.delta.text ?? "";
          fullText += text;
          onEvent({ type: "text_delta", text });
        }

        if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
          currentTool = {
            type: "tool_use",
            id: event.content_block.id,
            name: event.content_block.name,
            input: {},
          };
          toolJson = "";
        }

        if (event.type === "content_block_delta" && event.delta?.type === "input_json_delta") {
          toolJson += event.delta.partial_json ?? "";
        }

        if (event.type === "content_block_stop" && currentTool) {
          try {
            currentTool.input = JSON.parse(toolJson || "{}");
          } catch {
            // Preserve the raw arguments rather than silently dropping them,
            // so a malformed tool call is visible instead of running with {}.
            currentTool.input = { raw: toolJson };
          }
          const toolUse = currentTool as ToolUseContent;
          toolCalls.push(toolUse);
          onEvent({ type: "tool_use", tool_use: toolUse });
          currentTool = null;
          toolJson = "";
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

function toAnthropicMessage(msg: Message): Record<string, unknown> {
  if (typeof msg.content === "string") {
    return { role: msg.role === "tool" ? "user" : msg.role, content: msg.content };
  }

  if (msg.role === "tool" || msg.content.some((b) => b.type === "tool_result")) {
    return {
      role: "user",
      content: msg.content.map((b) => {
        if (b.type === "tool_result") {
          return {
            type: "tool_result",
            tool_use_id: b.tool_use_id,
            content: b.content,
            is_error: b.is_error,
          };
        }
        return { type: "text", text: (b as { text: string }).text ?? "" };
      }),
    };
  }

  return {
    role: msg.role,
    content: msg.content.map((b) => {
      if (b.type === "text") return { type: "text", text: b.text };
      if (b.type === "tool_use") {
        return { type: "tool_use", id: b.id, name: b.name, input: b.input };
      }
      return b;
    }),
  };
}
