const normal = value => String(value ?? '').normalize('NFC');
const letters = text => typeof Intl.Segmenter === 'function'
  ? [...new Intl.Segmenter('de', { granularity: 'grapheme' }).segment(text)].map(s => s.segment)
  : Array.from(text);

export function forgeChunks(word, memory) {
  const german = String(word.german ?? '');
  let chunks = memory?.chunks;
  if (Array.isArray(chunks) && chunks.length && chunks.every(c => typeof c === 'string' && c.length)) {
    chunks = [...chunks];
    const prefix = german.match(/^(der|die|das|den|dem|des|ein|eine|sich) /)?.[0];
    if (prefix && chunks.join('') === german.slice(prefix.length)) chunks.unshift(prefix);
  }
  if (!Array.isArray(chunks) || chunks.some(c => typeof c !== 'string' || !c) || chunks.join('') !== german) chunks = letters(german);
  return chunks.map((text, id) => ({ id, text }));
}

export function shuffledTiles(tiles) {
  const result = [...tiles];
  let seed = 17;
  for (const tile of tiles) for (const char of tile.text) seed = (seed * 31 + char.codePointAt(0)) >>> 0;
  for (let i = result.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  if (result.length > 1 && result.every((t, i) => t.id === tiles[i].id)) result.reverse();
  return result;
}

export function selectedTiles(tiles, draft) {
  let built = '';
  const selected = [];
  for (const tile of tiles) {
    if (normal(built) === normal(draft)) return selected;
    built += tile.text;
    selected.push(tile.id);
  }
  return normal(built) === normal(draft) ? selected : [];
}

export function chooseTile(tiles, draft, id) {
  const selected = selectedTiles(tiles, draft);
  const built = selected.map(i => tiles[i].text).join('');
  if (normal(built) !== normal(draft)) return { draft, hint: 'Finish typing, or clear the build to use the blocks.' };
  const next = tiles[selected.length], clicked = tiles.find(t => t.id === id);
  if (!next || !clicked || selected.includes(id)) return { draft, hint: '' };
  if (normal(clicked.text) !== normal(next.text)) return {
    draft, hint: `Next comes ${next.text.trim() ? `“${next.text}”` : 'a space'}. Check that piece in the model above.`,
  };
  return { draft: built + next.text, hint: '' };
}

export function undoDraft(tiles, draft) {
  const selected = selectedTiles(tiles, draft);
  return selected.length ? selected.slice(0, -1).map(i => tiles[i].text).join('') : letters(String(draft ?? '')).slice(0, -1).join('');
}

export const isComplete = (word, draft) => Boolean(word.german) && normal(word.german) === normal(draft);
