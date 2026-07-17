import { afterEach, describe, expect, it, vi } from "vitest";
import { AnythingLLMProvider } from "./anythingllm.js";
import type { Message, StreamEvent, ToolDefinition } from "./types.js";

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

describe("AnythingLLMProvider", () => {
  it("posts the last user message with a tool hint and returns textResponse", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ textResponse: "hi from llm" }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new AnythingLLMProvider("http://llm:3002", "key123", "myslug");
    const events: StreamEvent[] = [];
    const messages: Message[] = [
      { role: "user", content: "first" },
      { role: "assistant", content: "reply" },
      { role: "user", content: "latest question" },
    ];

    const result = await provider.streamChat(messages, TOOLS, (e) => events.push(e));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://llm:3002/api/v1/workspace/myslug/chat");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer key123");
    const payload = JSON.parse(init.body as string);
    expect(payload.mode).toBe("chat");
    expect(payload.message).toContain("latest question");
    expect(payload.message).toContain("read_file: read it");

    expect(events.map((e) => e.type)).toEqual(["text_delta", "done"]);
    expect(result).toEqual({
      role: "assistant",
      content: [{ type: "text", text: "hi from llm" }],
    });
  });

  it("falls back to the 'response' field when textResponse is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ response: "fallback" }), { status: 200 })
      )
    );
    const provider = new AnythingLLMProvider("http://llm:3002", "k", "s");
    const result = await provider.streamChat(
      [{ role: "user", content: "q" }],
      [],
      () => {}
    );
    expect(result.content).toEqual([{ type: "text", text: "fallback" }]);
  });

  it("throws with status and body on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("bad slug", { status: 404 }))
    );
    const provider = new AnythingLLMProvider("http://llm:3002", "k", "s");
    await expect(
      provider.streamChat([{ role: "user", content: "q" }], [], () => {})
    ).rejects.toThrow(/AnythingLLM error: 404 bad slug/);
  });
});
