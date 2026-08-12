import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { executeTool, TOOL_DEFINITIONS } from "../tools.js";
import { setWorkspaceRoot } from "../../utils/paths.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-tools-"));
  setWorkspaceRoot(tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("TOOL_DEFINITIONS", () => {
  it("defines all expected tools", () => {
    const names = TOOL_DEFINITIONS.map((t) => t.name);
    expect(names).toContain("read_file");
    expect(names).toContain("write_file");
    expect(names).toContain("search_files");
    expect(names).toContain("list_directory");
    expect(names).toContain("run_command");
  });

  it("each tool has required fields", () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.input_schema).toBeDefined();
      expect(tool.input_schema.type).toBe("object");
    }
  });
});

describe("executeTool — read_file", () => {
  it("reads a file and returns numbered lines", async () => {
    fs.writeFileSync(path.join(tmpDir, "test.txt"), "line1\nline2\nline3");
    const result = await executeTool("read_file", { path: "test.txt" });
    expect(result.isError).toBe(false);
    expect(result.output).toContain("1|line1");
    expect(result.output).toContain("2|line2");
    expect(result.output).toContain("3|line3");
  });

  it("respects offset and limit", async () => {
    fs.writeFileSync(path.join(tmpDir, "test.txt"), "l1\nl2\nl3\nl4\nl5");
    const result = await executeTool("read_file", {
      path: "test.txt",
      offset: 2,
      limit: 2,
    });
    expect(result.output).toContain("2|l2");
    expect(result.output).toContain("3|l3");
    expect(result.output).not.toContain("l1");
    expect(result.output).not.toContain("l4");
  });

  it("returns error for non-existent file", async () => {
    const result = await executeTool("read_file", { path: "nope.txt" });
    expect(result.isError).toBe(true);
    expect(result.output).toContain("nope.txt");
  });

  it("rejects path traversal", async () => {
    const result = await executeTool("read_file", { path: "../../../etc/passwd" });
    expect(result.isError).toBe(true);
    expect(result.output).toContain("Path escapes workspace");
  });
});

describe("executeTool — write_file", () => {
  it("writes content to a file", async () => {
    const result = await executeTool("write_file", {
      path: "output.txt",
      content: "hello world",
    });
    expect(result.isError).toBe(false);
    expect(result.output).toContain("Wrote output.txt");
    expect(fs.readFileSync(path.join(tmpDir, "output.txt"), "utf-8")).toBe(
      "hello world"
    );
  });

  it("creates nested directories", async () => {
    const result = await executeTool("write_file", {
      path: "src/components/App.tsx",
      content: "export default function App() {}",
    });
    expect(result.isError).toBe(false);
    expect(
      fs.readFileSync(path.join(tmpDir, "src/components/App.tsx"), "utf-8")
    ).toContain("App");
  });

  it("rejects path traversal on write", async () => {
    const result = await executeTool("write_file", {
      path: "../../escape.txt",
      content: "evil",
    });
    expect(result.isError).toBe(true);
    expect(result.output).toContain("Path escapes workspace");
  });
});

describe("executeTool — list_directory", () => {
  it("lists files and directories sorted by name", async () => {
    fs.mkdirSync(path.join(tmpDir, "zzz"));
    fs.writeFileSync(path.join(tmpDir, "aaa.txt"), "a");
    fs.writeFileSync(path.join(tmpDir, "bbb.txt"), "b");

    const result = await executeTool("list_directory", { path: "." });
    expect(result.isError).toBe(false);
    expect(result.output).toContain("f aaa.txt");
    expect(result.output).toContain("f bbb.txt");
    expect(result.output).toContain("d zzz");
    // Check sort order
    const lines = result.output.split("\n");
    const aaaIdx = lines.findIndex((l) => l.includes("aaa.txt"));
    const bbbIdx = lines.findIndex((l) => l.includes("bbb.txt"));
    const zzzIdx = lines.findIndex((l) => l.includes("zzz"));
    expect(aaaIdx).toBeLessThan(bbbIdx);
    expect(bbbIdx).toBeLessThan(zzzIdx);
  });

  it("defaults to workspace root when no path given", async () => {
    fs.writeFileSync(path.join(tmpDir, "root-file.txt"), "x");
    const result = await executeTool("list_directory", {});
    expect(result.output).toContain("root-file.txt");
  });
});

describe("executeTool — search_files", () => {
  beforeEach(() => {
    fs.writeFileSync(path.join(tmpDir, "a.ts"), "const foo = 1;\nconst bar = 2;");
    fs.writeFileSync(path.join(tmpDir, "b.ts"), "const foo = 3;");
    fs.mkdirSync(path.join(tmpDir, "sub"));
    fs.writeFileSync(path.join(tmpDir, "sub/c.ts"), "const foo = 4;");
  });

  it("finds matches across files", async () => {
    const result = await executeTool("search_files", { pattern: "foo" });
    expect(result.isError).toBe(false);
    expect(result.output).toContain("a.ts:1:");
    expect(result.output).toContain("b.ts:1:");
    expect(result.output).toContain("sub/c.ts:1:");
  });

  it("respects glob filter", async () => {
    const result = await executeTool("search_files", {
      pattern: "foo",
      glob: "*.ts",
    });
    expect(result.output).toContain("a.ts");
    expect(result.output).toContain("b.ts");
    expect(result.output).not.toContain("sub/c.ts");
  });

  it("returns no matches message when nothing found", async () => {
    const result = await executeTool("search_files", { pattern: "xyznomatch" });
    expect(result.output).toBe("No matches found");
  });
});

describe("executeTool — run_command", () => {
  it("runs a simple command", async () => {
    const result = await executeTool("run_command", { command: "echo hello" });
    expect(result.isError).toBe(false);
    expect(result.output).toBe("hello");
  });

  it("blocks dangerous commands", async () => {
    const result = await executeTool("run_command", { command: "rm -rf /" });
    expect(result.isError).toBe(true);
    expect(result.output).toBe("Command blocked for safety");
  });

  it("blocks fork bombs", async () => {
    const result = await executeTool("run_command", {
      command: ":(){ :|:& };:",
    });
    expect(result.isError).toBe(true);
    expect(result.output).toBe("Command blocked for safety");
  });

  it("blocks mkfs", async () => {
    const result = await executeTool("run_command", {
      command: "mkfs.ext4 /dev/sda1",
    });
    expect(result.isError).toBe(true);
    expect(result.output).toBe("Command blocked for safety");
  });
});

describe("executeTool — unknown tool", () => {
  it("returns error for unknown tool name", async () => {
    const result = await executeTool("nonexistent_tool", {});
    expect(result.isError).toBe(true);
    expect(result.output).toContain("Unknown tool");
  });
});
