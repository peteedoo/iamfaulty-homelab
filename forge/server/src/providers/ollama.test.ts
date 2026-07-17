import { afterEach, describe, expect, it, vi } from "vitest";
import { OllamaProvider } from "./ollama.js";
import type { Message, StreamEvent, ToolDefinition } from "./types.js";

function ndjsonStream(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(line));
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

describe("OllamaProvider.streamChat", () => {
  it("aggregates streamed content and emits events", async () => {
    const body = ndjsonStream([
      '{"message":{"content":"Hel"}}\n',
      '{"message":{"content":"lo"}}\n',
      '{"done":true}\n',
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(body, { status: 200 }))
    );

    const provider = new OllamaProvider("http://ollama:11434", "qwen");
    const events: StreamEvent[] = [];
    const result = await provider.streamChat(
      [{ role: "user", content: "hi" }],
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

  it("maps tool_calls into tool_use blocks with generated ids", async () => {
    const body = ndjsonStream([
      '{"message":{"tool_calls":[{"function":{"name":"read_file","arguments":{"path":"a.ts"}}}]}}\n',
      '{"done":true}\n',
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(body, { status: 200 }))
    );

    const provider = new OllamaProvider("http://ollama:11434", "qwen");
    const events: StreamEvent[] = [];
    const result = await provider.streamChat([], TOOLS, (e) => events.push(e));

    expect(events.find((e) => e.type === "tool_use")?.tool_use).toEqual({
      type: "tool_use",
      id: "ollama_0",
      name: "read_file",
      input: { path: "a.ts" },
    });
    expect(result.content).toEqual([
      { type: "tool_use", id: "ollama_0", name: "read_file", input: { path: "a.ts" } },
    ]);
  });

  it("sends mapped messages, including tool_use and tool_result conversions", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(ndjsonStream(['{"done":true}\n']), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const messages: Message[] = [
      { role: "system", content: "sys" },
      {
        role: "assistant",
        content: [
          { type: "text", text: "calling" },
          { type: "tool_use", id: "t1", name: "read_file", input: { path: "x" } },
        ],
      },
      {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "t1", content: "file body" }],
      },
    ];

    const provider = new OllamaProvider("http://ollama:11434", "qwen");
    await provider.streamChat(messages, TOOLS, () => {});

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(payload.messages[0]).toEqual({ role: "system", content: "sys" });
    expect(payload.messages[1]).toEqual({
      role: "assistant",
      content: "calling",
      tool_calls: [{ function: { name: "read_file", arguments: { path: "x" } } }],
    });
    expect(payload.messages[2]).toEqual({ role: "tool", content: "file body" });
  });

  it("throws on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("down", { status: 500 }))
    );
    const provider = new OllamaProvider("http://ollama:11434", "qwen");
    await expect(
      provider.streamChat([{ role: "user", content: "hi" }], [], () => {})
    ).rejects.toThrow(/Ollama error: 500 down/);
  });
});
