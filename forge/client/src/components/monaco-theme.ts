import type { Monaco } from "@monaco-editor/react";

export function defineForgeTheme(monaco: Monaco) {
  monaco.editor.defineTheme("forge-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6e5f8a", fontStyle: "italic" },
      { token: "string", foreground: "00f5d4" },
      { token: "keyword", foreground: "ff3cac" },
      { token: "number", foreground: "ffe566" },
      { token: "type", foreground: "b967ff" },
      { token: "function", foreground: "89b4fa" },
      { token: "variable", foreground: "f4eeff" },
      { token: "constant", foreground: "ff9ecd" },
    ],
    colors: {
      "editor.background": "#0a0612",
      "editor.foreground": "#f4eeff",
      "editor.lineHighlightBackground": "#1a1230",
      "editor.selectionBackground": "#4a2d7a88",
      "editor.inactiveSelectionBackground": "#3d2d6655",
      "editorLineNumber.foreground": "#5c4a82",
      "editorLineNumber.activeForeground": "#b967ff",
      "editorCursor.foreground": "#ff3cac",
      "editorWhitespace.foreground": "#2a1f45",
      "editorIndentGuide.background": "#2a1f45",
      "editorIndentGuide.activeBackground": "#b967ff",
      "minimap.background": "#0a0612",
    },
  });
}
