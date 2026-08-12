import { useCallback, useEffect, useState } from "react";
import type { TreeNode } from "../types";
import { authHeaders } from "../lib/api";

export function useWorkspace() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [language, setLanguage] = useState("plaintext");
  const [loading, setLoading] = useState(false);

  const refreshTree = useCallback(async () => {
    const res = await fetch("/api/files/tree", { headers: authHeaders() });
    const data = await res.json();
    setTree(data.tree ?? []);
  }, []);

  const openFile = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/files/read?path=${encodeURIComponent(path)}`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setActiveFile(path);
      setFileContent(data.content);
      setLanguage(data.language ?? "plaintext");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveFile = useCallback(
    async (content: string) => {
      if (!activeFile) return;
      await fetch("/api/files/write", {
        method: "PUT",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ path: activeFile, content }),
      });
      setFileContent(content);
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
    openFile,
    closeFile,
    saveFile,
    setFileContent,
    refreshTree,
  };
}
