import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";
import { once } from "node:events";
import { createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "../server.mjs";
import { freshState, startSession } from "../src/engine.js";
import { migrateLibrary } from "../src/library.js";

const origin = "https://wortwerk.home";
const password = "family-test-password";
async function fixture(t, overrides = {}) {
  const dir = await mkdtemp(join(tmpdir(), "wortwerk-server-"));
  const distDir = join(dir, "dist"), dataDir = join(dir, "data");
  await mkdir(distDir);
  await writeFile(join(distDir, "index.html"), "<!doctype html><title>Wortwerk</title>");
  await writeFile(join(distDir, "app.js"), "console.log('Wortwerk')");
  await writeFile(join(dir, "secret.txt"), "PRIVATE");
  const env = { WORTWERK_PASSWORD: password, APP_ORIGIN: origin, DATA_DIR: dataDir, ...overrides };
  let server, base;
  const stop = async () => { if (server?.listening) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); } };
  const start = async () => {
    server = createServer({ env, distDir });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    base = `http://127.0.0.1:${server.address().port}`;
  };
  t.after(async () => { await stop(); await rm(dir, { recursive: true, force: true }); });
  await start();
  const request = async (path, { method = "GET", value, cookie, requestOrigin = origin, raw } = {}) => {
    const headers = {};
    if (requestOrigin !== null) headers.Origin = requestOrigin;
    if (cookie) headers.Cookie = cookie;
    if (value !== undefined || raw !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(base + path, { method, headers, body: raw ?? (value === undefined ? undefined : JSON.stringify(value)) });
    const text = await response.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: response.status, headers: response.headers, data };
  };
  const login = () => request("/api/login", { method: "POST", value: { password } });
  const cookie = async () => (await login()).headers.get("set-cookie").split(";")[0];
  return { dir, distDir, dataDir, env, request, login, cookie, stop, start,
    rawRequest: (path) => new Promise((resolve, reject) => {
      http.get(base, { path }, (res) => { let body = ""; res.on("data", (chunk) => { body += chunk; }); res.on("end", () => resolve({ status: res.statusCode, body })); }).on("error", reject);
    }) };
}
const payload = (revision = 0, mutationId = "save-1", state = freshState()) => ({ revision, mutationId, state });
const put = (f, cookie, value) => f.request("/api/progress", { method: "PUT", cookie, value });

test("local mode stays local; shared configuration requires an exact full origin", async (t) => {
  const f = await fixture(t, { WORTWERK_PASSWORD: "" });
  assert.deepEqual((await f.request("/api/config")).data, { shared: false });
  assert.deepEqual((await f.request("/api/health")).data, { ok: true });
  assert.equal((await f.request("/api/progress")).status, 404);
  assert.equal((await f.request("/api/login", { method: "POST", value: { password } })).status, 404);
  await assert.rejects(readFile(join(f.dataDir, "progress.json")), { code: "ENOENT" });
  for (const APP_ORIGIN of [undefined, "null", "https://host/", "https://host/path", "ftp://host", "https://user:pass@host"])
    assert.throws(() => createServer({ env: { ...f.env, WORTWERK_PASSWORD: password, APP_ORIGIN } }), /APP_ORIGIN/);
});

