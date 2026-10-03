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
import { useTutor } from "./TutorContext.jsx";
import NounComparison from './NounComparison.jsx';
import { submittedAnswer, answerFeedback, sessionAccuracy } from './answer-feedback.js';
import { firstWordContent } from './first-word-content.js';
import Outpost, { MissionHUD } from "./Outpost.jsx";
import {
  freshGame,
  gameStatus,
  selectBuild,
  constructBuild,
  checkpointGame,
} from "./game.js";
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
  Speech,
  MemoryCard,
} from "./components.jsx";

function MissionResults({ session, accuracy, repairs }) {
  return <section className="mission-results" aria-label="Last mission results">
    <p>Last mission: {accuracy.correct} correct answers · {accuracy.wrong} to review · {accuracy.guided} correct with guidance.</p>
    <p>{session.correct} independent successes · {repairs} repairs queued. Correct practice answers still count as correct; later independent recall builds mastery.</p>
    {accuracy.wrong > 0 && <section aria-label="Review wrong answers">
      <h2>{session.kind === 'exam' ? 'Inspection corrections' : 'Let’s review the wrong answers'}</h2>
      {session.mistakes.filter(a => !a.correct).map((a, i) => <article key={i}>
        <div className="answer-comparison">
          <div><span>You wrote</span><s>{a.input || 'No answer entered'}</s></div>
          <div><span>Correct answer</span><strong lang={a.type === 'meaning' ? 'en' : 'de'}>{a.expected}</strong></div>
        </div>
        <p>{a.message}</p>
      </article>)}
    </section>}
  </section>;
}

function WaveStudy({ state, update, next }) {
  const t = useTutor(), a = state.active, q = a.queue[0], w = t.BY_ID[q.wordId];
  const lesson = t.missingTeaching(state), spec = t.describe(q), exam = a.kind === 'exam';
  const feedback = a.feedback && !exam ? answerFeedback(a.feedback) : null;
  if (q.type === 'teach') return <section className="wave-study lesson-panel teaching">
    <p>Meet your new word · teaching, no score</p><h1>{w.german}</h1><p>{w.english} · {w.kind}</p>
    {w.assessedFormVariants !== undefined && <p>Test focus: learn <strong>{w.german}</strong> as assigned, including its article. Other noun forms are optional—not tested and not required to build your village.</p>}
    <Speech text={w.german} />
    <MemoryCard word={w} />
    {w.memory?.scene && <Speech text={w.memory.scene} lang="en-US" label="Hear memory link" caption="Hear memory link" />}
    {w.memory?.watch && <Speech text={w.memory.watch} lang="en-US" label="Hear spelling tip" caption="Hear spelling tip" />}
    <p>{w.memory?.recall}</p>
    {w.memory?.recall && <Speech text={w.memory.recall} lang="en-US" label="Hear recall cue" caption="Hear recall cue" />}
    <section className="first-word-examples" aria-label="Learn the word and all its forms">{firstWordContent(w).map((page, i) => <article key={i}>
      <h2>{page.label}</h2><p>{page.prompt}</p><strong lang="de">{page.answer}</strong><p>{page.translation}</p>
      <Speech text={page.answer} caption="Hear German example" />
      <p>{page.explanation}</p><Speech text={page.explanation} lang="en-US" label="Hear English explanation" caption="Hear explanation" />
    </article>)}</section>
    <Primary onClick={() => update((s) => {
      let nextState = s;
      for (let step = 1; step < t.teachingPages(w, q).length; step++) nextState = t.setTeachingStep(nextState, step);
      return t.advance(nextState);
    })}>Hide card and practice</Primary>
  </section>;
  if (lesson) return <section className="wave-study lesson-panel teaching">
    <h1>{lesson.label}: {w.german}</h1><p>{lesson.prompt}</p>
    <p className="guided-answer">{lesson.answer}</p><Speech text={lesson.answer} />
    <p>{lesson.translation || w.english}</p><p>{lesson.explanation || w.tip}</p>
    <Speech text={lesson.explanation || w.tip} lang="en-US" label="Hear English explanation" caption="Hear explanation" />
    <NounComparison word={w} Speech={Speech} />
    <p>{w.memory?.scene}</p><p>{w.memory?.watch}</p>
    <p>Guided practice first. A later spaced answer can strengthen this target.</p>
    <Primary onClick={() => update((s) => t.acknowledgeTeaching(s))}>Hide answer and practice</Primary>
  </section>;
  return <section className="wave-study lesson-panel">
    <p>{exam ? `Final inspection · ${a.answers.length + (a.feedback ? 0 : 1)}/${a.initialCount} · answers hidden until the end` : `Mission challenge ${a.answers.length + (a.feedback ? 0 : 1)} of up to 6`}</p>
    <h1>{spec.title}</h1><p>{spec.translation}</p><p>{spec.instruction}</p>
    {!a.feedback ? <>
      {a.helped && <div className="guided-answer">{spec.answer}<p>{spec.explanation}</p></div>}
      <form onSubmit={(e) => { e.preventDefault(); const answer = submittedAnswer(e.currentTarget, a.draft); if (answer.trim()) update((s) => t.answerQuestion(s, answer)); }}>
        <label htmlFor="wave-answer">{q.type === 'meaning' ? 'English meaning' : 'German answer'}</label>
        <input id="wave-answer" name="answer" key={a.completed} autoFocus autoComplete="off" autoCorrect="off" autoCapitalize="none" maxLength={200} spellCheck={false} value={a.draft} onChange={(e) => update((s) => t.setDraft(s, e.target.value))} />
        <Primary type="submit">Check answer</Primary>
      </form>
      {!exam && <button className="text-button" onClick={() => update((s) => t.useHint(s))}>Show help (guided practice)</button>}
    </> : exam ? <><p>Answer recorded.</p><Primary onClick={next}>Continue inspection</Primary></> : <>
      <p role="status"><strong>{feedback.title}</strong> {feedback.note}</p>
      {!a.feedback.correct ? <section className="answer-comparison" aria-label="Your answer and the correction">
        <div><span>You wrote</span><s>{feedback.input}</s></div>
        <div><span>Correct answer</span><strong lang={q.type === 'meaning' ? 'en' : 'de'}>{feedback.expected}</strong></div>
      </section> : <p className="guided-answer">{a.feedback.expected}</p>}
      <p>{a.feedback.message}</p>
      {!a.feedback.correct && <><Speech text={spec.explanation} lang="en-US" label="Hear English explanation" caption="Hear explanation" /><NounComparison word={w} Speech={Speech} /></>}
      {t.correctionNeeded(state) && <><label htmlFor="wave-correction">Copy the correct answer once (practice only)</label><input id="wave-correction" value={a.correction} autoComplete="off" spellCheck={false} onChange={(e) => update((s) => t.setCorrection(s, e.target.value))} /></>}
      <Primary disabled={!t.correctionReady(state)} onClick={next}>{a.queue.length === 1 ? 'Finish mission' : 'Next challenge'}</Primary>
    </>}
  </section>;
}

