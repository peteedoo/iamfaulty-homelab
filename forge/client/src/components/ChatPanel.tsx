import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { ChatMessage, ProviderInfo } from "../types";
import "./ChatPanel.css";

interface Props {
  messages: ChatMessage[];
  isStreaming: boolean;
  providers: ProviderInfo[];
  provider: string;
  model: string;
  apiKey: string;
  onProviderChange: (p: string) => void;
  onModelChange: (m: string) => void;
  onApiKeyChange: (k: string) => void;
  onSend: (text: string) => void;
  onStop: () => void;
  onClear: () => void;
}

export function ChatPanel({
  messages,
  isStreaming,
  providers,
  provider,
  model,
  apiKey,
  onProviderChange,
  onModelChange,
  onApiKeyChange,
  onSend,
  onStop,
  onClear,
}: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const currentProvider = providers.find((p) => p.id === provider);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSend(input);
    setInput("");
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <span className="chat-title">Agent</span>
        <div className="chat-controls">
          <select
            value={provider}
            onChange={(e) => onProviderChange(e.target.value)}
            className="provider-select"
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="model-select"
          >
            {(currentProvider?.models ?? [model]).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <button className="icon-btn" onClick={onClear} title="Clear chat">
            ✕
          </button>
        </div>
      </div>

      {currentProvider?.requiresKey && (
        <div className="api-key-row">
          <input
            type="password"
            placeholder="API key"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            className="api-key-input"
          />
        </div>
      )}

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-welcome">
            <p>Ask me to read, edit, or build code in your workspace.</p>
            <div className="suggestions">
              {[
                "List the project structure",
                "Explain what this repo does",
                "Add a new feature",
                "Fix the bug in...",
              ].map((s) => (
                <button key={s} onClick={() => onSend(s)} className="suggestion">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <div className="message-role">
              {msg.role === "user" ? "You" : "Forge"}
              {msg.streaming && <span className="streaming-dot" />}
            </div>
            <div className="message-body">
              {msg.role === "assistant" ? (
                <ReactMarkdown>{msg.content || (msg.streaming ? "…" : "")}</ReactMarkdown>
              ) : (
                <p>{msg.content}</p>
              )}
              {msg.tools?.map((tool, i) => (
                <div
                  key={i}
                  className={`tool-card ${tool.isError ? "error" : ""}`}
                >
                  {tool.type === "tool_start" && (
                    <span className="tool-label">⚙ {tool.tool?.name}</span>
                  )}
                  {tool.type === "tool_result" && (
                    <>
                      <span className="tool-label">
                        {tool.isError ? "✗" : "✓"} {tool.tool?.name}
                      </span>
                      <pre className="tool-output">
                        {(tool.result ?? "").slice(0, 800)}
                        {(tool.result?.length ?? 0) > 800 ? "…" : ""}
                      </pre>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form className="chat-input" onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Forge to code..."
          rows={3}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        {isStreaming ? (
          <button type="button" className="send-btn stop" onClick={onStop}>
            Stop
          </button>
        ) : (
          <button type="submit" className="send-btn" disabled={!input.trim()}>
            Send
          </button>
        )}
      </form>
    </div>
  );
}
