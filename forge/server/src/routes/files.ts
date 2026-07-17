import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import {
  getWorkspaceRoot,
  resolveWorkspacePath,
  toRelativePath,
  writeWorkspaceFile,
} from "../utils/paths.js";

export const filesRouter = Router();

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: TreeNode[];
}

const IGNORE = new Set([
  "node_modules",
  ".git",
  "dist",
  ".next",
  "__pycache__",
  ".venv",
]);

filesRouter.get("/tree", async (_req, res) => {
  try {
    const tree = await buildTree(getWorkspaceRoot(), ".");
    res.json({ root: getWorkspaceRoot(), tree });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

filesRouter.get("/read", async (req, res) => {
  try {
    const filePath = resolveWorkspacePath(String(req.query.path));
    const content = await fs.readFile(filePath, "utf-8");
    res.json({
      path: toRelativePath(filePath),
      content,
      language: detectLanguage(filePath),
    });
  } catch (err) {
    res.status(404).json({ error: String(err) });
  }
});

filesRouter.put("/write", async (req, res) => {
  try {
    const { path: relPath, content } = req.body as {
      path: string;
      content: string;
    };
    await writeWorkspaceFile(relPath, content);
    res.json({ ok: true, path: relPath });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

async function buildTree(absDir: string, relDir: string): Promise<TreeNode[]> {
  const entries = await fs.readdir(absDir, { withFileTypes: true });
  const nodes: TreeNode[] = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (IGNORE.has(entry.name) || entry.name.startsWith(".")) continue;

    const relPath = relDir === "." ? entry.name : `${relDir}/${entry.name}`;

    if (entry.isDirectory()) {
      const children = await buildTree(path.join(absDir, entry.name), relPath);
      nodes.push({
        name: entry.name,
        path: relPath,
        type: "directory",
        children,
      });
    } else {
      nodes.push({ name: entry.name, path: relPath, type: "file" });
    }
  }

  return nodes;
}

function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).slice(1);
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    rs: "rust",
    go: "go",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
    css: "css",
    html: "html",
    sh: "shell",
    dockerfile: "dockerfile",
  };
  return map[ext] ?? "plaintext";
}
