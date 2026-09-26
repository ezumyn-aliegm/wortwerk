import http from "node:http";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import { resolve, extname, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createProgressStore, validState } from "./server/progress.mjs";

const appDir = dirname(fileURLToPath(import.meta.url));
const COOKIE = "wortwerk_session";
const SESSION_SECONDS = 30 * 24 * 60 * 60;
const BODY_LIMIT = 2 * 1024 * 1024;
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8", ".webmanifest": "application/manifest+json",
};
const digest = (value) => createHash("sha256").update(value).digest();
const equal = (a, b) => timingSafeEqual(digest(a), digest(b));
const inside = (root, target) => target === root || target.startsWith(root + sep);
const failure = (status, message) => Object.assign(new Error(message), { status });

async function body(req, limit = BODY_LIMIT) {
  if (req.headers["content-type"]?.split(";")[0].trim() !== "application/json")
    throw failure(415, "Expected application/json");
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw failure(413, "Request too large");
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw failure(400, "Invalid JSON"); }
}

// Importing the factory does not start a listener, allowing real HTTP tests on port 0.
export function createServer({ env = process.env, distDir = resolve(appDir, "dist") } = {}) {
  const password = env.WORTWERK_PASSWORD || "";
  const shared = Boolean(password);
  let origin;
  if (shared) {
    try {
      const parsed = new URL(env.APP_ORIGIN);
      if (!["http:", "https:"].includes(parsed.protocol) || parsed.origin !== env.APP_ORIGIN)
        throw new Error();
      origin = parsed.origin;
    } catch { throw new Error("APP_ORIGIN must be a full http(s) origin in shared mode (no path or trailing slash)"); }
  }
  const secure = origin?.startsWith("https:");
  const key = createHmac("sha256", env.WORTWERK_SESSION_SECRET || password)
    .update("wortwerk-session-v1\0").update(password).digest();
  const sign = (payload) => createHmac("sha256", key).update(payload).digest("base64url");
  function authenticated(req) {
    const token = req.headers.cookie?.split(";").map((v) => v.trim())
      .find((v) => v.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1);
    if (!token || token.length > 200) return false;
    const [expires, signature, extra] = token.split(".");
    return extra === undefined && /^\d+$/.test(expires) && typeof signature === "string" &&
      equal(signature, sign(expires)) && Number(expires) > Math.floor(Date.now() / 1000) &&
      Number(expires) <= Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  }
  const store = shared ? createProgressStore(resolve(env.DATA_DIR || "./data"), distDir) : null;
  const attempts = new Map();
  function rateLimit(req, res) {
    const now = Date.now();
    for (const [ip, entry] of attempts) if (entry.until <= now) attempts.delete(ip);
    const ip = req.socket.remoteAddress;
    let entry = attempts.get(ip);
    if (!entry) {
      if (attempts.size >= 1000) throw failure(429, "Too many login attempts");
      entry = { count: 0, until: now + 60_000 };
      attempts.set(ip, entry);
    }
    if (++entry.count > 10) {
      res.setHeader("Retry-After", String(Math.ceil((entry.until - now) / 1000)));
      throw failure(429, "Too many login attempts");
    }
  }
  return http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    if (secure) res.setHeader("Strict-Transport-Security", "max-age=31536000");
    res.setHeader("Cache-Control", "no-store");
    const json = (status, value) => {
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(value));
    };
    try {
      const path = decodeURIComponent(req.url.split("?")[0]);
      if (!path.startsWith("/") || path.includes("\\") || path.includes("\0") ||
          path.split("/").some((part) => part.startsWith(".")))
        throw failure(403, "Forbidden path");
      if (path.startsWith("/api/") || path === "/api") {
        if (req.method === "GET" && path === "/api/config") return json(200, { shared });
        if (req.method === "GET" && path === "/api/health") return json(200, { ok: true });
        if (!shared) throw failure(404, "Shared progress is disabled");
        if (!["GET", "HEAD"].includes(req.method) && req.headers.origin !== origin)
          throw failure(403, "Origin not allowed");
        if (path === "/api/login" && req.method === "POST") {
          rateLimit(req, res);
          const value = await body(req, 4096);
          if (typeof value?.password !== "string" || !equal(value.password, password))
            throw failure(401, "Invalid password");
          const expires = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
          res.setHeader("Set-Cookie", `${COOKIE}=${expires}.${sign(expires)}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`);
          return json(200, { ok: true });
        }
        if (path === "/api/progress" && ["GET", "PUT"].includes(req.method)) {
          if (!authenticated(req)) throw failure(401, "Authentication required");
          if (req.method === "GET") return json(200, store.get());
          const value = await body(req);
          if (!Number.isSafeInteger(value?.revision) || value.revision < 0 ||
              typeof value.mutationId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value.mutationId) ||
              !validState(value.state)) throw failure(400, "Invalid progress payload");
          const result = store.put(value);
          return json(result.status, result.envelope);
        }
        throw failure(404, "API route not found");
      }
      if (!["GET", "HEAD"].includes(req.method)) throw failure(405, "Method not allowed");
      const root = await realpath(distDir);
      const target = await realpath(resolve(root, "." + (path === "/" ? "/index.html" : path)));
      if (!inside(root, target) || store?.contains(target)) throw failure(403, "Forbidden path");
      if (!(await stat(target)).isFile()) throw failure(404, "Not found");
      const content = await readFile(target);
      res.writeHead(200, {
        "Content-Type": types[extname(target).toLowerCase()] || "application/octet-stream",
        "Content-Length": content.length,
        "Cache-Control": "no-cache",
      });
      res.end(req.method === "HEAD" ? undefined : content);
    } catch (error) {
      const status = error.status || (error instanceof URIError ? 400 :
        ["ENOENT", "ENOTDIR"].includes(error.code) ? 404 : 500);
      json(status, { error: error.status ? error.message : status === 404 ? "Not found" : status === 400 ? "Invalid path" : "Internal server error" });
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const host = process.env.HOST || "127.0.0.1";
    const port = Number(process.env.PORT || 4173);
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("Invalid PORT");
    const server = createServer();
    server.on("error", (error) => {
      console.error(error.code === "EADDRINUSE" ? "Wortwerk port is already in use." : "Wortwerk could not start.");
      process.exitCode = 1;
    });
    server.listen(port, host, () => console.log(`Wortwerk is ready: http://${host}:${server.address().port}\nKeep this window open. Press Ctrl+C to stop.`));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
