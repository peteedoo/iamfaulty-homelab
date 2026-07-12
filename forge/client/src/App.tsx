import { useEffect, useState } from "react";
import { ChatPanel } from "./components/ChatPanel";
import { EditorPane } from "./components/EditorPane";
import { FileTree } from "./components/FileTree";
import { useChat } from "./hooks/useChat";
import { useWorkspace } from "./hooks/useWorkspace";
import "./App.css";

export default function App() {
  const workspace = useWorkspace();
  const [provider, setProvider] = useState("ollama");
  const [model, setModel] = useState("qwen2.5-coder:7b");
  const [apiKey, setApiKey] = useState("");

  const chat = useChat({
    provider,
    model,
    apiKey,
    onFileChange: ({ tool, path } = {}) => {
      workspace.refreshTree();
      if (tool === "write_file" && path) {
        workspace.openFile(path);
        return;
      }
      if (workspace.activeFile) workspace.openFile(workspace.activeFile);
    },
  });

  useEffect(() => {
    chat.loadProviders().then((list) => {
      const ollama = list.find((p) => p.id === "ollama");
      if (ollama) {
        setProvider(ollama.id);
        setModel(ollama.defaultModel);
      }
    });
  }, [chat.loadProviders]);

  const handleProviderChange = (p: string) => {
    setProvider(p);
    const info = chat.providers.find((x) => x.id === p);
    if (info) setModel(info.defaultModel);
  };

  const hasEditor = Boolean(workspace.activeFile);

  return (
    <div className={`app ${hasEditor ? "editor-open" : "chat-focus"}`}>
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="logo"><span>Forge</span></span>
        </div>
        <FileTree
          tree={workspace.tree}
          activeFile={workspace.activeFile}
          onOpen={workspace.openFile}
        />
      </aside>

      {hasEditor && (
        <main className="main">
          <EditorPane
            path={workspace.activeFile}
            content={workspace.fileContent}
            language={workspace.language}
            onChange={workspace.setFileContent}
            onSave={() => workspace.saveFile(workspace.fileContent)}
            onClose={() => workspace.closeFile()}
          />
        </main>
      )}

      <aside className="chat-sidebar">
        <ChatPanel
          messages={chat.messages}
          isStreaming={chat.isStreaming}
          providers={chat.providers}
          provider={provider}
          model={model}
          apiKey={apiKey}
          onProviderChange={handleProviderChange}
          onModelChange={setModel}
          onApiKeyChange={setApiKey}
          onSend={chat.sendMessage}
          onStop={chat.stop}
          onClear={chat.clear}
        />
      </aside>
    </div>
  );
}
