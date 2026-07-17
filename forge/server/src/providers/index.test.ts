import { describe, expect, it } from "vitest";
import { createProvider } from "./index.js";
import { AnythingLLMProvider } from "./anythingllm.js";
import { AnthropicProvider } from "./anthropic.js";
import { OllamaProvider } from "./ollama.js";
import { OpenAIProvider } from "./openai.js";
import { OpenRouterProvider } from "./openrouter.js";

describe("createProvider", () => {
  it("creates an Ollama provider without an API key", () => {
    const p = createProvider({ provider: "ollama", model: "qwen2.5-coder:7b" });
    expect(p).toBeInstanceOf(OllamaProvider);
  });

  it("creates an OpenAI provider when a key is supplied", () => {
    const p = createProvider({ provider: "openai", model: "gpt-4o", apiKey: "k" });
    expect(p).toBeInstanceOf(OpenAIProvider);
  });

  it("creates an Anthropic provider when a key is supplied", () => {
    const p = createProvider({
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      apiKey: "k",
    });
    expect(p).toBeInstanceOf(AnthropicProvider);
  });

  it("creates an OpenRouter provider when a key is supplied", () => {
    const p = createProvider({
      provider: "openrouter",
      model: "anthropic/claude-sonnet-4",
      apiKey: "k",
    });
    expect(p).toBeInstanceOf(OpenRouterProvider);
  });

  it("creates an AnythingLLM provider when a key is supplied", () => {
    const p = createProvider({
      provider: "anythingllm",
      model: "default",
      apiKey: "k",
    });
    expect(p).toBeInstanceOf(AnythingLLMProvider);
  });

  it.each([
    ["openai", "OPENAI_API_KEY required"],
    ["anthropic", "ANTHROPIC_API_KEY required"],
    ["openrouter", "OPENROUTER_API_KEY required"],
    ["anythingllm", "ANYTHINGLLM_API_KEY required"],
  ] as const)("throws when %s is missing an API key", (provider, message) => {
    expect(() => createProvider({ provider, model: "m" })).toThrow(message);
  });

  it("throws for an unknown provider", () => {
    expect(() =>
      createProvider({
        // @ts-expect-error deliberately invalid provider for the error path
        provider: "mystery",
        model: "m",
      })
    ).toThrow(/Unknown provider: mystery/);
  });
});
