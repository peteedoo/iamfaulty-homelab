import type { Monaco } from "@monaco-editor/react";
import type { ThemeId } from "../themes";

interface MonacoThemeSpec {
  rules: Array<{ token: string; foreground: string; fontStyle?: string }>;
  colors: Record<string, string>;
}

const MONACO_THEMES: Record<ThemeId, MonacoThemeSpec> = {
  cursor: {
    rules: [
      { token: "comment", foreground: "6a9955" },
      { token: "string", foreground: "ce9178" },
      { token: "keyword", foreground: "569cd6" },
      { token: "number", foreground: "b5cea8" },
      { token: "type", foreground: "4ec9b0" },
      { token: "function", foreground: "dcdcaa" },
    ],
    colors: {
      "editor.background": "#1e1e1e",
      "editor.foreground": "#d4d4d4",
      "editor.lineHighlightBackground": "#2a2a2a",
      "editorLineNumber.foreground": "#858585",
      "editorCursor.foreground": "#aeafad",
    },
  },
  light: {
    rules: [
      { token: "comment", foreground: "008000" },
      { token: "string", foreground: "a31515" },
      { token: "keyword", foreground: "0000ff" },
      { token: "number", foreground: "098658" },
      { token: "type", foreground: "267f99" },
    ],
    colors: {
      "editor.background": "#ffffff",
      "editor.foreground": "#1e1e1e",
      "editor.lineHighlightBackground": "#f5f5f5",
    },
  },
  dracula: {
    rules: [
      { token: "comment", foreground: "6272a4" },
      { token: "string", foreground: "f1fa8c" },
      { token: "keyword", foreground: "ff79c6" },
      { token: "number", foreground: "bd93f9" },
      { token: "type", foreground: "8be9fd" },
      { token: "function", foreground: "50fa7b" },
    ],
    colors: {
      "editor.background": "#282a36",
      "editor.foreground": "#f8f8f2",
      "editor.lineHighlightBackground": "#313341",
      "editorCursor.foreground": "#f8f8f0",
    },
  },
  gruvbox: {
    rules: [
      { token: "comment", foreground: "928374", fontStyle: "italic" },
      { token: "string", foreground: "b8bb26" },
      { token: "keyword", foreground: "fb4934" },
      { token: "number", foreground: "d3869b" },
      { token: "type", foreground: "fabd2f" },
      { token: "function", foreground: "83a598" },
    ],
    colors: {
      "editor.background": "#282828",
      "editor.foreground": "#ebdbb2",
      "editor.lineHighlightBackground": "#32302f",
      "editorCursor.foreground": "#ebdbb2",
    },
  },
  oled: {
    rules: [
      { token: "comment", foreground: "525252" },
      { token: "string", foreground: "a3a3a3" },
      { token: "keyword", foreground: "f5f5f5" },
      { token: "number", foreground: "d4d4d4" },
      { token: "type", foreground: "e5e5e5" },
    ],
    colors: {
      "editor.background": "#000000",
      "editor.foreground": "#f5f5f5",
      "editor.lineHighlightBackground": "#141414",
      "editorCursor.foreground": "#ffffff",
    },
  },
};

export function defineForgeThemes(monaco: Monaco) {
  for (const [id, spec] of Object.entries(MONACO_THEMES)) {
    monaco.editor.defineTheme(`forge-${id}`, {
      base: id === "light" ? "vs" : "vs-dark",
      inherit: true,
      rules: spec.rules,
      colors: spec.colors,
    });
  }
}

export function monacoThemeFor(id: ThemeId): string {
  return `forge-${id}`;
}
