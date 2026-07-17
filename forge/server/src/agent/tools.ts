import { exec } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { glob } from "glob";
import type { ToolDefinition } from "../providers/types.js";
import {
  resolveWorkspacePath,
  getWorkspaceRoot,
  writeWorkspaceFile,
} from "../utils/paths.js";

const execAsync = promisify(exec);

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "read_file",
    description: "Read the contents of a file in the workspace",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path from workspace root" },
        offset: { type: "number", description: "Line number to start reading from (1-indexed)" },
        limit: { type: "number", description: "Maximum number of lines to read" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write or overwrite a file in the workspace",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path from workspace root" },
        content: { type: "string", description: "Full file content to write" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "search_files",
    description: "Search for a regex pattern across files in the workspace",
    input_schema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Regex pattern to search for" },
        glob: { type: "string", description: "Glob filter, e.g. **/*.ts" },
      },
      required: ["pattern"],
    },
  },
  {
    name: "list_directory",
    description: "List files and directories at a path",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative directory path (default: root)" },
      },
      required: [],
    },
  },
  {
    name: "run_command",
    description: "Run a shell command in the workspace directory. Use for builds, tests, git, etc.",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command to execute" },
      },
      required: ["command"],
    },
  },
];

export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ output: string; isError: boolean }> {
  try {
    switch (name) {
      case "read_file":
        return { output: await readFile(input), isError: false };
      case "write_file":
        return { output: await writeFile(input), isError: false };
      case "search_files":
        return { output: await searchFiles(input), isError: false };
      case "list_directory":
        return { output: await listDirectory(input), isError: false };
      case "run_command":
        return await runCommand(input);
      default:
        return { output: `Unknown tool: ${name}`, isError: true };
    }
  } catch (err) {
    return {
      output: err instanceof Error ? err.message : String(err),
      isError: true,
    };
  }
}

async function readFile(input: Record<string, unknown>): Promise<string> {
  const filePath = resolveWorkspacePath(String(input.path));
  const content = await fs.readFile(filePath, "utf-8");
  const lines = content.split("\n");
  const offset = Number(input.offset ?? 1);
  const limit = Number(input.limit ?? 500);
  const slice = lines.slice(offset - 1, offset - 1 + limit);
  return slice.map((line, i) => `${offset + i}|${line}`).join("\n");
}

async function writeFile(input: Record<string, unknown>): Promise<string> {
  const bytes = await writeWorkspaceFile(
    String(input.path),
    String(input.content)
  );
  return `Wrote ${input.path} (${bytes} bytes)`;
}

async function searchFiles(input: Record<string, unknown>): Promise<string> {
  const root = getWorkspaceRoot();
  const pattern = String(input.pattern);
  const globPattern = String(input.glob ?? "**/*");
  const regex = new RegExp(pattern, "gi");

  const files = await glob(globPattern, {
    cwd: root,
    nodir: true,
    ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**"],
    absolute: false,
  });

  const results: string[] = [];
  for (const file of files.slice(0, 200)) {
    const content = await fs.readFile(path.join(root, file), "utf-8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        results.push(`${file}:${i + 1}: ${lines[i].trim()}`);
        regex.lastIndex = 0;
      }
      if (results.length >= 50) break;
    }
    if (results.length >= 50) break;
  }

  return results.length ? results.join("\n") : "No matches found";
}

async function listDirectory(input: Record<string, unknown>): Promise<string> {
  const dirPath = resolveWorkspacePath(String(input.path ?? "."));
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((e) => `${e.isDirectory() ? "d" : "f"} ${e.name}`)
    .join("\n");
}

async function runCommand(
  input: Record<string, unknown>
): Promise<{ output: string; isError: boolean }> {
  const command = String(input.command);
  const blocked = ["rm -rf /", "mkfs", "dd if=", ":(){", "fork bomb"];
  if (blocked.some((b) => command.includes(b))) {
    return { output: "Command blocked for safety", isError: true };
  }

  const { stdout, stderr } = await execAsync(command, {
    cwd: getWorkspaceRoot(),
    timeout: 60_000,
    maxBuffer: 1024 * 1024,
    shell: "/bin/bash",
  });

  const output = [stdout, stderr].filter(Boolean).join("\n").trim();
  return { output: output || "(no output)", isError: false };
}
