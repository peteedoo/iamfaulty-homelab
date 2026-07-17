import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAIProvider } from "./openai.js";
import { OpenRouterProvider } from "./openrouter.js";

function emptyStream(): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode("data: [DONE]\n"));
      controller.close();
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OpenAIProvider", () => {
  it("calls the default chat completions endpoint with a bearer token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(emptyStream(), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAIProvider("sk-test", "gpt-4o");
    await provider.streamChat([{ role: "user", content: "hi" }], [], () => {});

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
  });

  it("honours a custom base URL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(emptyStream(), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAIProvider("sk-test", "gpt-4o", "http://proxy/v1");
    await provider.streamChat([], [], () => {});
    expect(fetchMock.mock.calls[0][0]).toBe("http://proxy/v1/chat/completions");
  });
});

describe("OpenRouterProvider", () => {
  it("calls the OpenRouter endpoint with referer and title headers", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(emptyStream(), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenRouterProvider("or-key", "anthropic/claude-sonnet-4");
    await provider.streamChat([{ role: "user", content: "hi" }], [], () => {});

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer or-key");
    expect(headers["HTTP-Referer"]).toBe("https://forge.local");
    expect(headers["X-Title"]).toBe("Forge Coding Agent");
  });
});
