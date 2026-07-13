import { useCallback, useRef, useState } from "react";
import type { AgentEvent, ChatMessage, ProviderInfo } from "../types";

interface UseChatOptions {
  provider: string;
  model: string;
  apiKey: string;
  onFileChange?: (detail?: { tool?: string; path?: string }) => void;
}

export function useChat({ provider, model, apiKey, onFileChange }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const loadProviders = useCallback(async (): Promise<ProviderInfo[]> => {
    const res = await fetch("/api/chat/providers");
    const data = await res.json();
    const list: ProviderInfo[] = data.providers ?? [];
    setProviders(list);
    return list;
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
      };

      const assistantId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: assistantId, role: "assistant", content: "", tools: [], streaming: true },
      ]);
      setIsStreaming(true);

      abortRef.current = new AbortController();

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortRef.current.signal,
          body: JSON.stringify({
            message: text,
            history: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            provider: {
              provider,
              model,
              apiKey: apiKey || undefined,
            },
          }),
        });

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No stream");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const lines = part.split("\n");
            let eventType = "";
            let data = "";

            for (const line of lines) {
              if (line.startsWith("event: ")) eventType = line.slice(7);
              if (line.startsWith("data: ")) data = line.slice(6);
            }

            if (!data) continue;
            const parsed = JSON.parse(data);

            if (eventType === "agent") {
              const event = parsed as AgentEvent;
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== assistantId) return m;

                  const tools = [...(m.tools ?? [])];

                  if (event.type === "text_delta" && event.text) {
                    return { ...m, content: m.content + event.text };
                  }

                  if (event.type === "tool_start" && event.tool) {
                    tools.push({ type: "tool_start", tool: event.tool });
                  }

                  if (event.type === "tool_result") {
                    tools.push({
                      type: "tool_result",
                      tool: event.tool,
                      result: event.result,
                      isError: event.isError,
                    });
                    const toolName = event.tool?.name;
                    const filePath =
                      typeof event.tool?.input?.path === "string"
                        ? event.tool.input.path
                        : undefined;
                    if (toolName === "write_file" || toolName === "run_command") {
                      onFileChange?.({ tool: toolName, path: filePath });
                    }
                  }

                  return { ...m, tools };
                })
              );
            }
          }
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, streaming: false } : m
          )
        );
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: `Error: ${(err as Error).message}`,
                    streaming: false,
                  }
                : m
            )
          );
        }
      } finally {
        setIsStreaming(false);
      }
    },
    [isStreaming, messages, provider, model, apiKey, onFileChange]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const clear = useCallback(() => setMessages([]), []);

  return {
    messages,
    isStreaming,
    providers,
    loadProviders,
    sendMessage,
    stop,
    clear,
  };
}
