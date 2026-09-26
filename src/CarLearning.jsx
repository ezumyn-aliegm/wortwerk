import React, { useEffect, useRef } from "react";
import { Check, Lightbulb, PencilLine } from "lucide-react";
import { useTutor } from "./TutorContext.jsx";

export function CarLesson({ word, step, onStep, onAdvance, Action, Chunks }) {
  const { MEMORY, teachingPages } = useTutor();
  const memory = MEMORY[word.id];
  const pages = teachingPages(word),
    page = pages[step];
  const stage = step < 2 ? step : page.kind === "form" ? 3 : 2;
  return (
    <>
      <div className="lesson-stages" aria-label="Teaching steps">
        {[
          "Picture it",
          "Spell it",
          "Use it",
          ...(word.forms.length ? ["Word forms"] : []),
        ].map((label, index) => (
          <span
            key={label}
            className={index === stage ? "active" : ""}
            aria-current={index === stage ? "step" : undefined}
          >
            {index + 1}. {label}
          </span>
        ))}
      </div>
      <p className="input-note">
        {page.label} · Step {step + 1} of {pages.length}
      </p>
      <div className="car-learning-grid">
        <div className="car-word-side">
          {step < 2 ? (
            <>
              <div
                className={`word-display ${word.german.length > 15 ? "long-word" : ""}`}
              >
                <h2 lang="de">{word.german}</h2>
                <p>{word.english}</p>
                <span className="word-kind">{word.kind}</span>
              </div>
              {step === 1 && <Chunks word={word} />}
            </>
          ) : (
            <div className="car-sentence">
              {page.kind === "form" && <p>{page.prompt}</p>}
              <strong lang="de">{page.answer}</strong>
              {page.translation && <p>{page.translation}</p>}
            </div>
          )}
        </div>
        <div className="car-memory-side">
          <h3>
            {step === 0
              ? "Make a picture in your mind"
              : step === 1
                ? "Say the chunks. Check the letters."
                : page.kind === "form"
                  ? "Learn this form before you try it"
                  : "Notice how the word works"}
          </h3>
          <p>
            {step === 0
              ? memory.scene
              : step === 1
                ? memory.watch
                : page.explanation}
          </p>
          <span className="car-coach-note">
            {step === 0
              ? "Take a moment to imagine it. A silly picture is easier to remember."
              : step === 1
                ? "Look away. Say the letters aloud once. You’ll type it from memory soon."
                : page.kind === "form"
                  ? "Notice exactly what changes. Say the complete answer, then look away and try to recall it."
                  : "Say the complete sentence once. Notice the ending and where each part goes."}
          </span>
        </div>
      </div>
      <Action
        onClick={step < pages.length - 1 ? () => onStep(step + 1) : onAdvance}
      >
        {step === 0
          ? "Now break down the spelling"
          : step === 1
            ? "See it in a sentence"
            : step < pages.length - 1
              ? `Next: ${pages[step + 1].label}`
              : "Ready — test me"}
      </Action>
      {step > 0 && (
        <button
          className="text-button car-back"
          onClick={() => onStep(step - 1)}
        >
          See the previous step again
        </button>
      )}
    </>
  );
}

export function CarFeedback({
  state,
  word,
  onAdvance,
  onCorrection,
  onCorrecting,
  Action,
  Chunks,
  Keys,
}) {
  const { correctionNeeded, correctionReady } = useTutor();
  const active = state.active,
    feedback = active.feedback,
    inputRef = useRef(null);
  const copy = correctionNeeded(state) && active.correcting;
  const { MEMORY } = useTutor();
  const memory = MEMORY[word.id];
  const spelling = active.queue[0].type === "spelling";
  const { describe } = useTutor();
  const rule = describe(active.queue[0]).explanation;
  useEffect(() => {
    if (copy) inputRef.current?.focus({ preventScroll: true });
  }, [copy]);
  return (
    <div
      className={`feedback car-feedback ${feedback.correct ? "success" : "retry"}`}
      aria-live="polite"
    >
      <div className="feedback-heading">
        {feedback.correct ? <Check size={27} /> : <Lightbulb size={27} />}
        <strong>
          {copy
            ? spelling
              ? "Make the spelling stick."
              : "Practice the correct form."
            : feedback.correct
              ? feedback.assisted
                ? "Right with a little help."
                : "You’ve got it."
              : "Let’s learn from that."}
        </strong>
      </div>
      <div className="car-feedback-grid">
        <div>
          {!feedback.correct && !copy && (
            <p className="car-your-answer">
              You wrote: <s>{feedback.input || "Not remembered yet"}</s>
            </p>
          )}
          <div className="car-correct-answer">
            <span>{copy ? "Look, then type this" : "Correct answer"}</span>
            <strong lang={active.queue[0].type === "meaning" ? "en" : "de"}>
              {feedback.expected}
            </strong>
          </div>
          {copy && spelling ? (
            <Chunks word={word} />
          ) : (
            <p className="car-explanation">{copy ? rule : feedback.message}</p>
          )}
        </div>
        {copy ? (
          <form
            className="correction"
            onSubmit={(e) => {
              e.preventDefault();
              if (correctionReady(state)) onAdvance();
            }}
          >
            <label htmlFor="correction">Type the correct answer once</label>
            <input
              id="correction"
              ref={inputRef}
              value={active.correction || ""}
              onChange={(e) => onCorrection(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={200}
              placeholder="Type the correction…"
            />
            <Keys
              inputRef={inputRef}
              value={active.correction || ""}
              onChange={onCorrection}
            />
            <p className="car-coach-note">
              This is a practice copy. I’ll check it again later with the answer
              hidden.
            </p>
          </form>
        ) : (
          <div className="car-memory-side">
            <h3>
              {!spelling && active.queue[0].type !== "meaning"
                ? "Rule to remember"
                : feedback.correct
                  ? "Keep this clue"
                  : "Your memory picture"}
            </h3>
            <p>
              {!spelling && active.queue[0].type !== "meaning"
                ? rule
                : feedback.correct
                  ? memory.recall
                  : memory.scene}
            </p>
            {!feedback.correct && spelling && (
              <p className="car-coach-note">
                <PencilLine size={19} />
                {memory.watch}
              </p>
            )}
          </div>
        )}
      </div>
      {correctionNeeded(state) && !copy ? (
        <Action onClick={onCorrecting}>
          Practice the correct {spelling ? "spelling" : "answer"}
        </Action>
      ) : (
        <Action onClick={onAdvance} disabled={!correctionReady(state)}>
          {active.queue.length === 1
            ? "Finish this session"
            : feedback.correct
              ? "Keep going"
              : "Got it — try me again later"}
        </Action>
      )}
    </div>
  );
}
