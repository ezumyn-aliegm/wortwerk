import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import { forgeChunks, shuffledTiles, selectedTiles, chooseTile, undoDraft, isComplete } from './forge.js';
import './word-forge.css';

export default function WordForge({ word, memory, draft, onDraft, onAdvance, Action }) {
  const [feedback, setFeedback] = useState(null);
  const input = useRef(null), caret = useRef(null), inputId = useId();
  const value = typeof draft === 'string' ? draft : '';
  const tiles = forgeChunks(word, memory), selected = selectedTiles(tiles, value);
  const ready = isComplete(word, value);
  const hint = feedback?.word === word.german && feedback?.draft === value ? feedback.text : '';
  useLayoutEffect(() => {
    if (caret.current?.value === value) {
      input.current?.focus({ preventScroll: true });
      input.current?.setSelectionRange(caret.current.position, caret.current.position);
      caret.current = null;
    }
  }, [value]);
  const update = next => { setFeedback(null); onDraft(next); };
  const pick = id => {
    const result = chooseTile(tiles, value, id);
    setFeedback(result.hint ? { word: word.german, draft: value, text: result.hint } : null);
    if (result.draft !== value) onDraft(result.draft);
  };
  const insert = char => {
    const start = input.current?.selectionStart ?? value.length;
    const end = input.current?.selectionEnd ?? start;
    const next = value.slice(0, start) + char + value.slice(end);
    caret.current = { value: next, position: start + char.length };
    update(next);
  };
  const Advance = Action || 'button';
  return (
    <section className="word-forge" aria-label="Spelling forge">
      <div className="forge-reference">
      <header>
        <p className="forge-kicker">Spelling forge · build it once</p>
        <h2 lang="de">{word.german}</h2>
        <p className="forge-meaning">{word.english}</p>
      </header>
      <p className="forge-memory">{memory?.scene || 'Picture this word on a block. Notice each letter as you build it.'}</p>
      {memory?.watch && <p className="forge-watch">{memory.watch}</p>}
      </div>
      <div className="forge-workspace">
      <p className="forge-instruction">Click the blocks in spelling order, or type the full word below.</p>
      <div className="forge-tiles" aria-label="Spelling blocks">
        {shuffledTiles(tiles).map(tile => (
          <button type="button" key={tile.id} lang="de" disabled={selected.includes(tile.id)}
            aria-label={`${tile.text.trim() ? tile.text : 'Space'} · block ${tile.id + 1}`}
            onClick={() => pick(tile.id)}>{tile.text.trim() ? tile.text : '␣'}</button>
        ))}
      </div>
      <label htmlFor={inputId}>Your build</label>
      <input id={inputId} ref={input} lang="de" value={value}
        onChange={e => update(e.target.value)} autoComplete="off" autoCorrect="off"
        autoCapitalize="none" spellCheck={false} aria-describedby={`${inputId}-hint`} />
      <div className="forge-tools">
        {['ä', 'ö', 'ü', 'ß'].map(char => (
          <button type="button" key={char} onClick={() => insert(char)} aria-label={`Insert ${char}`}>{char}</button>
        ))}
        <button type="button" disabled={!value} onClick={() => update(undoDraft(tiles, value))}>Undo</button>
        <button type="button" disabled={!value} onClick={() => update('')}>Clear</button>
      </div>
      <p id={`${inputId}-hint`} className="forge-hint" role="status">
        {hint || (ready ? 'Built! Next, try it with the model hidden.' : 'The model stays visible while you build.')}
      </p>
      <Advance disabled={!ready} onClick={() => { if (ready) onAdvance(); }}>
        Hide it — try from memory
      </Advance>
      </div>
    </section>
  );
}
