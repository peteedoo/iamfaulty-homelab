import type {
  LLMProvider,
  Message,
  StreamEvent,
  ToolDefinition,
  ToolUseContent,
} from "./types.js";
import {
  assembleAssistantMessage,
  openStream,
  streamLines,
  textFromBlocks,
  toOpenAIToolDefs,
  toolUsesFromBlocks,
} from "./stream-utils.js";

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
    const ollamaMessages = messages.map(toOllamaMessage);

    const reader = await openStream(
      `${this.baseUrl}/api/chat`,
      {},
      {
        model: this.model,
        messages: ollamaMessages,
        tools: toOpenAIToolDefs(tools),
        stream: true,
      },
      "Ollama"
    );

    let fullText = "";
    const toolCalls: ToolUseContent[] = [];

    for await (const line of streamLines(reader)) {
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

    onEvent({ type: "done" });

    return assembleAssistantMessage(fullText, toolCalls);
  }
}

function toOllamaMessage(msg: Message): Record<string, unknown> {
  if (typeof msg.content === "string") {
    return { role: msg.role, content: msg.content };
  }

  const textParts = textFromBlocks(msg.content);

  const toolCalls = toolUsesFromBlocks(msg.content).map((b) => ({
    function: { name: b.name, arguments: b.input },
  }));

  const toolResults = msg.content
    .filter((b) => b.type === "tool_result")
    .map((b) => ({
      role: "tool",
      content: (b as { content: string }).content,
    }));

  if (toolResults.length) return toolResults[0] as Record<string, unknown>;

  const result: Record<string, unknown> = {
    role: msg.role === "tool" ? "tool" : msg.role,
    content: textParts || "",
  };
  if (toolCalls.length) result.tool_calls = toolCalls;
  return result;
}
