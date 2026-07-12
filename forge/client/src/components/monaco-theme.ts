import type { Monaco } from "@monaco-editor/react";

export function defineForgeTheme(monaco: Monaco) {
  monaco.editor.defineTheme("forge-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6e6a86", fontStyle: "italic" },
      { token: "string", foreground: "9ccfd8" },
      { token: "keyword", foreground: "c4a7e7" },
      { token: "number", foreground: "f6c177" },
      { token: "type", foreground: "ebbcba" },
      { token: "function", foreground: "9ccfd8" },
      { token: "variable", foreground: "e0def4" },
    ],
    colors: {
      "editor.background": "#1e1e2e",
      "editor.foreground": "#e0def4",
      "editor.lineHighlightBackground": "#2a273f",
      "editor.selectionBackground": "#44415a88",
      "editorLineNumber.foreground": "#6e6a86",
      "editorLineNumber.activeForeground": "#908caa",
      "editorCursor.foreground": "#9ccfd8",
      "editorIndentGuide.background": "#32304a",
      "editorIndentGuide.activeBackground": "#3e8fb0",
      "minimap.background": "#1e1e2e",
    },
  });
}
