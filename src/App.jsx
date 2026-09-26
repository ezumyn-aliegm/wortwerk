import React, { useEffect, useState } from "react";
import {
  ChartNoAxesColumnIncreasing,
  Check,
  HelpCircle,
  Monitor,
  Pause,
  Play,
  AlertCircle,
  CarFront,
} from "lucide-react";
import {
  freshState,
  startSession,
  answerQuestion,
  advance,
  setDraft,
  setCorrection,
  useHint,
  visitWordbank,
  setTeachingStep,
  startCorrection,
  STORAGE_KEY,
} from "./engine.js";
import { loadProgress, saveProgress, parseBackup } from "./storage.js";
import {
  Home,
  Tutor,
  Route,
  SessionHeader,
  Modal,
  Progress,
  Help,
  Primary,
} from "./components.jsx";

function download(text, name) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function App({ initialState, onStateChange }) {
  const [carMode, setCarMode] = useState(() => {
    try {
      return localStorage.getItem("wortwerk.carView") !== "false";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("wortwerk.carView", String(carMode));
    } catch {
      /* The layout still works without saved preferences. */
    }
  }, [carMode]);
  const [loaded] = useState(() => {
    if (initialState) return { state: initialState, blocked: false, issue: "" };
    try {
      return loadProgress(window.localStorage);
    } catch {
      return {
        state: freshState(),
        blocked: false,
        issue:
          "Browser storage is unavailable. You can practice, but download a backup before closing.",
      };
    }
  });
  const [state, setState] = useState(loaded.state),
    [blocked, setBlocked] = useState(loaded.blocked);
  const [issue, setIssue] = useState(loaded.issue),
    [saved, setSaved] = useState(false),
    [modal, setModal] = useState(null);
  const [now, setNow] = useState(Date.now()),
    [paused, setPaused] = useState(false),
    [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    if (blocked || conflict) return;
    onStateChange?.(state);
    let success = false;
    try {
      success = saveProgress(localStorage, state);
    } catch {
      /* Storage availability is surfaced below. */
    }
    setSaved(success);
    if (!success)
      setIssue(
        "Progress isn’t saving in this browser. Keep this tab open and download a backup from Progress before leaving.",
      );
  }, [state, blocked, conflict, onStateChange]);
  useEffect(() => {
    const listener = (e) => {
      if (e.key === STORAGE_KEY) setConflict(true);
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 8000);
    return () => clearTimeout(timer);
  }, [notice]);
  function update(fn) {
    if (!blocked && !conflict) {
      setState((prev) => fn(prev));
      setNow(Date.now());
    }
  }
  function begin(kind) {
    update((s) => startSession(s, Date.now(), kind));
    setPaused(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function next() {
    update((s) => advance(s));
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function exportData() {
    let raw = JSON.stringify(state, null, 2);
    if (blocked) {
      try {
        raw = localStorage.getItem(STORAGE_KEY) || raw;
      } catch {
        /* The in-memory fallback can still be downloaded. */
      }
    }
    download(
      raw,
      `wortwerk-progress-${new Date().toISOString().slice(0, 10)}.json`,
    );
    setNotice(
      "Backup requested. Check your browser’s downloads and keep the file somewhere safe.",
    );
  }
  function openProgress() {
    update((s) => visitWordbank(s));
    setModal("progress");
  }
  async function importData(file) {
    try {
      if (file.size > 2_000_000)
        throw new Error("This file is too large for a Wortwerk backup.");
      const imported = parseBackup(await file.text());
      if (
        !window.confirm(
          "Replace this browser’s current progress with the selected backup? Download your current progress first if you want to keep it.",
        )
      )
        return;
      setState(imported);
      setBlocked(false);
      setConflict(false);
      setIssue("");
      setPaused(false);
      setModal(null);
      setNotice("Backup restored. Your tutor is ready to continue.");
    } catch (e) {
      setNotice(
        e.message || "Could not restore that file. Your progress is unchanged.",
      );
    }
  }
  function reset() {
    if (
      !window.confirm(
        "Reset all Wortwerk progress on this browser? Download a backup first if you might want it back.",
      )
    )
      return;
    setState(freshState());
    setBlocked(false);
    setConflict(false);
    setIssue("");
    setPaused(false);
    setModal(null);
    setNotice("Progress reset. Ready for a fresh start.");
  }
  const inExam = state.active?.kind === "exam";
  const wordbankLocked =
    inExam || (state.active?.phase === 4 && state.active?.kind === "course");
  return (
    <div className={carMode ? "car-mode" : "standard-mode"}>
      <a href="#main" className="skip-link">
        Skip to lesson
      </a>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">W</span>
          <div>
            <strong>Wortwerk</strong>
            <span>Your 2-day German tutor</span>
          </div>
        </div>
        <div className="header-actions">
          <button
            className="nav-button car-toggle"
            aria-label="Toggle car view"
            aria-pressed={carMode}
            title="Large, steady layout for a passenger using a Mac"
            onClick={() => setCarMode((value) => !value)}
          >
            <CarFront size={23} />
            <span>Car view {carMode ? "on" : "off"}</span>
          </button>
          {state.active && (
            <button className="nav-button" onClick={() => setPaused((v) => !v)}>
              {paused ? <Play size={17} /> : <Pause size={17} />}
              <span>{paused ? "Resume" : "Pause"}</span>
            </button>
          )}
          <button
            className="nav-button"
            disabled={wordbankLocked}
            onClick={openProgress}
            title={
              wordbankLocked
                ? "Word bank is hidden during this memory check"
                : "See word progress and backups"
            }
          >
            <ChartNoAxesColumnIncreasing size={18} />
            <span>Progress</span>
          </button>
          <span
            className={`save-status ${saved && !blocked && !conflict ? "" : "unsaved"}`}
          >
            <span className="status-dot" />
            {saved && !blocked && !conflict
              ? "Saved on this device"
              : "Check saving"}
          </span>
        </div>
      </header>
      {(issue || conflict) && (
        <div className="storage-warning" role="alert">
          <AlertCircle size={20} />
          <div>
            <strong>
              {conflict
                ? "Progress changed in another tab."
                : "A quick save check"}
            </strong>
            <p>
              {conflict
                ? "This tab is paused to avoid overwriting newer answers. Close the other tab, then reload to continue with the latest save."
                : issue}
            </p>
            {conflict ? (
              <button onClick={() => location.reload()}>
                Reload latest progress
              </button>
            ) : (
              <button onClick={() => setModal("progress")}>
                Open backups & recovery
              </button>
            )}
          </div>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      <main id="main" className="workspace">
        <div className="main-column">
          <SessionHeader state={state} />
          {blocked || conflict ? (
            <section className="paused-panel">
              <Monitor size={34} />
              <h1>Let’s protect your progress.</h1>
              <p>
                Use the save recovery controls above before starting another
                session.
              </p>
            </section>
          ) : paused ? (
            <section className="paused-panel">
              <Pause size={32} />
              <h1>A little breathing room.</h1>
              <p>
                Stretch, look away from the screen, and come back when you’re
                ready. Your exact place is saved.
              </p>
              <Primary onClick={() => setPaused(false)}>
                Resume my session
              </Primary>
              {state.active && (
                <button
                  className="text-button secondary-action"
                  onClick={exportData}
                >
                  Download progress backup
                </button>
              )}
            </section>
          ) : state.active ? (
            <Tutor
              state={state}
              onAdvance={next}
              onAnswer={(input) => update((s) => answerQuestion(s, input))}
              onDraft={(value) => update((s) => setDraft(s, value))}
              onHint={() => update((s) => useHint(s))}
              onCorrection={(value) => update((s) => setCorrection(s, value))}
              carMode={carMode}
              onTeachStep={(step) => update((s) => setTeachingStep(s, step))}
              onCorrecting={() => update((s) => startCorrection(s))}
            />
          ) : (
            <Home
              state={state}
              now={now}
              onStart={begin}
              onProgress={openProgress}
            />
          )}
        </div>
        <Route state={state} now={now} />
      </main>
      <footer>
        <span>
          <Check size={14} />
          27 words · No account needed
        </span>
        <button className="text-button" onClick={() => setModal("help")}>
          How this works <HelpCircle size={15} />
        </button>
      </footer>
      {modal && (
        <Modal
          title={
            modal === "progress"
              ? "Your words, getting stronger"
              : "Meet your study guide"
          }
          onClose={() => setModal(null)}
        >
          {modal === "progress" ? (
            <Progress
              state={state}
              onExport={exportData}
              onImport={importData}
              onReset={reset}
              damaged={blocked}
            />
          ) : (
            <Help />
          )}
        </Modal>
      )}
    </div>
  );
}
