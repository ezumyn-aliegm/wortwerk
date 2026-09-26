import React, { useEffect, useRef } from "react";
import { Check, Lightbulb, PencilLine } from "lucide-react";
import { MEMORY } from "./memory.js";
import { correctionNeeded, correctionReady } from "./engine.js";

export function CarLesson({ word, step, onStep, onAdvance, Action, Chunks }) {
  const memory = MEMORY[word.id];
  return (
    <>
      <div className="lesson-stages" aria-label="Teaching steps">
        {["Picture it", "Spell it", "Use it"].map((label, index) => (
          <span
            key={label}
            className={index === step ? "active" : ""}
            aria-current={index === step ? "step" : undefined}
          >
            {index + 1}. {label}
          </span>
        ))}
      </div>
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
              <strong lang="de">{word.example}</strong>
              <p>{word.translation}</p>
            </div>
          )}
        </div>
        <div className="car-memory-side">
          <h3>
            {step === 0
              ? "Make a picture in your mind"
              : step === 1
                ? "Say the chunks. Check the letters."
                : "Notice how the word works"}
          </h3>
          <p>
            {step === 0 ? memory.scene : step === 1 ? memory.watch : word.tip}
          </p>
          <span className="car-coach-note">
            {step === 0
              ? "Take a moment to imagine it. A silly picture is easier to remember."
              : step === 1
                ? "Look away. Say the letters aloud once. You’ll type it from memory soon."
                : "Say the sentence once. Next, I’ll hide the answer and check your memory."}
          </span>
        </div>
      </div>
      <Action onClick={step < 2 ? () => onStep(step + 1) : onAdvance}>
        {step === 0
          ? "Now break down the spelling"
          : step === 1
            ? "See it in a sentence"
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
  const active = state.active,
    feedback = active.feedback,
    inputRef = useRef(null);
  const copy = correctionNeeded(state) && active.correcting;
  const memory = MEMORY[word.id];
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
            ? "Make the spelling stick."
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
          {copy ? (
            <Chunks word={word} />
          ) : (
            <p className="car-explanation">{feedback.message}</p>
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
            <label htmlFor="correction">Type the correct spelling once</label>
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
              {feedback.correct ? "Keep this clue" : "Your memory picture"}
            </h3>
            <p>{feedback.correct ? memory.recall : memory.scene}</p>
            {!feedback.correct && (
              <p className="car-coach-note">
                <PencilLine size={19} />
                {memory.watch}
              </p>
            )}
          </div>
        )}
      </div>
      {correctionNeeded(state) && !copy ? (
        <Action onClick={onCorrecting}>Practice the correct spelling</Action>
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