test("authentication, secure session cookie, no-store, no CORS, and exact mutation origins", async (t) => {
  const f = await fixture(t);
  assert.deepEqual((await f.request("/api/config")).data, { shared: true });
  assert.equal((await f.request("/api/progress")).status, 401);
  assert.equal((await put(f, undefined, payload())).status, 401);
  assert.equal((await f.request("/api/login", { method: "POST", value: { password: "wrong" } })).status, 401);
  for (const requestOrigin of [null, "https://evil.test", origin + "/", "null"])
    assert.equal((await f.request("/api/login", { method: "POST", requestOrigin, value: { password } })).status, 403);
  const login = await f.login();
  assert.equal(login.status, 200);
  assert.deepEqual(login.data, { ok: true });
  const header = login.headers.get("set-cookie");
  for (const flag of ["HttpOnly", "SameSite=Strict", "Max-Age=2592000", "Secure", "Path=/"]) assert.ok(header.includes(flag));
  assert.ok(!header.includes(password));
  const cookie = header.split(";")[0];
  assert.equal((await f.request("/api/progress", { cookie: cookie + "tampered" })).status, 401);
  for (const requestOrigin of [null, "https://evil.test"])
    assert.equal((await f.request("/api/progress", { method: "PUT", cookie, requestOrigin, value: payload() })).status, 403);
  const progress = await f.request("/api/progress", { cookie, requestOrigin: null });
  assert.deepEqual(progress.data, { revision: 0, state: null, updatedAt: null });
  assert.equal(progress.headers.get("cache-control"), "no-store");
  assert.equal(progress.headers.get("access-control-allow-origin"), null);
  assert.equal(progress.headers.get("x-content-type-options"), "nosniff");
  assert.equal((await f.request("/api/progress", { method: "OPTIONS", requestOrigin: "https://evil.test" })).status, 403);
});

test("invalid JSON and invalid states cannot change stored progress", async (t) => {
  const f = await fixture(t), cookie = await f.cookie();
  const malformed = startSession(freshState(), Date.now());
  malformed.active.kind = "exam";
  delete malformed.active.feedback;
  for (const value of [null, {}, payload(-1), payload(0, ""), payload(0, "bad id"), payload(0, "x", null), payload(0, "x", {}), payload(0, "x", malformed)])
    assert.equal((await put(f, cookie, value)).status, 400);
  assert.equal((await f.request("/api/progress", { method: "PUT", cookie, raw: "{" })).status, 400);
  assert.equal((await f.request("/api/progress", { method: "PUT", cookie, raw: JSON.stringify({ padding: "x".repeat(2 * 1024 * 1024) }) })).status, 413);
  assert.deepEqual((await f.request("/api/progress", { cookie })).data, { revision: 0, state: null, updatedAt: null });
});

