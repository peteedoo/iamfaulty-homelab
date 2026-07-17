import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { chatRouter } from "./chat.js";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/chat", chatRouter);
  return app;
}

function ollamaStream(content: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(`{"message":{"content":${JSON.stringify(content)}}}\n`)
      );
      controller.enqueue(encoder.encode('{"done":true}\n'));
      controller.close();
    },
  });
}

/** Parse an SSE response body into an array of { event, data } records. */
function parseSse(body: string): Array<{ event: string; data: unknown }> {
  return body
    .split("\n\n")
    .filter((block) => block.trim())
    .map((block) => {
      const event = block.match(/^event: (.*)$/m)?.[1] ?? "";
      const dataLine = block.match(/^data: (.*)$/m)?.[1] ?? "null";
      return { event, data: JSON.parse(dataLine) };
    });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/chat", () => {
  it("returns 400 when the message is empty", async () => {
    const res = await request(makeApp()).post("/api/chat").send({ message: "   " });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "message required" });
  });

  it("streams meta, agent and done events for a successful turn", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(ollamaStream("all done"), { status: 200 }))
    );

    const res = await request(makeApp())
      .post("/api/chat")
      .send({
        message: "hi",
        provider: { provider: "ollama", model: "qwen" },
      });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/event-stream/);
    const events = parseSse(res.text);
    const types = events.map((e) => e.event);
    expect(types[0]).toBe("meta");
    expect(types).toContain("agent");
    expect(types.at(-1)).toBe("done");

    const meta = events[0].data as Record<string, unknown>;
    expect(meta.provider).toBe("ollama");
    expect(meta.model).toBe("qwen");

    const done = events.at(-1)!.data as { messages: unknown[] };
    expect(Array.isArray(done.messages)).toBe(true);
  });

  it("emits an error event when the provider config is invalid", async () => {
    const res = await request(makeApp())
      .post("/api/chat")
      .send({
        message: "hi",
        provider: { provider: "openai", model: "gpt-4o" },
      });

    const events = parseSse(res.text);
    const errorEvent = events.find((e) => e.event === "error");
    expect(errorEvent).toBeDefined();
    expect((errorEvent!.data as { message: string }).message).toMatch(
      /OPENAI_API_KEY required/
    );
  });
});

describe("GET /api/chat/providers", () => {
  it("lists the supported providers with metadata", async () => {
    const res = await request(makeApp()).get("/api/chat/providers");
    expect(res.status).toBe(200);
    const ids = res.body.providers.map((p: { id: string }) => p.id);
    expect(ids).toEqual(["ollama", "openai", "anthropic", "openrouter", "anythingllm"]);
    const ollama = res.body.providers.find((p: { id: string }) => p.id === "ollama");
    expect(ollama.requiresKey).toBe(false);
    const openai = res.body.providers.find((p: { id: string }) => p.id === "openai");
    expect(openai.requiresKey).toBe(true);
  });
});
