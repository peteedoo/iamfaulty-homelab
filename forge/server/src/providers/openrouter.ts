import type { LLMProvider, Message, StreamEvent, ToolDefinition } from "./types.js";
import { streamOpenAIChat } from "./openai-compat.js";

export class OpenRouterProvider implements LLMProvider {
  constructor(
    private apiKey: string,
    private model: string
  ) {}

  async streamChat(
    messages: Message[],
    tools: ToolDefinition[],
    onEvent: (event: StreamEvent) => void
  ): Promise<Message> {
    return streamOpenAIChat(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        Authorization: `Bearer ${this.apiKey}`,
        "HTTP-Referer": "https://forge.local",
        "X-Title": "Forge Coding Agent",
      },
      this.model,
      messages,
      tools,
      onEvent,
      "OpenRouter"
    );
  }
}
