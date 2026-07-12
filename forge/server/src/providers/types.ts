export type Role = "user" | "assistant" | "system" | "tool";

export interface TextContent {
  type: "text";
  text: string;
}

export interface ToolUseContent {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContent {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export type ContentBlock = TextContent | ToolUseContent | ToolResultContent;

export interface Message {
  role: Role;
  content: string | ContentBlock[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, { type: string; description: string; items?: unknown }>;
    required: string[];
  };
}

export interface StreamEvent {
  type: "text_delta" | "tool_use" | "done" | "error";
  text?: string;
  tool_use?: ToolUseContent;
  error?: string;
}

export interface ProviderConfig {
  provider: "ollama" | "openai" | "anthropic" | "openrouter" | "anythingllm";
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface LLMProvider {
  streamChat(
    messages: Message[],
    tools: ToolDefinition[],
    onEvent: (event: StreamEvent) => void
  ): Promise<Message>;
}
