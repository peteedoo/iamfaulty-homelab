import fs from "node:fs/promises";
import path from "node:path";

let workspaceRoot = process.env.FORGE_WORKSPACE ?? process.cwd();

export function getWorkspaceRoot(): string {
  return workspaceRoot;
}

export function setWorkspaceRoot(root: string): void {
  workspaceRoot = path.resolve(root);
}

export function resolveWorkspacePath(relativePath: string): string {
  const resolved = path.resolve(workspaceRoot, relativePath);
  if (!resolved.startsWith(workspaceRoot)) {
    throw new Error(`Path escapes workspace: ${relativePath}`);
  }
  return resolved;
}

export function toRelativePath(absolutePath: string): string {
  return path.relative(workspaceRoot, absolutePath) || ".";
}

/**
 * Resolve a workspace-relative path, create parent directories, and write the
 * file. Returns the number of bytes written.
 */
export async function writeWorkspaceFile(
  relativePath: string,
  content: string
): Promise<number> {
  const filePath = resolveWorkspacePath(relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf-8");
  return Buffer.byteLength(content, "utf-8");
}
