import fs from "node:fs";
import path from "node:path";

let workspaceRoot = path.resolve(process.env.FORGE_WORKSPACE ?? process.cwd());

export function getWorkspaceRoot(): string {
  return workspaceRoot;
}

export function setWorkspaceRoot(root: string): void {
  workspaceRoot = path.resolve(root);
}

function assertInside(root: string, target: string, requested: string): void {
  const rel = path.relative(root, target);
  if (rel === ".." || rel.startsWith(".." + path.sep) || path.isAbsolute(rel)) {
    throw new Error(`Path escapes workspace: ${requested}`);
  }
}

function realOrSelf(target: string): string {
  try {
    return fs.realpathSync(target);
  } catch {
    return target;
  }
}

// Resolves the deepest existing ancestor of `target` through symlinks, keeping
// the not-yet-created trailing components. Lets a write to a new file be
// checked against the real location of the directory it lands in.
function resolveExistingPrefix(target: string): string {
  const trailing: string[] = [];
  let current = target;

  for (;;) {
    try {
      return path.join(fs.realpathSync(current), ...trailing.reverse());
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return target;
      trailing.push(path.basename(current));
      current = parent;
    }
  }
}

export function resolveWorkspacePath(relativePath: string): string {
  const resolved = path.resolve(workspaceRoot, relativePath);
  assertInside(workspaceRoot, resolved, relativePath);
  // Lexical containment isn't enough: a symlink inside the workspace can point
  // anywhere, so compare real paths too.
  assertInside(
    realOrSelf(workspaceRoot),
    resolveExistingPrefix(resolved),
    relativePath
  );
  return resolved;
}

export function isInsideWorkspace(relativePath: string): boolean {
  try {
    resolveWorkspacePath(relativePath);
    return true;
  } catch {
    return false;
  }
}

export function toRelativePath(absolutePath: string): string {
  return path.relative(workspaceRoot, absolutePath) || ".";
}
