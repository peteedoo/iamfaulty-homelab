import { AnythingLLMProvider } from "./anythingllm.js";
import { AnthropicProvider } from "./anthropic.js";
import { OllamaProvider } from "./ollama.js";
import { OpenAIProvider } from "./openai.js";
import { OpenRouterProvider } from "./openrouter.js";
import type { LLMProvider, ProviderConfig } from "./types.js";

export function createProvider(config: ProviderConfig): LLMProvider {
  switch (config.provider) {
    case "ollama":
      return new OllamaProvider(
        config.baseUrl ?? "http://127.0.0.1:11434",
        config.model
      );
    case "openai":
      if (!config.apiKey) throw new Error("OPENAI_API_KEY required");
      return new OpenAIProvider(
        config.apiKey,
        config.model,
        config.baseUrl
      );
    case "anthropic":
      if (!config.apiKey) throw new Error("ANTHROPIC_API_KEY required");
      return new AnthropicProvider(config.apiKey, config.model);
    case "openrouter":
      if (!config.apiKey) throw new Error("OPENROUTER_API_KEY required");
      return new OpenRouterProvider(config.apiKey, config.model);
    case "anythingllm":
      if (!config.apiKey) throw new Error("ANYTHINGLLM_API_KEY required");
      return new AnythingLLMProvider(
        config.baseUrl ?? "http://127.0.0.1:3002",
        config.apiKey,
        config.model
      );
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

export * from "./types.js";
