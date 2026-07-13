import { Router } from "express";
import { runAgentLoop } from "../agent/loop.js";
import { createProvider, type Message, type ProviderConfig } from "../providers/index.js";
import { getWorkspaceRoot, setWorkspaceRoot } from "../utils/paths.js";

export const chatRouter = Router();

interface ChatRequest {
  message: string;
  history?: Message[];
  provider?: ProviderConfig;
  workspace?: string;
}

chatRouter.post("/", async (req, res) => {
  const body = req.body as ChatRequest;

  if (!body.message?.trim()) {
    res.status(400).json({ error: "message required" });
    return;
  }

  if (body.workspace) {
    setWorkspaceRoot(body.workspace);
  }

  const providerConfig: ProviderConfig = body.provider ?? {
    provider: (process.env.FORGE_PROVIDER as ProviderConfig["provider"]) ?? "ollama",
    model: process.env.FORGE_MODEL ?? "qwen2.5-coder:7b",
    apiKey: process.env.FORGE_API_KEY,
    baseUrl: process.env.FORGE_BASE_URL,
  };

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const provider = createProvider(providerConfig);

    send("meta", {
      workspace: getWorkspaceRoot(),
      provider: providerConfig.provider,
      model: providerConfig.model,
    });

    const newMessages = await runAgentLoop(
      provider,
      body.message,
      body.history ?? [],
      (event) => send("agent", event)
    );

    send("done", { messages: newMessages });
  } catch (err) {
    send("error", { message: err instanceof Error ? err.message : String(err) });
  } finally {
    res.end();
  }
});

chatRouter.get("/providers", (_req, res) => {
  res.json({
    providers: [
      {
        id: "ollama",
        name: "Ollama (local)",
        defaultModel: "qwen2.5-coder:7b",
        models: [
          "qwen2.5-coder:7b",
          "qwen2.5-coder:14b",
          "deepseek-coder-v2:16b",
          "codellama:13b",
          "llama3.3:latest",
        ],
        requiresKey: false,
      },
      {
        id: "openai",
        name: "OpenAI (ChatGPT)",
        defaultModel: "gpt-4o",
        models: [
          "gpt-4o",
          "gpt-4o-mini",
          "gpt-4.1",
          "gpt-4.1-mini",
          "o3-mini",
        ],
        requiresKey: true,
      },
      {
        id: "anthropic",
        name: "Anthropic Claude",
        defaultModel: "claude-sonnet-4-20250514",
        models: [
          "claude-sonnet-4-20250514",
          "claude-3-5-haiku-20241022",
        ],
        requiresKey: true,
      },
      {
        id: "openrouter",
        name: "OpenRouter",
        defaultModel: "anthropic/claude-sonnet-4",
        models: [
          "anthropic/claude-sonnet-4",
          "google/gemini-2.5-pro-preview",
          "deepseek/deepseek-r1",
          "qwen/qwen3-coder",
        ],
        requiresKey: true,
      },
      {
        id: "anythingllm",
        name: "AnythingLLM (homelab)",
        defaultModel: "default",
        models: ["default"],
        requiresKey: true,
      },
    ],
  });
});
