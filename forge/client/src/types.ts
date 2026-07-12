export interface TreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: TreeNode[];
}

export interface ProviderInfo {
  id: string;
  name: string;
  defaultModel: string;
  models: string[];
  requiresKey: boolean;
}

export interface ToolEvent {
  type: "tool_start" | "tool_result";
  tool?: { name: string; input: Record<string, unknown> };
  result?: string;
  isError?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  tools?: ToolEvent[];
  streaming?: boolean;
}

export interface AgentEvent {
  type: string;
  text?: string;
  tool?: { name: string; input: Record<string, unknown> };
  result?: string;
  isError?: boolean;
  turn?: number;
}
