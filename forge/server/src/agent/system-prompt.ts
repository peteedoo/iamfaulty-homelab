import fs from "node:fs";
import path from "node:path";

const DEFAULT_PROMPT = `You are Forge, a self-hosted coding agent — a Cursor-like assistant that helps users write, debug, and understand code.

You have access to tools that let you read files, write files, search the codebase, list directories, and run shell commands. Use them proactively to accomplish the user's goals.

Guidelines:
- Read relevant files before making changes
- Make minimal, focused edits — don't refactor unrelated code
- Explain what you're doing briefly, then use tools
- When editing files, write the complete new content
- Run tests or builds when appropriate to verify changes
- If a task is ambiguous, ask one clarifying question
- You are Forge, a coding agent with direct access to the user's workspace

The user's workspace root is the project directory. All file paths are relative to that root.`;

function loadSystemPrompt(): string {
  // 1. Direct env var
  if (process.env.FORGE_SYSTEM_PROMPT) {
    return process.env.FORGE_SYSTEM_PROMPT;
  }
  // 2. File path via env var
  if (process.env.FORGE_SYSTEM_PROMPT_FILE) {
    try {
      return fs.readFileSync(process.env.FORGE_SYSTEM_PROMPT_FILE, "utf-8");
    } catch {
      // fall through
    }
  }
  // 3. Default: look for a system-prompt.md in the workspace root
  const workspace = process.env.FORGE_WORKSPACE;
  if (workspace) {
    const candidate = path.join(workspace, "system-prompt.md");
    try {
      if (fs.existsSync(candidate)) {
        return fs.readFileSync(candidate, "utf-8");
      }
    } catch {
      // fall through
    }
  }
  return DEFAULT_PROMPT;
}

export const SYSTEM_PROMPT = loadSystemPrompt();
