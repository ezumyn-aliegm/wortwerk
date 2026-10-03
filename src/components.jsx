import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Volume2,
  Lightbulb,
  Check,
  BookOpen,
  Clock3,
  X,
  Download,
  Upload,
  RotateCcw,
  ChevronRight,
  Sparkles,
  Moon,
  PencilLine,
} from "lucide-react";
import { SKILL_LABELS, requiredSkills } from "./data.js";
import { useTutor } from "./TutorContext.jsx";

import { CarLesson, CarFeedback } from "./CarLearning.jsx";
import WordForge from "./WordForge.jsx";
import NounComparison from "./NounComparison.jsx";
import { showNounComparison } from "./noun-forms.js";
import audioCatalog from "./audio-catalog.json";
import { audioKey } from "./audio-lines.js";
import { playRecording, stopRecording } from "./recorded-audio.js";
import { learningTargets, targetKey } from './scoring.js';
import { submittedAnswer, sessionAccuracy } from './answer-feedback.js';
import { firstWordContent } from './first-word-content.js';

export function Primary({ children, ...props }) {
  return (
    <button className="primary" {...props}>
      {children}
      <ArrowRight size={19} aria-hidden="true" />
    </button>
  );
}
export function Speech({
  text,
  lang = "de-DE",
  label = "Hear German pronunciation",
  caption,
}) {
  const [message, setMessage] = useState("");
  const audioRef = useRef(null);
  function play() {
    const source = audioCatalog[audioKey(text, lang)];
    if (!source) {
      setMessage("This lesson’s recording is not ready yet. You can keep studying with the text.");
      return;
    }
    setMessage("");
    audioRef.current = playRecording(source, () =>
      setMessage("Audio couldn’t play. Try again when connected, or continue with the text."));
  }
  useEffect(() => {
    setMessage("");
    return () => {
      stopRecording(audioRef.current);
    };
  }, [text, lang]);
  return (
    <div className="speech">
      <button
        className={caption ? "audio-button" : "icon-button"}
        aria-label={label}
        title={label}
        onClick={play}
      >
        <Volume2 size={21} />
        {caption && <span>{caption}</span>}
      </button>
      {message && (
        <p className="audio-note" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
export function Chunks({ word }) {
  const {
    WORDS,
    BY_ID,
    MEMORY,
    phaseInfo,
    summary,
    mastery,
    describe,
    correctionNeeded,
    correctionReady,
    dueAt,
    dayTwoAt,
    delayedReviewAt,
  } = useTutor();
  return (
    <div className="chunks" aria-label={`Spelling chunks for ${word.german}`}>
      <span className="chunk-prefix">
        {word.kind === "noun"
          ? word.german.split(" ")[0]
          : word.kind === "reflexive verb"
            ? "sich"
            : ""}
      </span>
      {MEMORY[word.id].chunks.map((part, i) => (
        <span
          lang="de"
          className={part === " " ? "space-chunk" : "chunk"}
          key={i}
        >
          {part === " " ? "space" : part}
        </span>
      ))}
    </div>
  );
}
export function MemoryCard({ word, compact = false }) {
  const {
    WORDS,
    BY_ID,
    MEMORY,
    phaseInfo,
    summary,
    mastery,
    describe,
    correctionNeeded,
    correctionReady,
    dueAt,
    dayTwoAt,
    delayedReviewAt,
  } = useTutor();
  const trick = MEMORY[word.id];
  return (
    <div className={`memory-box ${compact ? "compact" : ""}`}>
      <div className="memory-title">
        <Lightbulb size={18} />
        <strong>Make a memory link</strong>
      </div>
      <p>{trick.scene}</p>
      <NounComparison word={word} Speech={Speech} />
      <Chunks word={word} />
      <p className="watch">
        <PencilLine size={15} />
        <span>{trick.watch}</span>
      </p>
    </div>
  );
}
export function CharacterKeys({ inputRef, value, onChange }) {
  return (
    <div className="character-keys">
      <span>German keys</span>
      {["ä", "ö", "ü", "ß", "Ä", "Ö", "Ü"].map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Insert ${c}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const input = inputRef.current,
              start = input?.selectionStart ?? value.length,
              end = input?.selectionEnd ?? value.length;
            onChange(value.slice(0, start) + c + value.slice(end));
            requestAnimationFrame(() => {
              input?.focus({ preventScroll: true });
              input?.setSelectionRange(start + 1, start + 1);
            });
          }}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
export function Route({ state, now }) {
  const {
    WORDS,
    BY_ID,
    MEMORY,
    phaseInfo,
    summary,
    mastery,
    describe,
    correctionNeeded,
    correctionReady,
    dueAt,
    dayTwoAt,
    delayedReviewAt,
  } = useTutor();
  const stats = summary(state),
    phase = state.active?.phase ?? state.phase;
  const routes = [
    {
      title: "Meet & remember",
      sub: `3 learning groups · ${WORDS.length} words`,
      min: 0,
      max: 2,
      day: 1,
    },
    {
      title: "Mix it up",
      sub: "Recall, spelling & sentences",
      min: 3,
      max: 3,
      day: 1,
    },
    {
      title: "Check your recall",
      sub: "A fresh start from memory",
      min: 4,
      max: 4,
      day: 2,
    },
    {
      title: "Fix the tricky bits",
      sub: "Chosen from your answers",
      min: 5,
      max: 5,
      day: 2,
    },
    {
      title: "Final rehearsal",
      sub: "Every word, without hints",
      min: 6,
      max: 6,
      day: 2,
    },
  ];
  return (
    <aside className="route">
      <h2>Your route</h2>
      <ol className="route-list">
        {routes.map((r, i) => (
          <React.Fragment key={r.title}>
            {(i === 0 || i === 2) && (
              <li className="day-label">
                {r.day === 1 ? "LEARN" : "RECALL & REHEARSE"}
                {r.day === 2 && state.phase < 4 ? <Moon size={13} /> : null}
              </li>
            )}
            <li
              className={`route-stop ${phase > r.max ? "complete" : phase >= r.min ? "current" : ""}`}
            >
              <span className="route-dot">
                {phase > r.max ? <Check size={13} /> : null}
              </span>
              <div>
                <strong>{r.title}</strong>
                <small>{r.sub}</small>
                {phase >= r.min && phase <= r.max && (
                  <span className="here">You are here</span>
                )}
              </div>
            </li>
          </React.Fragment>
        ))}
      </ol>
      <div className="route-section">
        <h3>Small wins, real memory.</h3>
        <div className="mini-stat">
          <span>Words introduced</span>
          <strong>
            {stats.introduced}
            <em> / {WORDS.length}</em>
          </strong>
        </div>
        <div className="mini-stat">
          <span>Remembered after a gap</span>
          <strong>
            {stats.ready}
            <em> / {WORDS.length}</em>
          </strong>
        </div>
        <div
          className="mastery-bar"
          role="progressbar"
          aria-label="Overall learning evidence"
          aria-valuenow={stats.percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${stats.percent}%` }} />
        </div>
        <p className="fine">
          A word is ready after correct meaning, spelling, usage and relevant
          forms more than once, plus recall after 8 hours.
        </p>
      </div>
      <div className="tutor-note">
        <Sparkles size={19} />
        <p>
          {state.active?.kind === "exam"
            ? "Try each question on your own. I’ll explain your results at the end."
            : "I’ll choose what comes next. You just bring your best try."}
        </p>
      </div>
    </aside>
  );
}
export function SessionHeader({ state }) {
  const {
    WORDS,
    BY_ID,
    MEMORY,
    phaseInfo,
    summary,
    mastery,
    describe,
    correctionNeeded,
    correctionReady,
    dueAt,
    dayTwoAt,
    delayedReviewAt,
  } = useTutor();
  const active = state.active,
    info = phaseInfo(state);
  const done = active?.completed || 0,
    total = active ? done + active.queue.length : 0;
  return (
    <div className="session-header">
      <div>
        <span className="eyebrow">
          STUDY ·{" "}
          {active?.kind === "extra"
            ? "EXTRA PRACTICE"
            : active?.kind === "exam"
              ? "FINAL REHEARSAL"
              : `SESSION ${Math.min(state.phase + 1, 7)}`}
        </span>
        <span className="session-name">
          {active?.kind === "extra" ? "A little extra practice" : info.title}
        </span>
      </div>
      <div className="session-meter">
        <div
          className="meter"
          role="progressbar"
          aria-label="Session progress"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={total || 1}
        >
          <span style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
        <small>
          {active
            ? `${done} ${done === 1 ? "step" : "steps"} complete${active.queue.length > active.initialCount - done ? " · extra practice added" : ""}`
            : `${info.minutes} min · go at your pace`}
        </small>
      </div>
    </div>
  );
}
export function Tutor({
  state,
  onAdvance,
  onAnswer,
  onDraft,
  onHint,
  onCorrection,
  carMode,
  onTeachStep,
  onCorrecting,
  onLearnPrerequisite,
}) {
  const {
    WORDS,
    BY_ID,
    MEMORY,
    phaseInfo,
    summary,
    mastery,
    describe,
    correctionNeeded,
    correctionReady,
    dueAt,
    dayTwoAt,
    delayedReviewAt,
    missingTeaching,
    teachingPages,
  } = useTutor();
  const active = state.active,
    q = active.queue[0],
    word = BY_ID[q.wordId],
    spec = describe(q),
    feedback = active.feedback;
  const prerequisite = missingTeaching(state);
  const lessonPage =
    q.type === "teach" ? teachingPages(word, q)[active.teachingStep || 0] : null;
  const inputRef = useRef(null),
    correctionRef = useRef(null),
    headingRef = useRef(null);
  const exam = active.kind === "exam",
    cold = active.phase === 4 && active.kind === "course";
  useEffect(() => {
    function chooseWithKeyboard(event) {
      if (
        !carMode ||
        prerequisite ||
        q.type !== "meaning" ||
        feedback ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        document.querySelector("dialog[open]")
      )
        return;
      if (["INPUT", "TEXTAREA"].includes(event.target.tagName)) return;
      const index = Number(event.key) - 1;
      if (
        Number.isInteger(index) &&
        index >= 0 &&
        index < spec.options.length
      ) {
        event.preventDefault();
        onAnswer(spec.options[index]);
      }
    }
    document.addEventListener("keydown", chooseWithKeyboard);
    return () => document.removeEventListener("keydown", chooseWithKeyboard);
  }, [carMode, q, feedback, onAnswer, prerequisite]);
  useEffect(() => {
    if (q.type !== "teach" && q.type !== "meaning" && !feedback)
      inputRef.current?.focus({ preventScroll: true });
    else if (correctionNeeded(state))
      correctionRef.current?.focus({ preventScroll: true });
    else headingRef.current?.focus({ preventScroll: true });
  }, [
    active.completed,
    active.teachingStep,
    !!feedback,
    prerequisite?.topic,
    prerequisite?.wordId,
  ]);
  if (prerequisite) {
    const lessonWord = BY_ID[prerequisite.wordId];
    const memory = MEMORY[lessonWord.id];
    return (
      <section className="tutor">
        <h1 ref={headingRef} tabIndex={-1}>
          {exam || cold ? "Let’s learn this first." : "Unlock the next challenge."}
        </h1>
        <p className="lead">
          I won’t test a form before teaching it. Your question and typed answer
          are safely waiting.
        </p>
        <div className="lesson-panel teaching">
          <div className="panel-top">
            <span className="eyebrow">
              {prerequisite.label} · {lessonWord.german}
            </span>
            <Speech text={prerequisite.answer} />
          </div>
          <div className="car-learning-grid">
            <div className="car-sentence">
              {prerequisite.kind === "form" && <p>{prerequisite.prompt}</p>}
              <NounComparison word={lessonWord} Speech={Speech} />
              <strong lang="de">{prerequisite.answer}</strong>
              <p>
                {prerequisite.translation ||
                  (["picture", "spelling"].includes(prerequisite.kind)
                    ? lessonWord.english
                    : "")}
              </p>
              {prerequisite.kind === "spelling" && <Chunks word={lessonWord} />}
            </div>
            <div className="car-memory-side">
              <h3>
                {prerequisite.kind === "picture"
                  ? "Make a memory link"
                  : "Notice the exact answer"}
              </h3>
              <p>
                {prerequisite.kind === "picture"
                  ? memory.scene
                  : prerequisite.kind === "spelling"
                    ? memory.watch
                    : prerequisite.explanation}
              </p>
              <p className="car-coach-note">Say it once. Next, the answer disappears and you try it.
                This is a practice round; I’ll check your memory again later.</p>
            </div>
          </div>
          {(exam || cold) && (
            <p className="input-note">
              This check needs preparation first. Its result will be labeled
              supported practice; a later check can measure independent recall.
            </p>
          )}
          <Primary onClick={onLearnPrerequisite}>
            Hide it — let me try
          </Primary>
        </div>
      </section>
    );
  }
  const labels = {
    teach: q.intro ? "Build it. Then remember it." : "One word. One small win.",
    meaning: "Decode the word.",
    spelling: "Craft the word from memory.",
    usage: "Complete the message.",
    form: "Craft the right form.",
  };
  const tutorText =
    q.type === "teach"
      ? q.revisit
        ? "Let’s take another look. Connect the meaning to the spelling, then say the spelling chunks aloud."
        : q.intro
          ? "Build the word from its pieces. Then use your memory to earn blocks."
          : `First, meet ${word.german}. Read it, make a link, then spell it aloud.`
      : exam
        ? "Take your best shot. Your answers will be checked together at the end."
        : cold
          ? "No review first. Let’s find out what you remember after a break."
          : q.retry
            ? "Here’s that word again. Use the memory link, then try without peeking."
            : q.type === "spelling"
              ? "Use your memory link before typing. Check its letters, dots, and spaces."
              : q.type === "usage"
                ? "Use the English sentence to choose the right German word and ending."
                : q.type === "form"
                  ? "Remember the pattern you learned. The little words matter, too."
                  : "A little warm-up. Pick the meaning that fits.";
  return (
    <section className="tutor">
      <h1 ref={headingRef} tabIndex={-1}>
        {exam ? "Your expedition challenge." : labels[q.type]}
      </h1>
      <p className="lead">
        {q.type === "teach"
          ? "I’ll teach you, then help you remember. Let’s start here."
          : exam
            ? `Question ${active.completed + 1} of ${active.initialCount} · no hints · no rush`
            : "Each try tells me how to help you next."}
      </p>
      <div className="coach">
        <span className="coach-avatar" aria-hidden="true">
          W
        </span>
        <p>{tutorText}</p>
      </div>
      <div
        className={`lesson-panel ${q.type === "teach" ? "teaching" : "question-panel"}`}
      >
        <div className="panel-top">
          <span className="eyebrow">
            {q.type === "teach"
              ? "MEET A NEW WORD"
              : q.type === "spelling"
                ? "ENGLISH → GERMAN"
                : q.type === "usage"
                  ? "SENTENCE PRACTICE"
                  : q.type === "form"
                    ? "GRAMMAR IN ACTION"
                    : "GERMAN → ENGLISH"}
          </span>
          {(q.type === "teach" ||
            q.type === "meaning" ||
            (feedback && !exam)) && (
            <div className="lesson-audio">
              <Speech
                text={q.type === "teach" ? lessonPage.answer : word.german}
                caption={carMode ? "German" : undefined}
              />
              {carMode && q.type === "teach" && (
                <Speech
                  text={
                    ["picture", "discovery"].includes(lessonPage.kind)
                      ? MEMORY[word.id].scene
                      : lessonPage.kind === "spelling"
                        ? MEMORY[word.id].watch
                        : lessonPage.explanation || MEMORY[word.id].watch
                  }
                  lang="en-US"
                  label="Hear the memory tip in English"
                  caption="Hear tip"
                />
              )}
            </div>
          )}
        </div>
        {q.type === "teach" && q.intro ? (
          <WordForge word={word} memory={MEMORY[word.id]} draft={active.draft}
            onDraft={onDraft} onAdvance={onAdvance} Action={Primary} Speech={Speech}
            comparison={<NounComparison word={word} Speech={Speech} />} />
        ) : q.type === "teach" ? (
          <CarLesson
            word={word}
            question={q}
            step={active.teachingStep || 0}
            onStep={onTeachStep}
            onAdvance={onAdvance}
            Action={Primary}
            Chunks={Chunks}
            Comparison={() => <NounComparison word={word} Speech={Speech} />}
          />
        ) : (
          <>
            <div
              className={`question-title ${q.type === "spelling" ? "recall-title" : ""}`}
            >
              <h2 lang={q.type === "usage" ? "de" : undefined}>{spec.title}</h2>
              {spec.translation && <p>{spec.translation}</p>}
              {spec.instruction && <span>{spec.instruction}</span>}
            </div>
            {q.type === "meaning" ? (
              <div className="choices">
                {spec.options.map((option, i) => (
                  <button
                    key={option}
                    disabled={!!feedback}
                    className={`choice ${feedback && option === spec.answer ? "right-choice" : ""} ${feedback && feedback.input === option && !feedback.correct ? "wrong-choice" : ""}`}
                    onClick={() => onAnswer(option)}
                  >
                    <span>{carMode ? i + 1 : String.fromCharCode(65 + i)}</span>
                    {option}
                    {feedback && option === spec.answer && <Check size={18} />}
                  </button>
                ))}
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const answer = submittedAnswer(e.currentTarget, active.draft);
                  if (!feedback && answer.trim()) onAnswer(answer);
                }}
              >
                <label className="answer-label" htmlFor="answer">
                  Your German answer
                </label>
                <input
                  id="answer"
                  name="answer"
                  ref={inputRef}
                  value={active.draft}
                  onChange={(e) => onDraft(e.target.value)}
                  disabled={!!feedback}
                  maxLength={200}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="Type from memory…"
                  aria-describedby="answer-guidance"
                />
                <p id="answer-guidance" className="input-note">
                  Use exact spelling. German keys below add ä, ö, ü and ß.
                </p>
                {!feedback && (
                  <>
                    <CharacterKeys
                      inputRef={inputRef}
                      value={active.draft}
                      onChange={onDraft}
                    />
                    <Primary type="submit" disabled={!active.draft.trim()}>
                      {exam ? "Save answer" : "Check my answer"}
                    </Primary>
                  </>
                )}
              </form>
            )}
            {!feedback && (
              <div className="help-actions">
                {!exam && !cold && (
                  <button className="text-button" onClick={onHint}>
                    <Lightbulb size={16} />
                    {active.helped
                      ? "Hint shown · practice still counts as effort"
                      : "Give me a memory clue"}
                  </button>
                )}
                <button
                  className="text-button subtle"
                  onClick={() => onAnswer("")}
                >
                  I don’t remember yet
                </button>
              </div>
            )}
            {active.helped && !feedback && (
              <div className="hint" role="status">
                <strong>A little help</strong>
                <p>{MEMORY[word.id].recall}</p>
                <p>{word.tip}</p>
                <small>
                  This is a supported try. I’ll check it again without the clue.
                </small>
              </div>
            )}
            {feedback &&
              (exam ? (
                <div className="feedback neutral" role="status">
                  <strong>Answer saved.</strong>
                  <p>Keep going. We’ll review everything at the end.</p>
                  <Primary onClick={onAdvance}>
                    {active.queue.length === 1
                      ? "See my results"
                      : "Next question"}
                  </Primary>
                </div>
              ) : carMode ? (
                <CarFeedback
                  state={state}
                  word={word}
                  onAdvance={onAdvance}
                  onCorrection={onCorrection}
                  onCorrecting={onCorrecting}
                  Action={Primary}
                  Chunks={Chunks}
                  Keys={CharacterKeys}
                  Comparison={() => showNounComparison(word, q, feedback, exam) ? <NounComparison word={word} Speech={Speech} /> : null}
                />
              ) : (
                <div
                  className={`feedback ${feedback.correct ? "success" : "retry"}`}
                  aria-live="polite"
                >
                  <div className="feedback-heading">
                    {feedback.correct ? (
                      <Check size={22} />
                    ) : (
                      <Lightbulb size={22} />
                    )}
                    <strong>
                      {feedback.correct
                        ? feedback.assisted
                          ? "Right with a little help."
                          : "You’ve got it."
                        : "A useful mistake. Let’s fix it."}
                    </strong>
                  </div>
                  {!feedback.correct && (
                    <div className="answer-comparison">
                      <div>
                        <span>You wrote</span>
                        <s>{feedback.input || "No answer entered"}</s>
                      </div>
                      <div>
                        <span>Correct answer</span>
                        <strong lang={q.type === 'meaning' ? 'en' : 'de'}>{feedback.expected}</strong>
                      </div>
                    </div>
                  )}
                  <p>{feedback.message}</p>
                  {showNounComparison(word, q, feedback, exam) && <NounComparison word={word} Speech={Speech} />}
                  {!feedback.correct &&
                    (q.type === "form" || q.type === "usage" ? (
                      <div className="hint">
                        <strong>Rule to remember</strong>
                        <p>{spec.explanation}</p>
                      </div>
                    ) : (
                      <MemoryCard word={word} compact />
                    ))}
                  {correctionNeeded(state) && (
                    <form
                      className="correction"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (correctionReady(state)) onAdvance();
                      }}
                    >
                      <label htmlFor="correction">
                        Look carefully. Type the correct answer once.
                      </label>
                      <input
                        id="correction"
                        ref={correctionRef}
                        value={active.correction || ""}
                        onChange={(e) => onCorrection(e.target.value)}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder={feedback.expected}
                        maxLength={200}
                      />
                      <CharacterKeys
                        inputRef={correctionRef}
                        value={active.correction || ""}
                        onChange={onCorrection}
                      />
                      <small>
                        Copying helps you learn the pattern. Your later answer
                        from memory earns mastery.
                      </small>
                    </form>
                  )}
                  <Primary
                    onClick={onAdvance}
                    disabled={!correctionReady(state)}
                  >
                    {active.queue.length === 1
                      ? "Finish this session"
                      : feedback.correct
                        ? "Keep going"
                        : "Got it — try me again later"}
                  </Primary>
                  {!feedback.correct && (
                    <small className="feedback-footnote">
                      {cold
                        ? "I’ll use this result to choose your next practice session."
                        : q.retry >= 2
                          ? "We’ll pick this up in your next targeted session. Keep going."
                          : "I’ll bring this back after other words, with the answer hidden."}
                    </small>
                  )}
                </div>
              ))}
            {feedback && !exam && feedback.reward > 0 && (
              <p className="reward-note" role="status">
                +{feedback.reward} blocks for your outpost. Remembered, not
                copied.
              </p>
            )}
          </>
        )}
      </div>
      <p className="below-panel">
        <Check size={14} />
        Your next step is chosen for you. Every answer saves automatically.
      </p>
    </section>
  );
}

function formatDue(time, now) {
  if (time <= now) return "Ready whenever you are";
  if (time - now < 60 * 60_000)
    return `In ${Math.ceil((time - now) / 60_000)} min`;
  return new Date(time).toLocaleString([], {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
export function Home({ state, now, onStart, onProgress }) {
  const {
    WORDS,
    BY_ID,
    MEMORY,
    phaseInfo,
    summary,
    mastery,
    describe,
    correctionNeeded,
    correctionReady,
    dueAt,
    dayTwoAt,
    delayedReviewAt,
  } = useTutor();
  const started = !!state.startedAt,
    stats = summary(state),
    last = state.sessions.at(-1),
    info = phaseInfo(state),
    due = dueAt(state);
  const overnight = state.phase === 4 && now < dayTwoAt(state),
    pause = started && now < due;
  const laterRecall = state.phase >= 7 && now < delayedReviewAt(state);
  const waiting = overnight || laterRecall;
  const exam = last?.kind === "exam",
    ready = state.phase >= 7 && stats.ready === WORDS.length;
  const title = !started
    ? "Your words.\nMade to stick."
    : ready
      ? "Look what you can do."
      : overnight
        ? "Let your brain sleep on it."
        : laterRecall
          ? "Give those words some space."
          : last
            ? "That’s a session well spent."
            : "Let’s pick up from here.";
  return (
    <section className="home">
      <h1>{title}</h1>
      <p className="lead">
        {!started
          ? `${WORDS.length} German words. A tutor that figures out what you need next.`
          : overnight
            ? "You’ve met every word. After a break, we’ll see what stayed with you."
            : ready
              ? "Every word has repeated skill evidence and recall after a gap."
              : "I’ve saved your work and chosen your next step."}
      </p>
      {!started ? (
        <>
          <div className="welcome-panel">
            <div className="coach">
              <span className="coach-avatar">W</span>
              <p>
                Hi, I’m your German study guide.
                <br />
                <strong>You don’t need to plan a thing.</strong>
              </p>
            </div>
            <div className="welcome-steps">
              <div>
                <span>01</span>
                <p>
                  <strong>Make it memorable</strong>Connect the meaning to the spelling. Break the
                  spelling into little pieces.
                </p>
              </div>
              <div>
                <span>02</span>
                <p>
                  <strong>Try it for yourself</strong>Meaning, spelling, and
                  real sentences. I’ll help when you get stuck.
                </p>
              </div>
              <div>
                <span>03</span>
                <p>
                  <strong>Remember it for real</strong>I’ll bring tricky words
                  back and check what sticks overnight.
                </p>
              </div>
            </div>
            <Primary onClick={() => onStart("course")}>
              Start my first session
            </Primary>
            <p className="center fine">
              About 15–20 minutes · You can pause at any time
            </p>
          </div>
          <p className="intro-note">
            <PencilLine size={18} />
            Spelling gets special attention: memory links, letter chunks,
            corrections, and recall with the answer hidden.
          </p>
        </>
      ) : (
        <>
          {last && (
            <div className="session-result">
              <span className="result-icon">
                {exam ? <BookOpen size={25} /> : <Check size={25} />}
              </span>
              <div>
                <span className="eyebrow">
                  {exam ? "FINAL REHEARSAL RESULTS" : "LAST SESSION"}
                </span>
                <h2>
                  {exam ? `${sessionAccuracy(last).unaidedCorrect} of ${last.count} answers correct without hints`
                    : `${stats.introduced} words discovered. Your world is growing.`}
                </h2>
                <p>
                  {exam
                    ? `${sessionAccuracy(last).unaidedPercent}% · ${sessionAccuracy(last).unaidedPercent >= 90 ? "Strong rehearsal." : "More practice will help."} This score is separate from word mastery.`
                    : `${sessionAccuracy(last).correct} correct answers · ${sessionAccuracy(last).wrong} to review · ${sessionAccuracy(last).guided} correct with guidance. Mastery grows through later independent recall.`}
                </p>
                {last.preparationAdded && (exam || last.phase === 4) && (
                  <p>
                    Supported practice: missing lessons were taught before this
                    check. Try a later rehearsal for an independent score.
                  </p>
                )}
                {last.mistakes.filter(answer => !answer.correct).length > 0 && <section aria-label="Review wrong answers">
                  <h3>Let’s review the wrong answers</h3>
                  {last.mistakes.filter(answer => !answer.correct).map((answer, i) => <div className="answer-comparison" key={i}>
                    <div><span>You wrote</span><s>{answer.input || 'No answer entered'}</s></div>
                    <div><span>Correct answer</span><strong lang={answer.type === 'meaning' ? 'en' : 'de'}>{answer.expected}</strong></div>
                  </div>)}
                </section>}
              </div>
            </div>
          )}
          <div className="next-panel">
            <span className="eyebrow">
              {overnight
                ? "YOUR NEXT RECALL SESSION"
                : laterRecall
                  ? "YOUR NEXT MEMORY CHECK"
                  : pause
                    ? "A SHORT BREAK, THEN…"
                    : "YOUR NEXT STEP"}
            </span>
            <h2>
              {laterRecall
                ? "One last check, after a gap"
                : ready
                  ? "Keep your memory fresh"
                  : info.title}
            </h2>
            <p>
              {laterRecall
                ? "You’ve practiced every skill successfully. The remaining words need a check after 8 hours without reviewing them. Take a break until the time below."
                : ready
                  ? "You’ve completed the learning route. A short refresh or another rehearsal can keep the words fresh before class."
                  : info.coach}
            </p>
            <div className="time-note">
              <Clock3 size={16} />
              {formatDue(due, now)} <span>· {info.minutes} min</span>
            </div>
            {waiting ? (
              <>
                <p className="break-note">
                  {overnight
                    ? "Come back at the time above. Close this tab and take a break. Near a deadline, the tutor may bring this check forward; delayed mastery still requires 8 hours."
                    : "You can close the app. More practice is optional, but reviewing a word restarts its 8-hour recall gap."}
                </p>
                <Primary onClick={() => onStart("extra")}>
                  A little extra practice
                </Primary>
              </>
            ) : (
              <Primary onClick={() => onStart("course")}>
                {pause
                  ? "I’ve taken a break — continue"
                  : ready
                    ? "Start a short refresh"
                    : "Continue with my tutor"}
              </Primary>
            )}
            {state.phase >= 7 && (
              <button
                className="text-button secondary-action"
                onClick={() => onStart("exam")}
              >
                <BookOpen size={16} />
                Take another final rehearsal
              </button>
            )}
          </div>
          {last?.mistakes.length > 0 && (
            <div className="review-block">
              <h2>
                {exam
                  ? "Your answers, explained"
                  : "These tell me what to teach next"}
              </h2>
              <p className="fine">
                {exam
                  ? "Review the corrections. Your next session will focus on these weak spots."
                  : "I’ll automatically give these words more practice."}
              </p>
              {last.mistakes
                .slice(0, exam ? WORDS.length * 2 : 5)
                .map((a, i) => (
                  <details key={i}>
                    <summary>
                      <span lang="de">{BY_ID[a.wordId].german}</span>
                      <span>
                        {SKILL_LABELS[a.type]} <ChevronRight size={15} />
                      </span>
                    </summary>
                    <div className="review-answer">
                      <p>{describe(a).title}</p>
                      <p>
                        Your answer:{" "}
                        <strong>{a.input || "Not remembered"}</strong>
                        {a.assisted ? " (with a hint)" : ""}
                      </p>
                      <p>
                        Correct: <strong lang="de">{a.expected}</strong>
                      </p>
                      <p>{a.message}</p>
                      <MemoryCard word={BY_ID[a.wordId]} compact />
                    </div>
                  </details>
                ))}
            </div>
          )}
          <button className="text-button secondary-action" onClick={onProgress}>
            See all word progress <ArrowRight size={16} />
          </button>
        </>
      )}
    </section>
  );
}

export function Modal({ title, children, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    node.showModal();
    return () => node.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dialog-header">
        <h2>{title}</h2>
        <button
          aria-label="Close panel"
          className="icon-button"
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
export function Progress({ state, onExport, onImport, onReset, damaged }) {
  const {
    WORDS,
    BY_ID,
    MEMORY,
    phaseInfo,
    summary,
    mastery,
    describe,
    correctionNeeded,
    correctionReady,
    dueAt,
    dayTwoAt,
    delayedReviewAt,
  } = useTutor();
  const [selected, setSelected] = useState(null),
    [filter, setFilter] = useState("all");
  const stats = summary(state),
    fileRef = useRef(null);
  return (
    <>
      <p className="lead small">
        {stats.ready} of {WORDS.length} words remembered. Reading a card or
        copying an answer never earns mastery.
      </p>
      <div className="progress-legend">
        <span>○ Not introduced</span>
        <span>◐ Practicing</span>
        <span>● Remembered</span>
      </div>
      <div className="filter-row" role="group" aria-label="Filter words">
        {[
          ["all", `All ${WORDS.length}`],
          ["weak", "Needs practice"],
          ["ready", "Remembered"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={filter === id ? "selected" : ""}
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="word-list">
        {WORDS.filter(
          (w) =>
            filter === "all" ||
            (filter === "ready"
              ? mastery(state, w.id).ready
              : !mastery(state, w.id).ready),
        ).map((w) => {
          const p = state.words[w.id],
            m = mastery(state, w.id);
          return (
            <div className="word-row" key={w.id}>
              <button
                onClick={() => setSelected(selected === w.id ? null : w.id)}
                aria-expanded={selected === w.id}
              >
                <span>
                  <strong lang="de">{w.german}</strong>
                  <small>{w.english}</small>
                </span>
                <span>
                  <span className={`word-status ${m.ready ? "ready" : ""}`}>
                    {m.label}
                  </span>
                  <ChevronRight size={17} />
                </span>
              </button>
              {selected === w.id && (
                <div className="word-detail">
                  <div className="word-detail-top">
                    <p lang="de">
                      {w.example}
                      <small lang="en">{w.translation}</small>
                    </p>
                    <Speech text={`${w.german}. ${w.example}`} />
                  </div>
                  <MemoryCard word={w} />
                  {state.learning && <section aria-label="Review all taught forms and examples">{firstWordContent(w).map((page, i) => <article key={i}>
                    <h4>{page.label}</h4><p>{page.prompt}</p><strong lang="de">{page.answer}</strong><p>{page.translation}</p>
                    <Speech text={page.answer} /><p>{page.explanation}</p><Speech text={page.explanation} lang="en-US" label="Hear English explanation" />
                  </article>)}</section>}
                  <ul className="skill-list">
                    {state.learning ? learningTargets([w]).map(q => {
                      const target = state.learning.targets[targetKey(q)];
                      return <li key={targetKey(q)}><span>{SKILL_LABELS[q.type]}{['usage','form'].includes(q.type) ? ` · ${q.variant + 1}` : ''}</span>
                        <span aria-label={`${target.steps} of 2 spaced successes`}>{[0,1].map(i => <span key={i} className={`skill-dot ${target.steps > i ? 'filled' : ''}`} />)}</span></li>;
                    }) : requiredSkills(w).map((k) => (
                      <li key={k}>
                        <span>{SKILL_LABELS[k]}</span>
                        <span
                          aria-label={`${p.skills[k].wins} of 2 spaced successes`}
                        >
                          {[0, 1].map((i) => (
                            <span
                              key={i}
                              className={`skill-dot ${p.skills[k].wins > i ? "filled" : ""}`}
                            />
                          ))}
                        </span>
                      </li>
                    ))}
                    <li>
                      <span>Recall after 8 hours</span>
                      <span>
                        {(state.learning ? state.learning.verification[w.id].delayed : p.delayed) ? <Check size={17} /> : "Still to check"}
                      </span>
                    </li>
                  </ul>
                  {state.learning && <p className="fine">Final spelling: {state.learning.verification[w.id].finalSpelling ? 'verified' : 'still to check'} · Final sentence/form: {state.learning.verification[w.id].finalTransfer ? 'verified' : 'still to check'}</p>}
                  <p className="fine">{state.learning ? 'Every listed target needs two spaced independent successes. An independent mistake removes at most one evidence step on that target. Guided practice and copied repairs do not earn evidence.' : <>
                    Two unaided correct answers, at least three questions apart,
                    are needed for each skill. A mistake resets that skill’s
                    two-answer check.</>}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <section className="backup">
        <h3>Your progress stays here</h3>
        <p>
          Saved in this browser on this device. Use the same address each time.
          Download a backup before clearing browser data or changing devices.
        </p>
        <div className="backup-actions">
          <button onClick={onExport}>
            <Download size={16} />
            {damaged ? "Download saved data" : "Download backup"}
          </button>
          {onImport && (
            <button onClick={() => fileRef.current.click()}>
              <Upload size={16} />
              Restore backup
            </button>
          )}
          <input
            hidden
            type="file"
            accept="application/json,.json"
            ref={fileRef}
            onChange={(e) => {
              if (e.target.files[0]) onImport(e.target.files[0]);
              e.target.value = "";
            }}
          />
          {onReset && (
            <button className="danger-link" onClick={onReset}>
              <RotateCcw size={16} />
              Reset progress
            </button>
          )}
        </div>
      </section>
    </>
  );
}
export function Help() {
  const {
    WORDS,
    BY_ID,
    MEMORY,
    phaseInfo,
    summary,
    mastery,
    describe,
    correctionNeeded,
    correctionReady,
    dueAt,
    dayTwoAt,
    delayedReviewAt,
  } = useTutor();
  return (
    <div className="help-copy">
      <p>
        Press Start or Continue. Your tutor chooses every lesson and question
        from your answers. You don’t need to choose a mode or decide what to
        study.
      </p>
      <h3>Car view for a Mac passenger</h3>
      <p>
        Car view starts on: large type, a wide lesson area, large buttons, no
        animation, and one teaching idea per screen. Use the Car view button to
        switch to the compact layout. Make a link, Spell it, Use it, and Word
        forms lead into the same adaptive practice. The German button reads the
        word aloud; Hear tip reads the memory aid in English. In multiple
        choice, the number keys 1–4 also select an answer. Press Enter to check
        a typed answer.
      </p>
      <h3>Link → chunk → cover → write → check</h3>
      <p>
        Every word has a memory link and spelling chunks. Make a meaningful
        connection to the spelling and say the chunks aloud. On the next screen, the word is hidden
        so you can retrieve it. If the spelling is wrong, you’ll type a
        correction, then try from memory later. Memory links are
        reminders, not word origins or pronunciation guides.
      </p>
      <h3>Your two-day route</h3>
      <p>
        Day 1: three 15–20 minute learning sessions (9 new words each), plus a
        10–15 minute mixed check. Day 2: a 10–15 minute recall check, 15–20
        minutes of targeted practice, then a 20–25 minute rehearsal. These are
        estimates; extra practice adapts to you. Take short breaks between
        sessions.
      </p>
      <h3>Learn it before a challenge</h3>
      <p>
        Every tested sentence and word form gets an explicit worked lesson,
        including plurals, articles, reflexive pronouns, and split verbs. If an
        older saved session has no record of a lesson, I teach it before
        grading. That first supported try does not earn mastery. Wrong typed
        answers need an exact practice correction.
      </p>
      <h3>Your outpost</h3>
      <p>
        Six answers make a short mission, then you can build or take a break.
        Independent recall earns blocks for your island. You choose your next
        blueprint; mistakes never remove buildings or blocks. Copying and hints
        are learning tools, not block rewards. Your outpost and learning
        progress save together. A completed outpost does not mean every word is
        mastered.
      </p>
      <h3>Honest mastery</h3>
      <p>
        Each word needs two unaided correct answers, separated by at least three
        questions, for meaning, spelling, sentence use, and any applicable word
        forms. Typed German recall also demonstrates meaning. It also needs a
        correct typed recall at least 8 hours after the word was last shown or
        answered in practice. Hints and copied corrections don’t add mastery. A
        wrong answer resets that skill’s check.
      </p>
      <h3>Exact spelling matters</h3>
      <p>
        Articles and sich are part of the vocabulary answer. Capitalize German
        nouns. Use ä, ö, ü and ß, with the provided keys if needed. Spaces
        around your answer and final punctuation are ignored; letter errors are
        explained and practiced. The course uses German school spelling, so
        ae/oe/ue and ss in place of ß receive a correction.
      </p>
      <h3>Final rehearsal</h3>
      <p>
        There are {WORDS.length * 2} questions: all {WORDS.length} words in
        English → German, followed by one sentence or word-form question for
        every word. No hints or instant grading. You’ll get a score and
        explanations at the end. This is practice based on the vocabulary list,
        not a copy of the teacher’s test.
      </p>
      <h3>What happens when you close the app?</h3>
      <p>
        Your current question, typed answer, feedback, and progress are saved.
        Reopen the same address to resume. The app can show break and
        next-session times while open; it cannot bring you back or send
        reminders when closed. The student still needs to return and answer.
      </p>
      <h3>Audio & privacy</h3>
      <p>
        The app has no account, analytics, AI service, or API key. It uses
        prepared teaching content and an adaptive practice engine. Optional
        pronunciation uses a German voice installed on your device; some system
        voices use an internet connection. It does not record your microphone or
        grade pronunciation.
      </p>
      <h3>Lesson source</h3>
      <p>
        The original wave follows the extraction supplied in the conversation,
        including its article for Fahrradtrial. The original photos were not
        rechecked. All examples and memory stories were written for this app.
        Grammar was cross-checked with{" "}
        <a
          href="https://deutsch.lingolia.com/en/grammar/verbs/reflexive-verbs"
          target="_blank"
          rel="noreferrer"
        >
          Lingolia’s reflexive-verb guide
        </a>
        .
      </p>
    </div>
  );
}
