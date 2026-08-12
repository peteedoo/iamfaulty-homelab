import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
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

// Trust the reverse proxy (Caddy) so req.ip resolves correctly for rate limiting.
app.set("trust proxy", 1);

// Security headers (CSP is set per-route since the Monaco editor needs inline styles).
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// Compression for all responses.
app.use(compression());

// Request ID — injects a unique ID per request for log correlation.
app.use((req: Request, res: Response, next: NextFunction) => {
  const id = (req.headers["x-request-id"] as string) || randomUUID();
  req.headers["x-request-id"] = id;
  res.setHeader("X-Request-ID", id);
  next();
});

// Rate limiting — 100 req/min per IP, 429 on exceed.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, slow down." },
});

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

// API guard: origin/DNS-rebinding checks + optional bearer token + rate limiting.
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

// Rate limit all /api routes.
app.use("/api", apiLimiter);

// Health endpoint — inside the guard so workspace path isn't leaked to
// disallowed origins, but doesn't require auth so monitoring works.
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    name: "forge",
    workspace: getWorkspaceRoot(),
    authRequired: Boolean(AUTH_TOKEN),
  });
});

app.use("/api/chat", chatRouter);
app.use("/api/files", filesRouter);

// JSON 404 for unknown /api/* routes (before the SPA catch-all).
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

const clientDist = path.resolve(__dirname, "../../client/dist");
app.use(express.static(clientDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) res.status(404).json({ error: "Client not built. Run npm run build." });
  });
});

const server = app.listen(PORT, () => {
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

// Process-level error handlers — prevent silent crashes.
process.on("uncaughtException", (err) => {
  console.error("[forge] Uncaught exception:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[forge] Unhandled rejection:", reason);
});

// Graceful shutdown — close connections on SIGTERM/SIGINT.
function shutdown(signal: string) {
  console.log(`[forge] ${signal} received, shutting down...`);
  server.close(() => {
    console.log("[forge] Server closed.");
    process.exit(0);
  });
  // Force exit after 5s if connections don't close.
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
