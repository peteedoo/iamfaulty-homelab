import type { Monaco } from "@monaco-editor/react";

export function defineForgeTheme(monaco: Monaco) {
  monaco.editor.defineTheme("forge-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6a6a6a", fontStyle: "italic" },
      { token: "string", foreground: "c9a87c" },
      { token: "keyword", foreground: "e8a87c" },
      { token: "number", foreground: "d4a574" },
      { token: "type", foreground: "ececec" },
      { token: "function", foreground: "e8c9a8" },
    ],
    colors: {
      "editor.background": "#111111",
      "editor.foreground": "#ececec",
      "editor.lineHighlightBackground": "#1a1a1a",
      "editor.selectionBackground": "#3a3028",
      "editor.inactiveSelectionBackground": "#2a2420",
      "editorLineNumber.foreground": "#555555",
      "editorLineNumber.activeForeground": "#9a9a9a",
      "editorCursor.foreground": "#e8a87c",
      "editorWhitespace.foreground": "#2a2a2a",
      "editorIndentGuide.background": "#2a2a2a",
      "editorIndentGuide.activeBackground": "#444444",
      "minimap.background": "#111111",
    },
  });
}