function WaveCoverage({ learning }) {
  return <details className="village-categories"><summary>Learning coverage · {learning.percent}% complete</summary><p>Two spaced independent answers per target. Verification adds delayed recall and final inspection.</p><dl>{Object.entries(learning.categories).map(([key, c]) => <React.Fragment key={key}><dt>{key === 'form' ? 'Forms' : key[0].toUpperCase() + key.slice(1)} ({c.weight}%)</dt><dd>{c.earned} of {c.possible} evidence steps</dd></React.Fragment>)}</dl></details>;
}

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
export default function App({
  initialState,
  onStateChange,
  onStudyAction,
  onStudyEnabled,
  onLibrary,
  onParent,
  wave,
  onExportLibrary,
}) {
  const {
    scoringV2,
    WORDS,
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
    acknowledgeTeaching,
    dueAt,
    summary,
    STORAGE_KEY,
  } = useTutor();
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
  const [outpostOpen, setOutpostOpen] = useState(false);
  const learning = { ...summary(state), total: WORDS.length };
  const lastSession = state.sessions.at(-1);
  const lastAccuracy = lastSession ? sessionAccuracy(lastSession) : null;
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    if (blocked || conflict) return;
    onStateChange?.(state);
    if (initialState) {
      setSaved(true);
      return;
    }
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
    if (initialState) return;
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
      const nextState = fn(state);
      if (nextState !== state) {
        setState(nextState);
        onStudyAction?.(state, nextState);
      }
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
    if (onExportLibrary) {
      onExportLibrary();
      return;
    }
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
    inExam || (!scoringV2 && state.active?.phase === 4 && state.active?.kind === "course");
  const checkpoint =
    !wordbankLocked &&
    !state.active?.feedback &&
    gameStatus(state.game || freshGame()).readyCheckpoint;
  const showOutpost =
    !blocked && !conflict && !paused && (outpostOpen || checkpoint);
  function changeGame(fn) {
    if (!blocked && !conflict)
      setState((s) => ({ ...s, game: fn(s.game || freshGame()) }));
  }
  function returnToMission() {
    update((s) => {
      const nextState = { ...s, game: checkpointGame(s.game || freshGame()) };
      return !s.active && dueAt(s) <= Date.now()
        ? startSession(nextState, Date.now(), "course")
        : nextState;
    });
    setOutpostOpen(false);
  }
  useEffect(() => {
    onStudyEnabled?.(
      !!state.active &&
        !paused &&
        !modal &&
        !blocked &&
        !conflict &&
        !showOutpost,
    );
    return () => onStudyEnabled?.(false);
  }, [
    !!state.active,
    paused,
    modal,
    blocked,
    conflict,
    showOutpost,
    onStudyEnabled,
  ]);
  return (
    <div className={`game-shell ${carMode ? "car-mode" : "standard-mode"}`}>
      <a href="#main" className="skip-link">
        Skip to lesson
      </a>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">W</span>
          <div>
            <strong>Wortwerk</strong>
            <span>{wave?.title || "Your German tutor"}</span>
          </div>
        </div>
        <div className="header-actions">
          <button className="nav-button" data-navigation onClick={onLibrary}>
            Waves
          </button>
          <button
            className="nav-button"
            data-navigation
            disabled={wordbankLocked}
            onClick={() => {
              update((s) => visitWordbank(s));
              onParent?.();
            }}
          >
            Parent dashboard
          </button>
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
      <main
        id="main"
        className={`workspace ${showOutpost ? "outpost-workspace" : "mission-workspace"}`}
      >
        {!showOutpost && <MissionHUD
          game={state.game}
          learning={learning}
          locked={wordbankLocked || blocked || conflict || paused}
          onOpen={() => setOutpostOpen(true)}
          onBuild={(id) => changeGame((g) => constructBuild(g, id, learning))}
        />}
        <div className="main-column">
          {!showOutpost && (
            <>
              {scoringV2 ? <WaveCoverage learning={learning} /> : <SessionHeader state={state} />}
            </>
          )}
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
          ) : showOutpost ? (
            <>
            {scoringV2 && !state.active && lastSession && <MissionResults session={lastSession} accuracy={lastAccuracy} repairs={learning.repairs.length} />}
            <Outpost
              game={state.game}
              learning={learning}
              checkpoint={checkpoint}
              active={!!state.active}
              onSelect={(id) => changeGame((g) => selectBuild(g, id))}
              onBuild={(id) => changeGame((g) => constructBuild(g, id, learning))}
              onContinue={returnToMission}
              onPractice={() => begin('extra')}
              onWorkshop={() => begin('course')}
            />
            </>
          ) : state.active ? (
            scoringV2 ? <WaveStudy state={state} update={update} next={next} /> : <Tutor
              state={state}
              onAdvance={next}
              onAnswer={(input) => update((s) => answerQuestion(s, input))}
              onDraft={(value) => update((s) => setDraft(s, value))}
              onHint={() => update((s) => useHint(s))}
              onCorrection={(value) => update((s) => setCorrection(s, value))}
              carMode={carMode}
              onTeachStep={(step) => update((s) => setTeachingStep(s, step))}
              onLearnPrerequisite={() => update((s) => acknowledgeTeaching(s))}
              onCorrecting={() => update((s) => startCorrection(s))}
            />
          ) : (
            scoringV2 ? <section className="home">
              <h1>{learning.complete ? 'Every target verified. Your village is complete.' : learning.initialComplete ? 'Final inspection and later recall' : 'Your next village mission'}</h1>
              <p>Up to six planned challenges. Independent successes and repairs are counted separately.</p>
              {lastSession && <MissionResults session={lastSession} accuracy={lastAccuracy} repairs={learning.repairs.length} />}
              {!learning.complete && <>
                {now < dueAt(state) ? <p>Delayed recall available {new Date(dueAt(state)).toLocaleString()}. Waiting carries no penalty.</p> : <Primary onClick={() => begin('course')}>{learning.initialComplete ? 'Start inspection / targeted recheck' : 'Recommended mission'}</Primary>}
                {!learning.initialComplete && <div className="village-mission-choices"><button onClick={() => begin('extra')}>Spelling expedition</button><button onClick={() => begin('course')}>Sentence workshop</button></div>}
              </>}
            </section> : <Home
              state={state}
              now={now}
              onStart={begin}
              onProgress={openProgress}
            />
          )}
        </div>
        {!scoringV2 && <Route state={state} now={now} />}
      </main>
      <footer>
        <span>
          <Check size={14} />
          {WORDS.length} words · No account needed
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
            <>{scoringV2 && <WaveCoverage learning={learning} />}<Progress
              state={state}
              onExport={exportData}
              onImport={onExportLibrary ? undefined : importData}
              onReset={onExportLibrary ? undefined : reset}
              damaged={blocked}
            /></>
          ) : (
            scoringV2 ? <p>Meaning 20%, spelling 40%, every sentence 20%, every form 10%, verification 10%. Each target needs two independent answers with three other questions between exposures. Guided answers and immediate retries earn no evidence. Independent misses remove one step from that target; repairs restore it later. Verification requires spelling after eight hours and a final spelling plus usage/form inspection for each word. Upgrades happen automatically every 4%.</p> : <Help />
          )}
        </Modal>
      )}
    </div>
  );
}
