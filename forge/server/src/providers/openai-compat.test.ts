import { afterEach, describe, expect, it, vi } from "vitest";
import type { Message, StreamEvent, ToolDefinition } from "./types.js";
import { streamOpenAIChat, toOpenAIMessage } from "./openai-compat.js";

describe("toOpenAIMessage", () => {
  it("passes through a plain string message", () => {
    const msg: Message = { role: "user", content: "hello" };
    expect(toOpenAIMessage(msg)).toEqual({ role: "user", content: "hello" });
  });

  it("maps a string 'tool' role to the tool role", () => {
    const msg: Message = { role: "tool", content: "result text" };
    expect(toOpenAIMessage(msg)).toEqual({ role: "tool", content: "result text" });
  });

  it("collapses tool_result blocks into a single tool message", () => {
    const msg: Message = {
      role: "user",
      content: [
        { type: "tool_result", tool_use_id: "call_1", content: "line one" },
        { type: "tool_result", tool_use_id: "call_2", content: "line two" },
      ],
    };
    expect(toOpenAIMessage(msg)).toEqual({
      role: "tool",
      tool_call_id: "call_1",
      content: "line one\nline two",
    });
  });

  it("serialises assistant text + tool_use blocks into tool_calls", () => {
    const msg: Message = {
      role: "assistant",
      content: [
        { type: "text", text: "let me read that" },
        {
          type: "tool_use",
          id: "call_9",
          name: "read_file",
          input: { path: "a.ts" },
        },
      ],
    };
    expect(toOpenAIMessage(msg)).toEqual({
      role: "assistant",
      content: "let me read that",
      tool_calls: [
        {
          id: "call_9",
          type: "function",
          function: { name: "read_file", arguments: JSON.stringify({ path: "a.ts" }) },
        },
      ],
    });
  });

  it("uses null content when an assistant message has only tool calls", () => {
    const msg: Message = {
      role: "assistant",
      content: [
        { type: "tool_use", id: "c1", name: "list_directory", input: {} },
      ],
    };
    const result = toOpenAIMessage(msg);
    expect(result.content).toBeNull();
    expect(result.tool_calls).toHaveLength(1);
  });
});

function sseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

const NO_TOOLS: ToolDefinition[] = [];

describe("streamOpenAIChat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("aggregates text deltas and emits text_delta + done events", async () => {
    const body = sseStream([
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n',
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n',
      "data: [DONE]\n",
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(body, { status: 200 }))
    );

    const events: StreamEvent[] = [];
    const result = await streamOpenAIChat(
      "http://x/chat",
      {},
      "gpt-4o",
      [{ role: "user", content: "hi" }],
      NO_TOOLS,
      (e) => events.push(e),
      "OpenAI"
    );

    expect(events.filter((e) => e.type === "text_delta").map((e) => e.text)).toEqual([
      "Hel",
      "lo",
    ]);
    expect(events.at(-1)?.type).toBe("done");
    expect(result).toEqual({
      role: "assistant",
      content: [{ type: "text", text: "Hello" }],
    });
  });

  it("assembles a tool call streamed across multiple chunks", async () => {
    const body = sseStream([
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"read_file","arguments":"{\\"pa"}}]}}]}\n',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"th\\":\\"a.ts\\"}"}}]}}]}\n',
      "data: [DONE]\n",
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(body, { status: 200 }))
    );

    const events: StreamEvent[] = [];
    const result = await streamOpenAIChat(
      "http://x/chat",
      {},
      "gpt-4o",
      [],
      NO_TOOLS,
      (e) => events.push(e),
      "OpenAI"
    );

    const toolEvent = events.find((e) => e.type === "tool_use");
    expect(toolEvent?.tool_use).toEqual({
      type: "tool_use",
      id: "call_1",
      name: "read_file",
      input: { path: "a.ts" },
    });
    expect(result.content).toEqual([
      { type: "tool_use", id: "call_1", name: "read_file", input: { path: "a.ts" } },
    ]);
  });

  it("falls back to raw arguments when tool JSON is invalid", async () => {
    const body = sseStream([
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"x","arguments":"not json"}}]}}]}\n',
      "data: [DONE]\n",
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(body, { status: 200 }))
    );

    const result = await streamOpenAIChat(
      "http://x/chat",
      {},
      "m",
      [],
      NO_TOOLS,
      () => {},
      "OpenAI"
    );
    expect(result.content).toEqual([
      { type: "tool_use", id: "c1", name: "x", input: { raw: "not json" } },
    ]);
  });

  it("returns an empty-string message when there is no content", async () => {
    const body = sseStream(["data: [DONE]\n"]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(body, { status: 200 }))
    );
    const result = await streamOpenAIChat(
      "http://x/chat",
      {},
      "m",
      [],
      NO_TOOLS,
      () => {},
      "OpenAI"
    );
    expect(result).toEqual({ role: "assistant", content: "" });
  });

  it("throws a labelled error on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 401 }))
    );
    await expect(
      streamOpenAIChat("http://x/chat", {}, "m", [], NO_TOOLS, () => {}, "OpenRouter")
    ).rejects.toThrow(/OpenRouter error: 401 nope/);
  });

  it("sends model, mapped messages and tool schema in the request body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(sseStream(["data: [DONE]\n"]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const tools: ToolDefinition[] = [
      {
        name: "read_file",
        description: "read it",
        input_schema: { type: "object", properties: {}, required: [] },
      },
    ];
    await streamOpenAIChat(
      "http://x/chat",
      { Authorization: "Bearer k" },
      "gpt-4o",
      [{ role: "user", content: "hi" }],
      tools,
      () => {},
      "OpenAI"
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://x/chat");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer k");
    const payload = JSON.parse(init.body as string);
    expect(payload.model).toBe("gpt-4o");
    expect(payload.stream).toBe(true);
    expect(payload.messages).toEqual([{ role: "user", content: "hi" }]);
    expect(payload.tools[0]).toEqual({
      type: "function",
      function: {
        name: "read_file",
        description: "read it",
        parameters: { type: "object", properties: {}, required: [] },
      },
    });
  });
});
