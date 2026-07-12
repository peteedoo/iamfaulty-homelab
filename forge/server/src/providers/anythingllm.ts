import type {
  ContentBlock,
  LLMProvider,
  Message,
  StreamEvent,
  ToolDefinition,
} from "./types.js";

/**
 * AnythingLLM provider — routes through your homelab AnythingLLM instance.
 * Uses the workspace chat API. Tool calling is simulated via prompt injection
 * since AnythingLLM's API doesn't expose native tool use.
 */
export class AnythingLLMProvider implements LLMProvider {
  constructor(
    private baseUrl: string,
    private apiKey: string,
    private workspaceSlug: string
  ) {}

  async streamChat(
    messages: Message[],
    tools: ToolDefinition[],
    onEvent: (event: StreamEvent) => void
  ): Promise<Message> {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const prompt =
      typeof lastUser?.content === "string"
        ? lastUser.content
        : JSON.stringify(lastUser?.content);

    const toolHint = tools.length
      ? `\n\nAvailable tools (respond with JSON block \`\`\`tool_call\`\`\` to use):\n${tools.map((t) => `- ${t.name}: ${t.description}`).join("\n")}`
      : "";

    const response = await fetch(
      `${this.baseUrl}/api/v1/workspace/${this.workspaceSlug}/chat`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          message: prompt + toolHint,
          mode: "chat",
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`AnythingLLM error: ${response.status} ${err}`);
    }

    const data = (await response.json()) as {
      textResponse?: string;
      response?: string;
    };

    const text = data.textResponse ?? data.response ?? "";
    onEvent({ type: "text_delta", text });
    onEvent({ type: "done" });

    const content: ContentBlock[] = [{ type: "text", text }];
    return { role: "assistant", content };
  }
}
