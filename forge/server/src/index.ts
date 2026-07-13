import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { chatRouter } from "./routes/chat.js";
import { filesRouter } from "./routes/files.js";
import { getWorkspaceRoot, setWorkspaceRoot } from "./utils/paths.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3100);

const workspace =
  process.env.FORGE_WORKSPACE ??
  path.resolve(__dirname, "../../..");
setWorkspaceRoot(workspace);

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    name: "forge",
    workspace: getWorkspaceRoot(),
  });
});

app.use("/api/chat", chatRouter);
app.use("/api/files", filesRouter);

const clientDist = path.resolve(__dirname, "../../client/dist");
app.use(express.static(clientDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) res.status(404).json({ error: "Client not built. Run npm run build." });
  });
});

app.listen(PORT, () => {
  console.log(`Forge running on http://localhost:${PORT}`);
  console.log(`Workspace: ${getWorkspaceRoot()}`);
});
