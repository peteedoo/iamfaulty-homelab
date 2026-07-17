import { afterEach, describe, expect, it, vi } from "vitest";
import { AnthropicProvider } from "./anthropic.js";
import type { Message, StreamEvent, ToolDefinition } from "./types.js";

function sseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

const TOOLS: ToolDefinition[] = [
  {
    name: "read_file",
    description: "read it",
    input_schema: { type: "object", properties: {}, required: [] },
  },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AnthropicProvider.streamChat", () => {
  it("aggregates text_delta events into a text block", async () => {
    const body = sseStream([
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hel"}}\n',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"lo"}}\n',
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(body, { status: 200 }))
    );

    const provider = new AnthropicProvider("key", "claude-sonnet-4");
    const events: StreamEvent[] = [];
    const result = await provider.streamChat(
      [
        { role: "system", content: "be nice" },
        { role: "user", content: "hi" },
      ],
      TOOLS,
      (e) => events.push(e)
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

  it("assembles a tool_use from content_block start/delta/stop events", async () => {
    const body = sseStream([
      'data: {"type":"content_block_start","content_block":{"type":"tool_use","id":"tu_1","name":"read_file"}}\n',
      'data: {"type":"content_block_delta","delta":{"type":"input_json_delta","partial_json":"{\\"path\\":"}}\n',
      'data: {"type":"content_block_delta","delta":{"type":"input_json_delta","partial_json":"\\"a.ts\\"}"}}\n',
      'data: {"type":"content_block_stop"}\n',
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(body, { status: 200 }))
    );

    const provider = new AnthropicProvider("key", "claude-sonnet-4");
    const events: StreamEvent[] = [];
    const result = await provider.streamChat([], TOOLS, (e) => events.push(e));

    expect(events.find((e) => e.type === "tool_use")?.tool_use).toEqual({
      type: "tool_use",
      id: "tu_1",
      name: "read_file",
      input: { path: "a.ts" },
    });
    expect(result.content).toEqual([
      { type: "tool_use", id: "tu_1", name: "read_file", input: { path: "a.ts" } },
    ]);
  });

  it("sends system separately and maps tool_result messages to user role", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(sseStream([]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const messages: Message[] = [
      { role: "system", content: "sys prompt" },
      {
        role: "assistant",
        content: [
          { type: "text", text: "using tool" },
          { type: "tool_use", id: "t1", name: "read_file", input: { path: "x" } },
        ],
      },
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "t1", content: "body", is_error: false },
        ],
      },
    ];

    const provider = new AnthropicProvider("key", "claude-sonnet-4");
    await provider.streamChat(messages, TOOLS, () => {});

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(payload.system).toBe("sys prompt");
    // system message is filtered out of messages
    expect(payload.messages).toHaveLength(2);
    expect(payload.messages[0].role).toBe("assistant");
    expect(payload.messages[1]).toEqual({
      role: "user",
      content: [
        { type: "tool_result", tool_use_id: "t1", content: "body", is_error: false },
      ],
    });
  });

  it("throws on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 }))
    );
    const provider = new AnthropicProvider("key", "claude-sonnet-4");
    await expect(
      provider.streamChat([{ role: "user", content: "hi" }], [], () => {})
    ).rejects.toThrow(/Anthropic error: 401 unauthorized/);
  });
});
