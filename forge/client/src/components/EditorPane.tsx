import Editor from "@monaco-editor/react";
import "./EditorPane.css";

interface Props {
  path: string | null;
  content: string;
  language: string;
  onChange: (value: string) => void;
  onSave: () => void;
}

export function EditorPane({ path, content, language, onChange, onSave }: Props) {
  if (!path) {
    return (
      <div className="editor-empty">
        <div className="editor-empty-inner">
          <h2>Forge</h2>
          <p>Self-hosted coding agent. Open a file or ask the agent to build something.</p>
          <p className="hint">Use ChatGPT, Claude, or local models — without their chat UI.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-pane">
      <div className="editor-tab">
        <span className="tab-path">{path}</span>
        <button className="save-btn" onClick={onSave}>
          Save
        </button>
      </div>
      <Editor
        height="100%"
        language={language}
        value={content}
        theme="vs-dark"
        onChange={(v) => onChange(v ?? "")}
        options={{
          fontFamily: "IBM Plex Mono, monospace",
          fontSize: 13,
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          wordWrap: "on",
          padding: { top: 12 },
        }}
      />
    </div>
  );
}
