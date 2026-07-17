import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { chatRouter } from "./routes/chat.js";
import { filesRouter } from "./routes/files.js";
import { getWorkspaceRoot, setWorkspaceRoot } from "./utils/paths.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3100);

const workspace =
  process.env.FORGE_WORKSPACE ??
  path.resolve(__dirname, "../../..");
setWorkspaceRoot(workspace);

const AUTH_TOKEN = process.env.FORGE_AUTH_TOKEN?.trim();

// Origins allowed to make cross-origin browser requests. Same-origin (the
// built client served from this server) and the Vite dev proxy don't need
// this, so the default list is intentionally narrow.
const ALLOWED_ORIGINS = (
  process.env.FORGE_ALLOWED_ORIGINS ??
  "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3100,http://127.0.0.1:3100"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Host header allowlist — mitigates DNS-rebinding attacks that would let a
// remote page reach this server via the victim's browser.
const ALLOWED_HOSTS = new Set(
  ["localhost", "127.0.0.1", "[::1]", "::1"]
    .concat((process.env.FORGE_ALLOWED_HOSTS ?? "").split(","))
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
);

const app = express();

app.use(
  cors({
    origin(origin, cb) {
      // Non-browser clients (curl, server-side) omit Origin — allow them; the
      // Host check and optional token still apply.
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      cb(new Error(`Origin not allowed: ${origin}`));
    },
  })
);
app.use(express.json({ limit: "10mb" }));

function hostAllowed(req: Request): boolean {
  const host = (req.headers.host ?? "").split(":")[0].toLowerCase();
  return ALLOWED_HOSTS.has(host);
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    name: "forge",
    workspace: getWorkspaceRoot(),
    authRequired: Boolean(AUTH_TOKEN),
  });
});

// API guard: DNS-rebinding host check + optional bearer token.
app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  if (!hostAllowed(req)) {
    res.status(403).json({ error: "Host not allowed" });
    return;
  }
  if (AUTH_TOKEN) {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (token !== AUTH_TOKEN) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }
  next();
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
  if (!AUTH_TOKEN) {
    console.warn(
      "[forge] WARNING: FORGE_AUTH_TOKEN is not set — the API (which can run " +
        "shell commands) is unauthenticated. Keep the port bound to localhost " +
        "and set FORGE_AUTH_TOKEN before exposing it."
    );
  }
});
