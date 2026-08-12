import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  resolveWorkspacePath,
  isInsideWorkspace,
  setWorkspaceRoot,
  getWorkspaceRoot,
  toRelativePath,
} from "../paths.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-test-"));
  setWorkspaceRoot(tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("getWorkspaceRoot / setWorkspaceRoot", () => {
  it("returns the configured workspace root", () => {
    expect(getWorkspaceRoot()).toBe(tmpDir);
  });

  it("resolves relative paths to absolute", () => {
    setWorkspaceRoot("./relative");
    expect(path.isAbsolute(getWorkspaceRoot())).toBe(true);
    setWorkspaceRoot(tmpDir);
  });
});

describe("resolveWorkspacePath", () => {
  it("resolves a simple relative path inside workspace", () => {
    const result = resolveWorkspacePath("file.txt");
    expect(result).toBe(path.resolve(tmpDir, "file.txt"));
  });

  it("resolves nested paths inside workspace", () => {
    const result = resolveWorkspacePath("src/components/App.tsx");
    expect(result).toBe(path.resolve(tmpDir, "src/components/App.tsx"));
  });

  it("rejects path traversal with ..", () => {
    expect(() => resolveWorkspacePath("../escape.txt")).toThrow(
      "Path escapes workspace"
    );
  });

  it("rejects deep path traversal with ..", () => {
    expect(() => resolveWorkspacePath("a/b/../../../escape.txt")).toThrow(
      "Path escapes workspace"
    );
  });

  it("rejects absolute paths outside workspace", () => {
    expect(() => resolveWorkspacePath("/etc/passwd")).toThrow(
      "Path escapes workspace"
    );
  });

  it("allows . as workspace root", () => {
    const result = resolveWorkspacePath(".");
    expect(result).toBe(path.resolve(tmpDir));
  });

  it("allows paths with . that stay inside", () => {
    const result = resolveWorkspacePath("./src/./file.ts");
    expect(result).toBe(path.resolve(tmpDir, "src/file.ts"));
  });
});

describe("isInsideWorkspace", () => {
  it("returns true for paths inside workspace", () => {
    expect(isInsideWorkspace("file.txt")).toBe(true);
    expect(isInsideWorkspace("src/App.tsx")).toBe(true);
  });

  it("returns false for path traversal", () => {
    expect(isInsideWorkspace("../escape.txt")).toBe(false);
    expect(isInsideWorkspace("../../etc/passwd")).toBe(false);
  });

  it("returns false for absolute paths outside workspace", () => {
    expect(isInsideWorkspace("/etc/passwd")).toBe(false);
  });
});

describe("toRelativePath", () => {
  it("converts absolute path to relative", () => {
    const abs = path.resolve(tmpDir, "src/file.ts");
    expect(toRelativePath(abs)).toBe("src/file.ts");
  });

  it("returns . for workspace root", () => {
    expect(toRelativePath(tmpDir)).toBe(".");
  });
});

describe("symlink escape prevention", () => {
  it("rejects symlink pointing outside workspace", () => {
    const outsideDir = path.join(os.tmpdir(), "forge-outside-" + Date.now());
    fs.mkdirSync(outsideDir, { recursive: true });
    fs.writeFileSync(path.join(outsideDir, "secret.txt"), "secret");

    const linkPath = path.join(tmpDir, "evil-link");
    fs.symlinkSync(outsideDir, linkPath);

    expect(() => resolveWorkspacePath("evil-link/secret.txt")).toThrow(
      "Path escapes workspace"
    );

    fs.rmSync(outsideDir, { recursive: true, force: true });
  });

  it("allows symlink pointing inside workspace", () => {
    const realDir = path.join(tmpDir, "real-dir");
    fs.mkdirSync(realDir, { recursive: true });
    fs.writeFileSync(path.join(realDir, "file.txt"), "content");

    const linkPath = path.join(tmpDir, "good-link");
    fs.symlinkSync(realDir, linkPath);

    const result = resolveWorkspacePath("good-link/file.txt");
    expect(result).toBe(path.resolve(tmpDir, "good-link/file.txt"));
  });
});
