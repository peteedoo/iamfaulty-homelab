import Editor from "@monaco-editor/react";
import { defineForgeTheme } from "./monaco-theme";
import "./EditorPane.css";

interface Props {
  path: string | null;
  content: string;
  language: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export function EditorPane({ path, content, language, onChange, onSave, onClose }: Props) {
  if (!path) return null;

  return (
    <div className="editor-pane">
      <div className="editor-tab">
        <span className="tab-path">{path}</span>
        <div className="editor-tab-actions">
          <button className="save-btn" onClick={onSave}>
            Save
          </button>
          <button className="close-btn" onClick={onClose} title="Close file">
            ✕
          </button>
        </div>
      </div>
      <Editor
        height="100%"
        language={language}
        value={content}
        theme="forge-dark"
        beforeMount={defineForgeTheme}
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
