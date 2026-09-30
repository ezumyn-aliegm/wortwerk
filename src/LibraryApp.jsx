import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import App from "./App.jsx";
import ParentDashboard from "./ParentDashboard.jsx";
import { TutorContext } from "./TutorContext.jsx";
import { createTutor } from "./tutor.js";
import { memoryForWord, wordForStudy } from "./memory.js";
import { STORAGE_KEY } from "./engine.js";
import { recordActivity } from "./activity.js";
import { activeSeconds, timeSegments } from "./study-clock.js";
import {
  serializeBackup, parseLibraryBackup, importWave, replaceWaveProgress,
  parentLocked, prepareParentView, emptyStudyClock, touchStudyClock,
} from "./library-state.js";
import {
  LIBRARY_KEY,
  migrateLibrary,
  recommendedWave,
  wavePlan,
  waveStatus,
  formatDeadline,
  miamiInput,
  parseMiami,
} from "./library.js";
import "./waves.css";

const NON_STUDY_CONTROLS = "[data-navigation], .header-actions, footer, .outpost-screen, .mission-hud";

function download(value, name) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(
    new Blob([typeof value === "string" ? value : serializeBackup(value)], { type: "application/json" }),
  );
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function load(initialState) {
  if (initialState) return { library: migrateLibrary(initialState) };
  try {
    const raw =
      localStorage.getItem(LIBRARY_KEY) || localStorage.getItem(STORAGE_KEY);
    return { library: migrateLibrary(raw ? JSON.parse(raw) : undefined) };
  } catch {
    return {
      error:
        "The saved session could not be read. Nothing has been overwritten. Download the saved file before restoring a backup.",
    };
  }
}
export default function LibraryApp({
  initialState,
  onStateChange,
  lastSyncedAt,
}) {
  const [loaded] = useState(() => load(initialState));
  const [library, renderLibrary] = useState(loaded.library);
  const latest = useRef(library);
  const savedLibrary = useRef(null);
  const replacementEpoch = useRef(0);
  const writeBlocked = useRef(false);
  useEffect(() => {
    writeBlocked.current = false;
    return () => { writeBlocked.current = true; };
  }, []);
  const [receivedState, setReceivedState] = useState(initialState);
  const [screen, setScreen] = useState(() =>
    loaded.library?.waves.find((w) => w.id === loaded.library.selectedWaveId)
      ?.progress.active
      ? "lesson"
      : "waves",
  );
  const [error, setError] = useState(loaded.error || "");
  const [saveError, setSaveError] = useState(false);
  const [saveAttempt, setSaveAttempt] = useState(0);
  const [conflict, setConflict] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [lessonKey, setLessonKey] = useState(0);
  const lessonEpoch = useRef(0);
  const [editing, setEditing] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const fileRef = useRef(null),
    restoreRef = useRef(null);
  const clock = useRef(emptyStudyClock());
  const persistLibrary = useCallback((value) => {
    try {
      if (onStateChange) onStateChange(value);
      else localStorage.setItem(LIBRARY_KEY, serializeBackup(value));
      savedLibrary.current = value;
      setSaveError(false);
    } catch {
      savedLibrary.current = null;
      clock.current = emptyStudyClock(Date.now());
      setSaveError(true);
    }
  }, [onStateChange]);
  const setLibrary = useCallback((update) => {
    if (writeBlocked.current) return latest.current;
    const next = typeof update === "function" ? update(latest.current) : update;
    if (next === latest.current) return next;
    latest.current = next;
    renderLibrary(next);
    // Publish edits before an outstanding remote read can replace a clean save.
    persistLibrary(next);
    return next;
  }, [persistLibrary]);
  // Adopt remote data without unmounting the parent's screen or its filters.
  // Updating our own state during render prevents an old child effect from
  // publishing the previous library between receipt and adoption.
  if (initialState !== receivedState) {
    replacementEpoch.current++;
    setReceivedState(initialState);
    const incoming = migrateLibrary(initialState);
    latest.current = incoming;
    renderLibrary(incoming);
    clock.current = emptyStudyClock(Date.now());
    lessonEpoch.current++;
    setLessonKey(lessonEpoch.current);
  }
  const selected = library?.waves.find((w) => w.id === library.selectedWaveId);
  const tutor = useMemo(
    () =>
      selected
        ? {
            ...createTutor(selected.words.map(w => wordForStudy(w, selected.id)), { deadlineAt: selected.dueAt }),
            MEMORY: Object.fromEntries(
              selected.words.map((w) => [w.id, memoryForWord(w, selected.id)]),
            ),
          }
        : null,
    [selected?.id, selected?.words, selected?.dueAt],
  );
  const emit = useCallback(
    (event) =>
      setLibrary((prev) =>
        prev
          ? { ...prev, activity: recordActivity(prev.activity, event) }
          : prev,
      ),
    [setLibrary],
  );
  const engage = useCallback(
    (waveId, extra = {}) => {
      const at = Date.now(),
        c = clock.current;
      if (
        !c.sessionId ||
        c.waveId !== waveId ||
        at - c.lastInteraction > 5 * 60000
      ) {
        c.sessionId = crypto.randomUUID();
        c.accountedAt = at;
      }
      c.waveId = waveId;
      c.lastInteraction = at;
      if (!c.accountedAt) c.accountedAt = at;
      emit({
        id: crypto.randomUUID(),
        sessionId: c.sessionId,
        waveId,
        at,
        kind: "engage",
        ...extra,
      });
    },
    [emit],
  );
  const enabled = useCallback((value) => {
    if (clock.current.enabled !== value) {
      clock.current.enabled = value;
      clock.current.accountedAt = Date.now();
    }
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      const at = Date.now(),
        c = clock.current;
      setNow(at);
      const seconds = activeSeconds(c, at, {
        visible: document.visibilityState === "visible",
        focused: document.hasFocus(),
      });
      const end = Math.min(at, c.lastInteraction + 90000);
      if (seconds > 0)
        for (const part of timeSegments(end - seconds * 1000, end))
          emit({
            id: crypto.randomUUID(),
            sessionId: c.sessionId,
            waveId: c.waveId,
            kind: "time",
            ...part,
          });
      c.accountedAt = at;
    }, 10000);
    const hide = () => {
      clock.current.accountedAt = Date.now();
      if (document.visibilityState !== "visible" || !document.hasFocus())
        clock.current.lastInteraction = 0;
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("blur", hide);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("blur", hide);
    };
  }, [emit]);
  useEffect(() => {
    const current = latest.current;
    if (!current || conflict) return;
    if (savedLibrary.current !== current) persistLibrary(current);
  }, [library, conflict, persistLibrary, saveAttempt]);
  useEffect(() => {
    if (onStateChange) return;
    const listener = (e) => {
      if (e.key === LIBRARY_KEY) {
        writeBlocked.current = true;
        setConflict(true);
        enabled(false);
      }
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, [onStateChange, enabled]);
  const changeProgress = useCallback((progress) => {
    if (lessonEpoch.current !== lessonKey) return;
    setLibrary((prev) => replaceWaveProgress(prev, selected.id, progress));
  }, [selected?.id, lessonKey, setLibrary]);
  const studyEnabled = useCallback((value) => {
    if (lessonEpoch.current === lessonKey) enabled(value);
  }, [lessonKey, enabled]);
  const studyAction = useCallback(
    (before, after) => {
      if (lessonEpoch.current !== lessonKey) return;
      const waveId = selected.id;
      // Capture the current answer/draft before navigation can unmount App.
      changeProgress(after);
      if (after.totalSteps > before.totalSteps) {
        const answer = after.active?.answers.at(-1),
          q = before.active?.queue[0];
        if (answer)
          engage(waveId, {
            kind: "answer",
            wordId: answer.wordId,
            type: answer.type,
            correct: answer.correct,
            assisted: answer.assisted,
            retry: q?.retry || 0,
            input: answer.input,
            expected: answer.expected,
          });
      } else if (before.active !== after.active) engage(waveId);
    },
    [selected?.id, lessonKey, changeProgress, engage],
  );
  function go(page) {
    if (page === "parent") {
      if (parentLocked(latest.current)) {
        setError("Finish the saved memory checks in every wave before opening parent answers.");
        return;
      }
      setLibrary((prev) => prepareParentView(prev));
    }
    clock.current = emptyStudyClock(Date.now());
    lessonEpoch.current++;
    setLessonKey(lessonEpoch.current);
    setScreen(page);
  }
  function openWave(wave, autoStart = false) {
    clock.current = emptyStudyClock(Date.now());
    wave = latest.current.waves.find((w) => w.id === wave.id);
    const next =
      autoStart && !wave.progress.active
        ? createTutor(wave.words, { deadlineAt: wave.dueAt }).startSession(
            wave.progress,
            Date.now(),
            wavePlan(wave).kind,
          )
        : wave.progress;
    setLibrary((prev) => ({
      ...prev,
      selectedWaveId: wave.id,
      waves: prev.waves.map((w) =>
        w.id === wave.id ? { ...w, progress: next } : w,
      ),
    }));
    if (next !== wave.progress) engage(wave.id);
    lessonEpoch.current++;
    setLessonKey(lessonEpoch.current);
    setScreen("lesson");
  }
  function exportLibrary() {
    download(latest.current, "wortwerk-all-waves-backup.json");
  }
  function noteInputActivity(event) {
    if (!event.target.closest("input, textarea") || event.target.closest(NON_STUDY_CONTROLS)) return;
    // Capture must not render or persist before the control's own handler runs.
    // Draft changes and button actions record visits through onStudyAction.
    touchStudyClock(clock.current, selected.id, Date.now());
  }
  async function addWave(file) {
    const epoch = replacementEpoch.current;
    try {
      await importWave(file, setLibrary, crypto.randomUUID(), () =>
        !writeBlocked.current && replacementEpoch.current === epoch,
      );
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  async function restore(file) {
    const epoch = replacementEpoch.current;
    try {
      const value = parseLibraryBackup(await file.text());
      if (writeBlocked.current || replacementEpoch.current !== epoch)
        throw new Error("The saved library changed while the backup was loading. Choose the backup again; nothing was replaced.");
      if (
        !window.confirm(
          "Replace ALL waves and statistics with this backup? Download your current backup first.",
        )
      )
        return;
      if (latest.current)
        localStorage.setItem(
          "wortwerk.before-restore.v2",
          serializeBackup(latest.current),
        );
      else
        localStorage.setItem(
          "wortwerk.unreadable-backup.v2",
          localStorage.getItem(LIBRARY_KEY) ||
            localStorage.getItem(STORAGE_KEY) ||
            "",
        );
      replacementEpoch.current++;
      setLibrary(value);
      setError("");
      setConflict(false);
      go("waves");
    } catch (e) {
      setError(
        e.message || "Could not restore. Your previous save is unchanged.",
      );
    }
  }
  if (conflict)
    return (
      <main className="wave-shell">
        <h1>Another tab has newer work.</h1>
        <p>This tab is paused. Close the other tab, then reload.</p>
        <button onClick={() => location.reload()}>
          Reload latest progress
        </button>
        <button onClick={exportLibrary}>Download this copy</button>
      </main>
    );
  if (saveError)
    return (
      <main className="wave-shell">
        <h1>Keep this tab open: progress is not saved.</h1>
        <p role="alert">Practice is paused. Download your complete backup before leaving, or free browser storage and retry.</p>
        <button onClick={exportLibrary}>Download all-waves backup</button>
        <button onClick={() => setSaveAttempt((n) => n + 1)}>Retry saving</button>
      </main>
    );
  if (!library)
    return (
      <main className="wave-shell">
        <h1>Protect your saved session</h1>
        <p role="alert">{error}</p>
        <button
          onClick={() =>
            download(
              localStorage.getItem(LIBRARY_KEY) ||
                localStorage.getItem(STORAGE_KEY),
              "wortwerk-unreadable-backup.json",
            )
          }
        >
          Download saved file
        </button>
        <label>
          Restore a backup
          <input
            type="file"
            accept=".json"
            onChange={(e) => e.target.files[0] && restore(e.target.files[0])}
          />
        </label>
      </main>
    );
  const recommendation = recommendedWave(library, now),
    plan = wavePlan(recommendation, now);
  const locked = parentLocked(library);
  return (
    <>
      {error && (
        <div className="sync-warning" role="alert">
          {error} <button onClick={exportLibrary}>Download backup</button>
        </div>
      )}
      {screen !== "lesson" && (
        <header className="wave-nav">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              go("waves");
            }}
          >
            <span className="brand-mark">W</span> Wortwerk
          </a>
          <nav aria-label="Family navigation">
            <button
              aria-current={screen === "waves" ? "page" : undefined}
              onClick={() => go("waves")}
            >
              Vocabulary waves
            </button>
            <button
              disabled={locked}
              aria-current={screen === "parent" ? "page" : undefined}
              onClick={() => go("parent")}
            >
              Parent dashboard
            </button>
            <button onClick={exportLibrary}>Backup</button>
          </nav>
        </header>
      )}
      {screen === "parent" ? (
        <>
          {locked && (
            <p className="sync-warning" role="status">
              Parent answers are hidden until every saved final rehearsal and cold recall check is finished.
            </p>
          )}
          <div hidden={locked}>
            <ParentDashboard
              library={library}
              now={now}
              lastSyncedAt={lastSyncedAt}
            />
          </div>
        </>
      ) : screen === "lesson" ? (
        <>
          <div className="wave-deadline">
            <strong>{selected.title}</strong>
            <span>Due {formatDeadline(selected.dueAt)} · Miami time</span>
            <span>{waveStatus(selected, now)}</span>
          </div>
          <div
            onPointerDownCapture={noteInputActivity}
            onKeyDownCapture={(e) => {
              if (!e.repeat) noteInputActivity(e);
            }}
            onClick={(e) => {
              if (
                clock.current.enabled &&
                e.target.closest(".speech button") &&
                !e.target.closest(NON_STUDY_CONTROLS)
              )
                engage(selected.id);
            }}
          >
            <TutorContext.Provider value={tutor}>
              <App
                key={`${selected.id}-${lessonKey}`}
                initialState={selected.progress}
                onStateChange={changeProgress}
                onStudyAction={studyAction}
                onStudyEnabled={studyEnabled}
                onLibrary={() => go("waves")}
                onParent={() => go("parent")}
                wave={selected}
                onExportLibrary={exportLibrary}
              />
            </TutorContext.Provider>
          </div>
        </>
      ) : (
        <main className="wave-shell">
          <section className="wave-hero">
            <span className="eyebrow">YOUR WORDCRAFT EXPEDITION</span>
            <h1>Learn words. Build your world.</h1>
            <p>
              Build a word, try it from memory, and earn blocks for your island.
              Six answers make a mission. I’ll choose what you practice next.
            </p>
            <div className="wave-recommendation">
              <div>
                <span className="eyebrow">
                  RECOMMENDED · {waveStatus(recommendation, now)}
                </span>
                <h2>{recommendation.title}</h2>
                <p>Due {formatDeadline(recommendation.dueAt)} · Miami time</p>
                <p>{plan.message}</p>
                {plan.tight && (
                  <details className="wave-caution"><summary>Parent scheduling note</summary>
                    There’s a lot left for the time available. Focus on weak
                    spellings; readiness is not guaranteed.
                  </details>
                )}
              </div>
              <button
                className="primary"
                onClick={() => openWave(recommendation, true)}
              >
                {recommendation.progress.active
                  ? "Resume my lesson"
                  : "Start my mission"}{" "}
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </section>
          <section aria-labelledby="waves-title">
            <div className="wave-section-title">
              <h2 id="waves-title">Your vocabulary waves</h2>
              <span>
                {library.waves.length} saved · progress never resets when you
                add one
              </span>
            </div>
            <div className="wave-grid">
              {library.waves.map((wave) => {
                const stats = createTutor(wave.words).summary(wave.progress),
                  schedule = wavePlan(wave, now);
                return (
                  <article className="wave-card" key={wave.id}>
                    <div className="wave-card-heading">
                      <h3>{wave.title}</h3>
                      <span
                        className={`wave-badge ${waveStatus(wave, now) === "Past due" ? "past" : ""}`}
                      >
                        {waveStatus(wave, now)}
                      </span>
                    </div>
                    <p className="wave-date">
                      {formatDeadline(wave.dueAt)} · Miami
                    </p>
                    <p>
                      <strong>
                        {stats.ready} / {wave.words.length}
                      </strong>{" "}
                      words remembered after a gap
                    </p>
                    <progress
                      max="100"
                      value={stats.percent}
                      aria-label={`${wave.title} learning evidence`}
                    />
                    <p className="fine">
                      {stats.introduced} introduced · {wave.progress.totalSteps}{" "}
                      answers · {Math.max(0, wave.words.length - stats.ready)}{" "}
                      still need evidence
                    </p>
                    <ol className="wave-plan">
                      {schedule.steps.map((step) => (
                        <li key={step.title}>
                          <span>
                            {step.done ? "✓" : "○"} {step.title}
                          </span>
                          <small>
                            {step.done
                              ? "Route stage completed"
                              : wave.dueAt <= now
                                ? "Catch up at your pace"
                                : `Aim for ${formatDeadline(step.at)}`}
                          </small>
                        </li>
                      ))}
                    </ol>
                    <div className="wave-card-actions">
                      <button onClick={() => openWave(wave)}>
                        {wave.progress.active
                          ? "Resume saved session"
                          : "Open wave"}
                      </button>
                      <button
                        className="text-button"
                        onClick={() => {
                          setEditing(wave.id);
                          setEditTitle(wave.title);
                          setEditDate(miamiInput(wave.dueAt));
                        }}
                      >
                        Edit name / deadline
                      </button>
                    </div>
                    {wave.progress.active && (
                      <p className="fine">
                        Saved mid-session · {wave.progress.active.completed}{" "}
                        steps completed
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
          {editing && (
            <form
              className="wave-manage"
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  const dueAt = parseMiami(editDate);
                  if (!editTitle.trim()) throw new Error("Enter a wave name.");
                  setLibrary((prev) => ({
                    ...prev,
                    waves: prev.waves.map((w) =>
                      w.id === editing
                        ? { ...w, title: editTitle.trim(), dueAt }
                        : w,
                    ),
                  }));
                  setEditing(null);
                  setError("");
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              <h2>Edit wave</h2>
              <label>
                Name
                <input
                  maxLength={100}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
              </label>
              <label>
                Deadline · Miami time
                <input
                  type="datetime-local"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  required
                />
              </label>
              <div>
                <button type="submit">Save deadline</button>
                <button type="button" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </div>
              <p className="fine">
                Changing the deadline adjusts the plan. It does not erase
                answers or the current session.
              </p>
            </form>
          )}
          <section className="wave-manage">
            <span className="eyebrow">FOR PARENTS</span>
            <h2>Add the next wave</h2>
            <p>
              Import a prepared lesson file with words, examples, exercises,
              memory tricks, and a deadline. Existing waves stay untouched.
            </p>
            <div className="wave-card-actions">
              <button onClick={() => fileRef.current.click()}>
                Import lesson file
              </button>
              <button
                onClick={() =>
                  download(
                    {
                      title: "Example wave — edit before importing",
                      dueAt: "2026-10-05T09:00:00-04:00",
                      words: library.waves[0].words.slice(0, 3),
                    },
                    "wortwerk-lesson-example.json",
                  )
                }
              >
                Download format example
              </button>
              <button onClick={() => restoreRef.current.click()}>
                Restore all-waves backup
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept=".json,application/json"
              onChange={(e) => {
                if (e.target.files[0]) void addWave(e.target.files[0]);
                e.target.value = "";
              }}
            />
            <input
              ref={restoreRef}
              type="file"
              hidden
              accept=".json,application/json"
              onChange={(e) => {
                if (e.target.files[0]) void restore(e.target.files[0]);
                e.target.value = "";
              }}
            />
            <p className="fine">
              One family profile. Parent controls use the same family password,
              not a separate access lock.
            </p>
          </section>
        </main>
      )}
    </>
  );
}