test("revision conflicts, idempotent retry, previous backup, and restart persistence", async (t) => {
  const f = await fixture(t), cookie = await f.cookie(), first = payload();
  const saved = await put(f, cookie, first);
  assert.equal(saved.status, 200);
  assert.deepEqual(Object.keys(saved.data).sort(), ["revision", "state", "updatedAt"]);
  assert.equal(saved.data.revision, 1);
  assert.deepEqual(saved.data.state, first.state);
  assert.ok(Number.isFinite(Date.parse(saved.data.updatedAt)));
  const primary = join(f.dataDir, "progress.json"), backup = join(f.dataDir, "progress.previous.json");
  const firstFile = await readFile(primary, "utf8");
  assert.deepEqual((await put(f, cookie, first)).data, saved.data);
  assert.equal(await readFile(primary, "utf8"), firstFile);
  const reordered = Object.fromEntries(Object.entries(first.state).reverse());
  assert.equal((await put(f, cookie, payload(0, "save-1", reordered))).status, 200);
  const conflict = await put(f, cookie, payload(0, "save-other"));
  assert.equal(conflict.status, 409);
  assert.deepEqual(conflict.data, saved.data);
  const changed = freshState(); changed.totalSteps = 1;
  assert.equal((await put(f, cookie, payload(0, "save-1", changed))).status, 409);
  assert.equal((await put(f, cookie, payload(1, "save-1"))).status, 409);
  await f.stop(); await f.start();
  assert.deepEqual((await f.request("/api/progress", { cookie })).data, saved.data);
  assert.deepEqual((await put(f, cookie, first)).data, saved.data);
  const second = await put(f, cookie, payload(1, "save-2", changed));
  assert.equal(second.data.revision, 2);
  assert.equal(await readFile(backup, "utf8"), firstFile);
  assert.equal((await put(f, cookie, first)).status, 409);
  assert.deepEqual((await readdir(f.dataDir)).sort(), ["progress.json", "progress.previous.json"]);
  const results = await Promise.all([put(f, cookie, payload(2, "race-a")), put(f, cookie, payload(2, "race-b"))]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
});

test("migration preserves the active session and an old tab cannot downgrade the server", async (t) => {
  const f = await fixture(t), cookie = await f.cookie();
  const legacy = startSession(freshState(), Date.now());
  delete legacy.active.queue[0].intro;
  legacy.active.draft = 'unfinished answer'; legacy.active.teachingStep = 2;
  await put(f, cookie, payload(0, 'legacy', legacy));
  const migrated = migrateLibrary(legacy);
  assert.equal((await put(f, cookie, payload(1, 'migration', migrated))).status, 200);
  await f.stop(); await f.start();
  const read = await f.request('/api/progress', {cookie});
  assert.deepEqual(read.data.state.waves[0].progress, legacy);
  const outdated = await put(f, cookie, payload(2, 'old-browser', legacy));
  assert.equal(outdated.status, 409);
  assert.deepEqual(outdated.data.state, migrated);
  const previous = JSON.parse(await readFile(join(f.dataDir, 'progress.previous.json'), 'utf8'));
  assert.deepEqual(previous.state, legacy);
});

test("corruption fails closed while health remains secret-free; no auto-restore or overwrite", async (t) => {
  const f = await fixture(t), cookie = await f.cookie();
  await put(f, cookie, payload()); await put(f, cookie, payload(1, "second"));
  const primary = join(f.dataDir, "progress.json"), backup = join(f.dataDir, "progress.previous.json");
  const previous = await readFile(backup, "utf8");
  for (const corrupt of ["{broken", JSON.stringify({ revision: 2, state: {}, updatedAt: "bad" })]) {
    await f.stop(); await writeFile(primary, corrupt); await f.start();
    assert.equal((await f.request("/api/progress", { cookie })).status, 503);
    assert.equal((await put(f, cookie, payload(2, "repair"))).status, 503);
    assert.equal(await readFile(primary, "utf8"), corrupt);
    assert.equal(await readFile(backup, "utf8"), previous);
    assert.deepEqual((await f.request("/api/health")).data, { ok: true });
  }
  await f.stop(); await rm(primary); await f.start();
  assert.equal((await put(f, cookie, payload())).status, 503);
  await assert.rejects(readFile(primary), { code: "ENOENT" });
});

test("static serving confines paths and symlinks to dist, with MIME and security headers", async (t) => {
  const f = await fixture(t);
  await symlink(join(f.dir, "secret.txt"), join(f.distDir, "leak.txt"));
  const index = await f.request("/");
  assert.equal(index.status, 200);
  assert.match(index.headers.get("content-type"), /^text\/html/);
  assert.match(index.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.equal(index.headers.get("x-frame-options"), "DENY");
  assert.match((await f.request("/app.js")).headers.get("content-type"), /javascript/);
  for (const path of ["/../secret.txt", "/%2e%2e/secret.txt", "/%2e%2e%2fsecret.txt", "/..%5csecret.txt", "/.env", "/leak.txt"])
    assert.equal((await f.rawRequest(path)).status, 403, path);
  for (const path of ["/src/engine.js", "/server.mjs", "/data/progress.json", "/missing", "/api/missing"])
    assert.equal((await f.request(path)).status, 404, path);
  assert.equal((await f.rawRequest("/%zz")).status, 400);
  assert.equal((await f.request("/", { method: "POST", value: {} })).status, 405);
  assert.equal((await f.request("/", { method: "HEAD" })).data, "");
  assert.throws(() => createServer({ env: { ...f.env, DATA_DIR: join(f.distDir, "data") }, distDir: f.distDir }), /outside dist/);
});

test("login attempts are bounded by socket IP and HTTP development cookies remain usable", async (t) => {
  const f = await fixture(t, { APP_ORIGIN: "http://127.0.0.1:4173" });
  const login = () => f.request("/api/login", { method: "POST", requestOrigin: f.env.APP_ORIGIN, value: { password } });
  const first = await login();
  assert.equal(first.status, 200);
  assert.ok(!first.headers.get("set-cookie").includes("Secure"));
  for (let i = 1; i < 10; i++) assert.equal((await login()).status, 200);
  const blocked = await login();
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("retry-after")) > 0);
});

