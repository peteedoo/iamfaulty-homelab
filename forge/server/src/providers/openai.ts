import type { LLMProvider, Message, StreamEvent, ToolDefinition } from "./types.js";
import { streamOpenAIChat } from "./openai-compat.js";

export class OpenAIProvider implements LLMProvider {
  constructor(
    private apiKey: string,
    private model: string,
    private baseUrl = "https://api.openai.com/v1"
  ) {}

  async streamChat(
    messages: Message[],
    tools: ToolDefinition[],
    onEvent: (event: StreamEvent) => void
  ): Promise<Message> {
    return streamOpenAIChat(
      `${this.baseUrl}/chat/completions`,
      { Authorization: `Bearer ${this.apiKey}` },
      this.model,
      messages,
      tools,
      onEvent,
      "OpenAI"
    );
  }
}
