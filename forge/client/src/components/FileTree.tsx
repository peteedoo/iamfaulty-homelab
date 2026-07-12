import { useState } from "react";
import type { TreeNode } from "../types";
import "./FileTree.css";

interface Props {
  tree: TreeNode[];
  activeFile: string | null;
  onOpen: (path: string) => void;
}

export function FileTree({ tree, activeFile, onOpen }: Props) {
  return (
    <div className="file-tree">
      {tree.map((node) => (
        <TreeNodeItem
          key={node.path}
          node={node}
          activeFile={activeFile}
          onOpen={onOpen}
          depth={0}
        />
      ))}
    </div>
  );
}

function TreeNodeItem({
  node,
  activeFile,
  onOpen,
  depth,
}: {
  node: TreeNode;
  activeFile: string | null;
  onOpen: (path: string) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isDir = node.type === "directory";
  const isActive = activeFile === node.path;

  return (
    <div>
      <button
        className={`tree-item ${isActive ? "active" : ""}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => {
          if (isDir) setExpanded(!expanded);
          else onOpen(node.path);
        }}
      >
        <span className="tree-icon">{isDir ? (expanded ? "▾" : "▸") : "·"}</span>
        <span className="tree-name">{node.name}</span>
      </button>
      {isDir && expanded && node.children?.map((child) => (
        <TreeNodeItem
          key={child.path}
          node={child}
          activeFile={activeFile}
          onOpen={onOpen}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}
