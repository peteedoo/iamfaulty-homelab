import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { filesRouter } from "./files.js";
import { getWorkspaceRoot, setWorkspaceRoot } from "../utils/paths.js";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/files", filesRouter);
  return app;
}

let workspace: string;
let originalRoot: string;

beforeEach(async () => {
  originalRoot = getWorkspaceRoot();
  workspace = await fs.mkdtemp(path.join(os.tmpdir(), "forge-files-"));
  setWorkspaceRoot(workspace);
});

afterEach(async () => {
  setWorkspaceRoot(originalRoot);
  await fs.rm(workspace, { recursive: true, force: true });
});

describe("GET /api/files/tree", () => {
  it("returns a sorted tree and skips ignored / dotfiles", async () => {
    await fs.mkdir(path.join(workspace, "src"));
    await fs.mkdir(path.join(workspace, "node_modules"));
    await fs.writeFile(path.join(workspace, "src/index.ts"), "x");
    await fs.writeFile(path.join(workspace, "README.md"), "x");
    await fs.writeFile(path.join(workspace, ".env"), "secret");

    const res = await request(makeApp()).get("/api/files/tree");

    expect(res.status).toBe(200);
    expect(res.body.root).toBe(workspace);
    const names = res.body.tree.map((n: { name: string }) => n.name);
    expect(names).toEqual(["README.md", "src"]);
    const src = res.body.tree.find((n: { name: string }) => n.name === "src");
    expect(src.type).toBe("directory");
    expect(src.children).toEqual([
      { name: "index.ts", path: "src/index.ts", type: "file" },
    ]);
  });
});

describe("GET /api/files/read", () => {
  it("returns file content and detected language", async () => {
    await fs.writeFile(path.join(workspace, "main.py"), "print('hi')");
    const res = await request(makeApp()).get("/api/files/read").query({ path: "main.py" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      path: "main.py",
      content: "print('hi')",
      language: "python",
    });
  });

  it("falls back to plaintext for unknown extensions", async () => {
    await fs.writeFile(path.join(workspace, "data.bin"), "x");
    const res = await request(makeApp()).get("/api/files/read").query({ path: "data.bin" });
    expect(res.body.language).toBe("plaintext");
  });

  it("returns 404 for a missing file", async () => {
    const res = await request(makeApp()).get("/api/files/read").query({ path: "nope.ts" });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/ENOENT|no such file/i);
  });

  it("returns 404 when the path escapes the workspace", async () => {
    const res = await request(makeApp())
      .get("/api/files/read")
      .query({ path: "../../etc/passwd" });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/escapes workspace/);
  });
});

describe("PUT /api/files/write", () => {
  it("creates nested directories and writes the file", async () => {
    const res = await request(makeApp())
      .put("/api/files/write")
      .send({ path: "a/b/c.txt", content: "deep" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, path: "a/b/c.txt" });
    const onDisk = await fs.readFile(path.join(workspace, "a/b/c.txt"), "utf-8");
    expect(onDisk).toBe("deep");
  });

  it("returns 400 when the write path escapes the workspace", async () => {
    const res = await request(makeApp())
      .put("/api/files/write")
      .send({ path: "../escape.txt", content: "x" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/escapes workspace/);
  });
});
