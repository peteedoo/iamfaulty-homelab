import "dotenv/config";
import path from "node:path";
import { timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express, { type RequestHandler } from "express";
import { chatRouter } from "./routes/chat.js";
import { filesRouter } from "./routes/files.js";
import { getWorkspaceRoot, setWorkspaceRoot } from "./utils/paths.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3100);

const workspace =
  process.env.FORGE_WORKSPACE ??
  path.resolve(__dirname, "../../..");
setWorkspaceRoot(workspace);

// Only allow browsers from explicitly-listed origins to call the API.
// The bundled client is served same-origin and needs no CORS grant, so the
// default (empty list) blocks cross-origin browser access. This matters
// because the API can read/write files and run shell commands.
const allowedOrigins = (process.env.FORGE_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const app = express();
app.disable("x-powered-by");
app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : false,
  })
);
app.use(express.json({ limit: "10mb" }));

// Optional shared-token auth. When FORGE_AUTH_TOKEN is set, every /api request
// must present `Authorization: Bearer <token>`. Recommended whenever Forge is
// reachable beyond localhost, since the API grants file and shell access.
const authToken = process.env.FORGE_AUTH_TOKEN;
const requireAuth: RequestHandler = (req, res, next) => {
  if (!authToken) return next();
  const header = req.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const expected = Buffer.from(authToken);
  const got = Buffer.from(provided);
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
};

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "forge" });
});

app.use("/api/chat", requireAuth, chatRouter);
app.use("/api/files", requireAuth, filesRouter);

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
