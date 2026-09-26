import React, { useCallback, useEffect, useRef, useState } from "react";
import App from "./App.jsx";
import {
  SHARED_KEY,
  readLocal,
  fromRemote,
  editLocal,
  prepareUpload,
  acknowledge,
  receiveRemote,
  validateRemote,
} from "./sync.js";
import { prepareOffline } from "./offline.js";
import "./shared.css";

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw Object.assign(
      new Error(data?.error || `Server returned ${response.status}`),
      { status: response.status, data },
    );
  return data;
}
function backup(value, name = "wortwerk-device-backup.json") {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(
    new Blob(
      [typeof value === "string" ? value : JSON.stringify(value, null, 2)],
      { type: "application/json" },
    ),
  );
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 30000);
}
function Panel({ title, children }) {
  return (
    <main className="shared-panel">
      <div className="brand-mark">W</div>
      <h1>{title}</h1>
      {children}
    </main>
  );
}

export default function HostedApp() {
  const [mode, setMode] = useState("loading");
  const [view, setView] = useState(null);
  const [status, setStatus] = useState("Checking saved session…");
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [conflict, setConflict] = useState(null);
  const [tabChanged, setTabChanged] = useState(false);
  const [offline, setOffline] = useState("Preparing offline lesson…");
  const [storageError, setStorageError] = useState(false);
  const local = useRef(null),
    busy = useRef(false),
    conflictRef = useRef(false),
    tabRef = useRef(false),
    authNeeded = useRef(false);
  const persist = useCallback((next, remount = false) => {
    local.current = next;
    try {
      localStorage.setItem(SHARED_KEY, JSON.stringify(next));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
    if (remount)
      setView((v) => ({ state: next.state, key: (v?.key || 0) + 1 }));
  }, []);
  const showConflict = useCallback((remote) => {
    validateRemote(remote);
    conflictRef.current = true;
    setConflict(remote);
    setStatus("Choose which session to continue");
  }, []);
  const synchronize = useCallback(async () => {
    if (
      busy.current ||
      !local.current ||
      conflictRef.current ||
      tabRef.current ||
      authNeeded.current
    )
      return;
    busy.current = true;
    try {
      setStatus("Syncing…");
      if (!local.current.pending) {
        const remote = await request("/api/progress");
        if (tabRef.current) return;
        const result = receiveRemote(local.current, remote);
        if (result.conflict) {
          showConflict(remote);
          return;
        }
        if (!local.current.dirty && remote.revision !== local.current.revision)
          persist(result.local, true);
      }
      if (local.current.dirty) {
        persist(prepareUpload(local.current, crypto.randomUUID()));
        const remote = await request("/api/progress", {
          method: "PUT",
          body: JSON.stringify(local.current.pending),
        });
        if (tabRef.current) return;
        persist(acknowledge(local.current, remote));
      }
      setStatus(
        local.current.dirty
          ? "Saved here · sync pending"
          : "Synced across devices",
      );
      setError("");
    } catch (e) {
      if (tabRef.current) return;
      if (e.status === 409) showConflict(e.data.current || e.data);
      else if (e.status === 401) {
        authNeeded.current = true;
        setStatus("Sign in to sync");
        setMode("login");
      } else if (e.status) {
        setStatus("Saved here · server needs attention");
        setError(
          "The server could not accept this save. Your device copy is safe. Try again or download a backup.",
        );
      } else setStatus("Saved here · offline / waiting to sync");
    } finally {
      busy.current = false;
    }
  }, [persist, showConflict]);
  const loadShared = useCallback(async () => {
    let raw;
    try {
      raw = localStorage.getItem(SHARED_KEY);
      if (raw) local.current = readLocal(raw);
    } catch {
      setError(
        "This browser’s saved session is unreadable. Download it before recovering the server copy.",
      );
      setMode("recovery");
      return;
    }
    if (local.current) {
      setView({ state: local.current.state, key: 1 });
      setMode("shared");
      await synchronize();
      return;
    }
    try {
      const remote = await request("/api/progress");
      persist(fromRemote(remote), true);
      setMode("shared");
      setStatus("Synced across devices");
    } catch (e) {
      if (e.status === 401) {
        authNeeded.current = true;
        setMode("login");
      } else {
        setError(
          "Connect to the home network to load this device’s first session.",
        );
        setMode("unavailable");
      }
    }
  }, [persist, synchronize]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/config", {
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        if (cancelled) return;
        if (response.status === 404) {
          setMode("local");
          return;
        }
        if (!response.ok) throw new Error("Configuration unavailable");
        const config = await response.json();
        if (!config.shared) {
          setMode("local");
          return;
        }
        await loadShared();
      } catch {
        if (cancelled) return;
        let hasLocal = false;
        try {
          hasLocal = !!localStorage.getItem(SHARED_KEY);
        } catch {}
        if (hasLocal) await loadShared();
        else {
          setError(
            "The tutor could not connect. Open it on the home network first.",
          );
          setMode("unavailable");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadShared]);
  useEffect(() => {
    let cleanup,
      disposed = false;
    prepareOffline((message) => {
      if (!disposed)
        setOffline(
          {
            ready: "Lesson ready offline",
            downloading: "Downloading offline lesson…",
            unavailable: "Offline download unavailable · HTTPS required",
          }[message] || message,
        );
    })
      .then((fn) => {
        if (disposed) fn?.();
        else cleanup = fn;
      })
      .catch(() => setOffline("Offline download unavailable"));
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);
  useEffect(() => {
    if (mode !== "shared") return;
    const timer = setInterval(synchronize, 4000);
    const wake = () => synchronize();
    const changed = (e) => {
      if (e.key === SHARED_KEY) {
        tabRef.current = true;
        setTabChanged(true);
      }
    };
    window.addEventListener("online", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("storage", changed);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("storage", changed);
    };
  }, [mode, synchronize]);
  const onChange = useCallback(
    (state) => {
      if (!local.current || conflictRef.current || tabRef.current) return;
      const next = editLocal(local.current, state);
      if (next === local.current) return;
      persist(next);
      setStatus("Saved here · sync pending");
    },
    [persist],
  );
  async function login(event) {
    event.preventDefault();
    setError("");
    try {
      await request("/api/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      authNeeded.current = false;
      setPassword("");
      await loadShared();
    } catch (e) {
      setError(
        e.status === 429
          ? "Too many attempts. Wait a few minutes and try again."
          : e.status === 401
            ? "That password did not match. Try again."
            : "Could not sign in. Check the home network connection.",
      );
    }
  }
  function resolveConflict(useDevice) {
    if (
      !window.confirm(
        useDevice
          ? "Continue with this device’s session? The server’s current session will be kept as a previous-save backup."
          : "Continue with the server session? This device’s current session will be kept as a recovery copy.",
      )
    )
      return;
    try {
      localStorage.setItem(
        "wortwerk.conflict-backup.v1",
        JSON.stringify({ local: local.current, remote: conflict }),
      );
    } catch {
      setError(
        "Could not preserve the recovery copy. Download a backup and free browser storage before choosing.",
      );
      return;
    }
    const next = useDevice
      ? {
          ...local.current,
          revision: conflict.revision,
          pending: null,
          dirty: true,
        }
      : fromRemote(conflict);
    conflictRef.current = false;
    setConflict(null);
    setError("");
    persist(next, true);
    setStatus(
      useDevice ? "Saved here · sync pending" : "Synced across devices",
    );
    void synchronize();
  }
  if (mode === "local") return <App />;
  if (mode === "loading")
    return (
      <Panel title="Opening your tutor…">
        <p>Looking for your latest session.</p>
      </Panel>
    );
  if (mode === "login")
    return (
      <Panel title="Your family’s study space">
        <p>Enter the shared study password. No account needed.</p>
        <form onSubmit={login}>
          <label htmlFor="study-password">Study password</label>
          <input
            id="study-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />
          <button type="submit">Open my tutor</button>
        </form>
        {error && <p role="alert">{error}</p>}
        {local.current && (
          <button
            className="secondary"
              onClick={() => {
                setView((v) => ({state: local.current.state, key: (v?.key || 0) + 1}));
                setMode("shared");
              setStatus("Saved here · sign in needed to sync");
            }}
          >
            Study the saved lesson without syncing
          </button>
        )}
      </Panel>
    );
  if (mode === "recovery")
    return (
      <Panel title="Keep your progress safe">
        <p role="alert">{error}</p>
        <button
          onClick={() =>
            backup(localStorage.getItem(SHARED_KEY), "wortwerk-recovery.json")
          }
        >
          Download unreadable local save
        </button>
        <p>
          The server copy is unchanged. Restore using another browser, or keep
          this file before clearing this site’s browser data.
        </p>
      </Panel>
    );
  if (mode === "unavailable")
    return (
      <Panel title="Let’s reconnect">
        <p role="alert">{error}</p>
        <button onClick={() => location.reload()}>Try again</button>
      </Panel>
    );
  if (tabChanged)
    return (
      <Panel title="Another tab has your session">
        <p>
          This tab is paused so it cannot overwrite newer work. Close the other
          study tab, then reload.
        </p>
        <button onClick={() => location.reload()}>
          Reload latest progress
        </button>
      </Panel>
    );
  if (conflict)
    return (
      <Panel title="Two devices have different work">
        <p>
          No answers have been overwritten. Choose the session you want to
          continue.
        </p>
        <div className="session-comparison">
          <div>
            <strong>This device</strong>
            <p>
              {local.current.state.totalSteps} answers ·{" "}
              {local.current.state.active?.completed || 0} steps in the current
              session
            </p>
          </div>
          <div>
            <strong>Server session</strong>
            <p>
              {conflict.state?.totalSteps || 0} answers ·{" "}
              {conflict.state?.active?.completed || 0} steps in the current
              session
            </p>
          </div>
        </div>
        <button onClick={() => resolveConflict(false)}>
          Continue server session
        </button>
        <button className="secondary" onClick={() => resolveConflict(true)}>
          Continue this device’s session
        </button>
        <button
          className="secondary"
          onClick={() => backup(local.current.state)}
        >
          Download this device’s backup
        </button>
        {error && <p role="alert">{error}</p>}
      </Panel>
    );
  return (
    <>
      <div className="sync-bar">
        <span role="status">{status}</span>
        <span>{offline}</span>
        <button
          onClick={() =>
            authNeeded.current ? setMode("login") : synchronize()
          }
        >
          Sync now
        </button>
        <button onClick={() => backup(local.current.state)}>Backup</button>
      </div>
      {(storageError || error) && (
        <p className="sync-warning" role="alert">
          {storageError
            ? "Browser storage is full or unavailable. Keep this tab open and download a backup before leaving."
            : error}
        </p>
      )}
      {view && (
        <App
          key={view.key}
          initialState={view.state}
          onStateChange={onChange}
        />
      )}
    </>
  );
}
