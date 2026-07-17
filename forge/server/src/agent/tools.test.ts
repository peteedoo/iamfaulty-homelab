import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TOOL_DEFINITIONS, executeTool } from "./tools.js";
import { getWorkspaceRoot, setWorkspaceRoot } from "../utils/paths.js";

let workspace: string;
let originalRoot: string;

beforeEach(async () => {
  originalRoot = getWorkspaceRoot();
  workspace = await fs.mkdtemp(path.join(os.tmpdir(), "forge-tools-"));
  setWorkspaceRoot(workspace);
});

afterEach(async () => {
  setWorkspaceRoot(originalRoot);
  await fs.rm(workspace, { recursive: true, force: true });
});

describe("TOOL_DEFINITIONS", () => {
  it("declares the five documented tools", () => {
    expect(TOOL_DEFINITIONS.map((t) => t.name)).toEqual([
      "read_file",
      "write_file",
      "search_files",
      "list_directory",
      "run_command",
    ]);
  });

  it("marks required fields on each tool schema", () => {
    const byName = Object.fromEntries(TOOL_DEFINITIONS.map((t) => [t.name, t]));
    expect(byName.read_file.input_schema.required).toEqual(["path"]);
    expect(byName.write_file.input_schema.required).toEqual(["path", "content"]);
    expect(byName.run_command.input_schema.required).toEqual(["command"]);
  });
});

describe("executeTool", () => {
  it("returns an error for an unknown tool", async () => {
    const res = await executeTool("does_not_exist", {});
    expect(res.isError).toBe(true);
    expect(res.output).toMatch(/Unknown tool/);
  });

  describe("write_file / read_file", () => {
    it("writes a file and reports the byte count", async () => {
      const res = await executeTool("write_file", {
        path: "notes/todo.txt",
        content: "hello",
      });
      expect(res.isError).toBe(false);
      expect(res.output).toBe("Wrote notes/todo.txt (5 bytes)");
      const onDisk = await fs.readFile(path.join(workspace, "notes/todo.txt"), "utf-8");
      expect(onDisk).toBe("hello");
    });

    it("reads a file back with 1-indexed line prefixes", async () => {
      await fs.writeFile(path.join(workspace, "a.txt"), "one\ntwo\nthree");
      const res = await executeTool("read_file", { path: "a.txt" });
      expect(res.output).toBe("1|one\n2|two\n3|three");
    });

    it("honours offset and limit when reading", async () => {
      await fs.writeFile(path.join(workspace, "a.txt"), "l1\nl2\nl3\nl4\nl5");
      const res = await executeTool("read_file", { path: "a.txt", offset: 2, limit: 2 });
      expect(res.output).toBe("2|l2\n3|l3");
    });

    it("reports an error when reading a missing file", async () => {
      const res = await executeTool("read_file", { path: "missing.txt" });
      expect(res.isError).toBe(true);
      expect(res.output).toMatch(/ENOENT|no such file/i);
    });

    it("blocks path traversal outside the workspace", async () => {
      const res = await executeTool("write_file", {
        path: "../escape.txt",
        content: "x",
      });
      expect(res.isError).toBe(true);
      expect(res.output).toMatch(/escapes workspace/);
    });
  });

  describe("list_directory", () => {
    it("lists sorted entries with d/f prefixes", async () => {
      await fs.mkdir(path.join(workspace, "src"));
      await fs.writeFile(path.join(workspace, "readme.md"), "x");
      const res = await executeTool("list_directory", { path: "." });
      expect(res.output).toBe("f readme.md\nd src");
    });

    it("defaults to the workspace root when no path is given", async () => {
      await fs.writeFile(path.join(workspace, "only.txt"), "x");
      const res = await executeTool("list_directory", {});
      expect(res.output).toBe("f only.txt");
    });
  });

  describe("search_files", () => {
    it("finds matching lines and reports file:line", async () => {
      await fs.writeFile(path.join(workspace, "a.ts"), "const foo = 1;\nconst bar = 2;");
      await fs.writeFile(path.join(workspace, "b.ts"), "no match here");
      const res = await executeTool("search_files", { pattern: "foo", glob: "**/*.ts" });
      expect(res.output).toBe("a.ts:1: const foo = 1;");
    });

    it("returns a friendly message when nothing matches", async () => {
      await fs.writeFile(path.join(workspace, "a.ts"), "nothing");
      const res = await executeTool("search_files", { pattern: "zzz" });
      expect(res.output).toBe("No matches found");
    });
  });

  describe("run_command", () => {
    it("runs a command and returns its output", async () => {
      const res = await executeTool("run_command", { command: "echo hello" });
      expect(res.isError).toBe(false);
      expect(res.output).toBe("hello");
    });

    it("runs the command in the workspace directory", async () => {
      const res = await executeTool("run_command", { command: "pwd" });
      expect(res.output).toBe(await fs.realpath(workspace));
    });

    it("reports (no output) for a silent command", async () => {
      const res = await executeTool("run_command", { command: "true" });
      expect(res.output).toBe("(no output)");
    });

    it("blocks dangerous commands", async () => {
      const res = await executeTool("run_command", { command: "rm -rf /" });
      expect(res.isError).toBe(true);
      expect(res.output).toBe("Command blocked for safety");
    });

    it("surfaces a failing command as an error", async () => {
      const res = await executeTool("run_command", { command: "exit 3" });
      expect(res.isError).toBe(true);
    });
  });
});
