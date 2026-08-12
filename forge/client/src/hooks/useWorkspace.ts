import { useCallback, useEffect, useState } from "react";
import type { TreeNode } from "../types";
import { assertOk, authHeaders } from "../lib/api";

export function useWorkspace() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [language, setLanguage] = useState("plaintext");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshTree = useCallback(async () => {
    try {
      const res = await fetch("/api/files/tree", { headers: authHeaders() });
      const data = await (await assertOk(res)).json();
      setTree(data.tree ?? []);
      setError(null);
    } catch (err) {
      setTree([]);
      setError(`Could not load workspace: ${(err as Error).message}`);
    }
  }, []);

  const openFile = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/files/read?path=${encodeURIComponent(path)}`, {
        headers: authHeaders(),
      });
      const data = await (await assertOk(res)).json();
      setActiveFile(path);
      setFileContent(data.content);
      setLanguage(data.language ?? "plaintext");
      setError(null);
    } catch (err) {
      setError(`Could not open ${path}: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveFile = useCallback(
    async (content: string) => {
      if (!activeFile) return;
      try {
        const res = await fetch("/api/files/write", {
          method: "PUT",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ path: activeFile, content }),
        });
        await assertOk(res);
        setFileContent(content);
        setError(null);
      } catch (err) {
        setError(`Could not save ${activeFile}: ${(err as Error).message}`);
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
    dismissError: () => setError(null),
    openFile,
    closeFile,
    saveFile,
    setFileContent,
    refreshTree,
  };
}
