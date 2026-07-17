import { useCallback, useEffect, useState } from "react";
import type { TreeNode } from "../types";

export function useWorkspace() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [language, setLanguage] = useState("plaintext");
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const refreshTree = useCallback(async () => {
    try {
      const res = await fetch("/api/files/tree");
      if (!res.ok) {
        throw new Error(`Failed to load file tree: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      setTree(data.tree ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const openFile = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/files/read?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error ?? `Failed to open file: ${res.status} ${res.statusText}`);
      }
      setActiveFile(path);
      setFileContent(data.content);
      setLanguage(data.language ?? "plaintext");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const saveFile = useCallback(
    async (content: string) => {
      if (!activeFile) return;
      setError(null);
      try {
        const res = await fetch("/api/files/write", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: activeFile, content }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            (data as { error?: string }).error ??
              `Failed to save file: ${res.status} ${res.statusText}`
          );
        }
        setFileContent(content);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [activeFile]
  );

  const closeFile = useCallback(() => {
    setActiveFile(null);
    setFileContent("");
    setLanguage("plaintext");
  }, []);

  useEffect(() => {
    refreshTree();
  }, [refreshTree]);

  return {
    tree,
    activeFile,
    fileContent,
    language,
    loading,
    error,
    openFile,
    closeFile,
    saveFile,
    setFileContent,
    refreshTree,
  };
}
