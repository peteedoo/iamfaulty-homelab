import type {
  ContentBlock,
  Message,
  TextContent,
  ToolDefinition,
  ToolUseContent,
} from "./types.js";

/**
 * POST a JSON body and return a reader over the streaming response body.
 * Throws a labelled error if the response is not ok or has no body.
 */
export async function openStream(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  errorLabel: string
): Promise<ReadableStreamDefaultReader<Uint8Array>> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`${errorLabel} error: ${response.status} ${err}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");
  return reader;
}

/**
 * Yield newline-delimited chunks from a byte stream, buffering partial lines
 * across reads. The trailing (incomplete) line is held back until completed.
 */
export async function* streamLines(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) yield line;
  }
}

/**
 * Extract the JSON payload from an SSE `data:` line, or null if the line is
 * not a data line or is the `[DONE]` sentinel.
 */
export function parseSSEData(line: string): string | null {
  if (!line.startsWith("data: ")) return null;
  const data = line.slice(6).trim();
  if (data === "[DONE]") return null;
  return data;
}

/**
 * Build the final assistant message from streamed text and collected tool
 * calls, matching the shape every provider returns.
 */
export function assembleAssistantMessage(
  fullText: string,
  toolCalls: ToolUseContent[]
): Message {
  const content: ContentBlock[] = [];
  if (fullText) content.push({ type: "text", text: fullText });
  content.push(...toolCalls);
  return { role: "assistant", content: content.length ? content : "" };
}

/** Join the text of all text blocks with newlines. */
export function textFromBlocks(blocks: ContentBlock[]): string {
  return blocks
    .filter((b): b is TextContent => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

/** Collect all tool_use blocks. */
export function toolUsesFromBlocks(blocks: ContentBlock[]): ToolUseContent[] {
  return blocks.filter((b): b is ToolUseContent => b.type === "tool_use");
}

/** Map generic tool definitions to the OpenAI-style `function` tool schema. */
export function toOpenAIToolDefs(
  tools: ToolDefinition[]
): Array<Record<string, unknown>> {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));
}
