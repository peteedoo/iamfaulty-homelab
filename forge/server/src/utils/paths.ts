import path from "node:path";

let workspaceRoot = path.resolve(process.env.FORGE_WORKSPACE ?? process.cwd());

export function getWorkspaceRoot(): string {
  return workspaceRoot;
}

export function setWorkspaceRoot(root: string): void {
  workspaceRoot = path.resolve(root);
}

export function resolveWorkspacePath(relativePath: string): string {
  const resolved = path.resolve(workspaceRoot, relativePath);
  const rel = path.relative(workspaceRoot, resolved);
  if (rel === ".." || rel.startsWith(".." + path.sep) || path.isAbsolute(rel)) {
    throw new Error(`Path escapes workspace: ${relativePath}`);
  }
  return resolved;
}

export function toRelativePath(absolutePath: string): string {
  return path.relative(workspaceRoot, absolutePath) || ".";
}
