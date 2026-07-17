import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getWorkspaceRoot,
  resolveWorkspacePath,
  setWorkspaceRoot,
  toRelativePath,
} from "./paths.js";

describe("paths utils", () => {
  let original: string;

  beforeEach(() => {
    original = getWorkspaceRoot();
    setWorkspaceRoot("/tmp/forge-workspace");
  });

  afterEach(() => {
    setWorkspaceRoot(original);
  });

  describe("setWorkspaceRoot / getWorkspaceRoot", () => {
    it("stores an absolute, resolved root", () => {
      setWorkspaceRoot("/tmp/forge-workspace/nested/..");
      expect(getWorkspaceRoot()).toBe("/tmp/forge-workspace");
    });

    it("resolves relative roots against the process cwd", () => {
      setWorkspaceRoot("some/relative/dir");
      expect(getWorkspaceRoot()).toBe(path.resolve("some/relative/dir"));
    });
  });

  describe("resolveWorkspacePath", () => {
    it("resolves a relative path inside the workspace", () => {
      expect(resolveWorkspacePath("src/index.ts")).toBe(
        "/tmp/forge-workspace/src/index.ts"
      );
    });

    it("collapses inner traversal that stays within the workspace", () => {
      expect(resolveWorkspacePath("src/../README.md")).toBe(
        "/tmp/forge-workspace/README.md"
      );
    });

    it("returns the root itself for '.'", () => {
      expect(resolveWorkspacePath(".")).toBe("/tmp/forge-workspace");
    });

    it("throws when the path escapes the workspace via traversal", () => {
      expect(() => resolveWorkspacePath("../../etc/passwd")).toThrow(
        /escapes workspace/
      );
    });

    it("throws when given an absolute path outside the workspace", () => {
      expect(() => resolveWorkspacePath("/etc/passwd")).toThrow(
        /escapes workspace/
      );
    });
  });

  describe("toRelativePath", () => {
    it("returns the path relative to the workspace root", () => {
      expect(toRelativePath("/tmp/forge-workspace/src/index.ts")).toBe(
        "src/index.ts"
      );
    });

    it("returns '.' for the workspace root itself", () => {
      expect(toRelativePath("/tmp/forge-workspace")).toBe(".");
    });
  });
});
