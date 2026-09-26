import { createHash, randomUUID } from "node:crypto";
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { validateSave as validateState } from "../src/library.js";

export function validState(value) {
  try { return validateState(value) === true; } catch { return false; }
}
const unavailable = () => Object.assign(new Error("Progress storage unavailable; preserve the files and repair before retrying"), { status: 503 });
const envelope = ({ revision, state, updatedAt }) => ({ revision, state, updatedAt });
// Canonical object keys let a retry survive JSON property reordering.
const canonical = (value) => Array.isArray(value) ? value.map(canonical) :
  value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const fingerprint = (state) => createHash("sha256").update(JSON.stringify(canonical(state))).digest("hex");

export function createProgressStore(directory, distDir) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const root = realpathSync(directory);
  const dist = existsSync(distDir) ? realpathSync(distDir) : resolve(distDir);
  if (root === dist || root.startsWith(dist + sep)) throw new Error("DATA_DIR must be outside dist");
  const file = resolve(root, "progress.json");
  const backup = resolve(root, "progress.previous.json");
  let failed = false;
  let seenFile = existsSync(file);

  function read() {
    if (failed) throw unavailable();
    try {
      if (!existsSync(file)) {
        if (seenFile || existsSync(backup)) throw new Error("Missing progress file");
        return { record: { revision: 0, state: null, updatedAt: null }, raw: null };
      }
      seenFile = true;
      const raw = readFileSync(file, "utf8");
      const record = JSON.parse(raw);
      const mutation = record?.lastMutation;
      if (!Number.isSafeInteger(record?.revision) || record.revision < 1 || !validState(record.state) ||
          typeof record.updatedAt !== "string" || !Number.isFinite(Date.parse(record.updatedAt)) ||
          !mutation || typeof mutation.id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(mutation.id) ||
          mutation.revision !== record.revision - 1 || mutation.hash !== fingerprint(record.state))
        throw new Error("Invalid stored progress");
      return { record, raw };
    } catch { failed = true; throw unavailable(); }
  }

  function atomicWrite(target, content) {
    const temp = `${target}.${randomUUID()}.tmp`;
    let fd;
    try {
      fd = openSync(temp, "wx", 0o600);
      writeFileSync(fd, content, "utf8");
      fsyncSync(fd);
      closeSync(fd); fd = undefined;
      renameSync(temp, target);
      const dirFd = openSync(root, "r");
      try { fsyncSync(dirFd); } finally { closeSync(dirFd); }
    } finally {
      if (fd !== undefined) closeSync(fd);
      if (existsSync(temp)) unlinkSync(temp);
    }
  }
  return {
    contains: (path) => path === root || path.startsWith(root + sep),
    get: () => envelope(read().record),
    put({ revision, state, mutationId }) {
      const { record, raw } = read();
      const hash = fingerprint(state);
      if (record.lastMutation?.id === mutationId) {
        const identical = record.lastMutation.revision === revision && record.lastMutation.hash === hash;
        return { status: identical ? 200 : 409, envelope: envelope(record) };
      }
      if (record.revision !== revision) return { status: 409, envelope: envelope(record) };
      // An old open tab must never replace a migrated multi-wave library.
      if (record.state?.version === 2 && state.version !== 2)
        return { status: 409, envelope: envelope(record) };
      if (revision === Number.MAX_SAFE_INTEGER) throw unavailable();
      const next = { revision: revision + 1, state, updatedAt: new Date().toISOString(),
        lastMutation: { id: mutationId, revision, hash } };
      try {
        if (raw !== null) atomicWrite(backup, raw);
        atomicWrite(file, JSON.stringify(next) + "\n");
        seenFile = true;
      } catch { failed = true; throw unavailable(); }
      return { status: 200, envelope: envelope(next) };
    },
  };
}
