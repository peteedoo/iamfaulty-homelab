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

// Extra browser Origins allowed on top of the built-ins below.
const ALLOWED_ORIGINS = new Set(
  [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3100",
    "http://127.0.0.1:3100",
  ]
    .concat((process.env.FORGE_ALLOWED_ORIGINS ?? "").split(","))
    .map((o) => o.trim())
    .filter(Boolean)
);

// Host header allowlist — mitigates DNS-rebinding attacks that would let a
// remote page reach this server via the victim's browser.
const ALLOWED_HOSTS = new Set(
  ["localhost", "127.0.0.1", "[::1]", "::1"]
    .concat((process.env.FORGE_ALLOWED_HOSTS ?? "").split(","))
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
);

const PRIVATE_HOSTNAME =
  /^(?:localhost|[^.]+\.local|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|\[::1\])$/;

// Browsers send Origin on same-origin POST/PUT too, so a strict list would
// break the UI whenever it is reached on anything but localhost (a LAN IP, a
// hostname, or through the Vite proxy). Private/loopback origins are therefore
// allowed: a page from a public origin — the case CORS defends against — never
// matches, and DNS rebinding is covered by the Host allowlist above.
function originAllowed(origin: string): boolean {
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return ALLOWED_HOSTS.has(hostname) || PRIVATE_HOSTNAME.test(hostname);
  } catch {
    return false;
  }
}

const app = express();

app.use(
  cors({
    // Non-browser clients (curl, server-side) omit Origin — allow them; the
    // Host check and optional token still apply. Disallowed origins get no CORS
    // headers (so the browser blocks them) and a 403 from the guard below,
    // rather than an Express 500 with a stack trace.
    origin: (origin, cb) => cb(null, !origin || originAllowed(origin)),
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

// API guard: origin/DNS-rebinding checks + optional bearer token.
app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin && !originAllowed(origin)) {
    res.status(403).json({ error: `Origin not allowed: ${origin}` });
    return;
  }
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