test("expired sessions and password/secret rotation invalidate cookies", async (t) => {
  const f = await fixture(t, { WORTWERK_SESSION_SECRET: "stable-test-secret" });
  const cookie = await f.cookie();
  const expires = String(Math.floor(Date.now() / 1000) - 1);
  const key = createHmac("sha256", f.env.WORTWERK_SESSION_SECRET).update("wortwerk-session-v1\0").update(password).digest();
  const signature = createHmac("sha256", key).update(expires).digest("base64url");
  assert.equal((await f.request("/api/progress", { cookie: `wortwerk_session=${expires}.${signature}` })).status, 401);
  await f.stop(); await f.start();
  assert.equal((await f.request("/api/progress", { cookie })).status, 200);
  await f.stop(); f.env.WORTWERK_SESSION_SECRET = "changed-secret"; await f.start();
  assert.equal((await f.request("/api/progress", { cookie })).status, 401);
  const newCookie = await f.cookie();
  await f.stop(); f.env.WORTWERK_PASSWORD = "changed-password"; await f.start();
  assert.equal((await f.request("/api/progress", { cookie: newCookie })).status, 401);
});

test("backup write failure leaves the primary intact and returns 503", async (t) => {
  const f = await fixture(t), cookie = await f.cookie();
  await put(f, cookie, payload());
  const primary = join(f.dataDir, "progress.json");
  const before = await readFile(primary, "utf8");
  await mkdir(join(f.dataDir, "progress.previous.json"));
  assert.equal((await put(f, cookie, payload(1, "next"))).status, 503);
  assert.equal(await readFile(primary, "utf8"), before);
  assert.equal((await f.request("/api/progress", { cookie })).status, 503);
  assert.ok((await readdir(f.dataDir)).every((name) => !name.endsWith(".tmp")));
});

test("the CLI honors HOST/PORT/DATA_DIR and persists progress across process restarts", async (t) => {
  const f = await fixture(t);
  await f.stop();
  let child;
  const stop = async () => {
    if (child && child.exitCode === null && child.signalCode === null) {
      const ended = once(child, "exit"); child.kill(); await ended;
    }
  };
  t.after(stop);
  const start = () => new Promise((resolve, reject) => {
    child = spawn(process.execPath, [new URL("../server.mjs", import.meta.url).pathname], {
      env: { ...process.env, ...f.env, HOST: "127.0.0.1", PORT: "0" }, stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const timeout = setTimeout(() => reject(new Error("Server did not start")), 5000);
    child.once("error", (error) => { clearTimeout(timeout); reject(error); });
    child.once("exit", () => { clearTimeout(timeout); reject(new Error("Server exited before startup")); });
    child.stdout.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) { clearTimeout(timeout); resolve(match[0]); }
    });
  });
  let base = await start();
  const login = await fetch(base + "/api/login", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  await login.text();
  const saved = await fetch(base + "/api/progress", { method: "PUT", headers: { Origin: origin, Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify(payload()) });
  assert.equal(saved.status, 200);
  const expected = await saved.json();
  await stop(); base = await start();
  const restored = await fetch(base + "/api/progress", { headers: { Cookie: cookie } });
  assert.equal(restored.status, 200);
  assert.deepEqual(await restored.json(), expected);
  await stop();
});
