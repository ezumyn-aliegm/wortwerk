import test from 'node:test';
import assert from 'node:assert/strict';
import { forgeChunks, shuffledTiles, selectedTiles, chooseTile, undoDraft, isComplete } from '../src/forge.js';
import { MEMORY } from '../src/memory.js';
import { WORDS } from '../src/data.js';

test('all 27 mnemonic builds reconstruct the full vocabulary spelling', () => {
  assert.equal(WORDS.length, 27);
  for (const {id, german} of WORDS) {
    const memory = MEMORY[id];
    const tiles = forgeChunks({ german }, memory);
    assert.equal(tiles.map(t => t.text).join(''), german);
    let draft = '';
    for (const tile of tiles) {
      const result = chooseTile(tiles, draft, tile.id);
      assert.equal(result.hint, '');
      draft = result.draft;
    }
    assert.ok(isComplete({ german }, draft));
  }
});

test('articles, reflexive prefixes, and explicit spaces stay exact', () => {
  for (const [german, chunks] of [['das Haus', ['H', 'aus']],
    ['sich treffen', ['tre', 'ff', 'en']], ['weit weg', ['weit', ' ', 'weg']]]) {
    assert.equal(forgeChunks({ german }, { chunks }).map(t => t.text).join(''), german);
  }
});

test('malformed and imported mnemonic chunks fall back without losing Unicode', () => {
  for (const chunks of [undefined, [], ['wrong'], [''], [42], ['H', 'aus']]) {
    const tiles = forgeChunks({ german: 'Öl 🧱' }, { chunks });
    assert.equal(tiles.map(t => t.text).join(''), 'Öl 🧱');
    assert.equal(tiles.at(-1).text, '🧱');
  }
  assert.ok(isComplete({ german: 'müde' }, 'mu\u0308de'));
  assert.equal(isComplete({ german: 'der Brief' }, 'Brief'), false);
  assert.deepEqual(forgeChunks({ german: '42' }, { chunks: [42] }).map(t => t.text), ['4', '2']);
});

test('shuffling is stable across draft updates and retains every tile identity', () => {
  const tiles = forgeChunks({ german: 'Mama' }, { chunks: ['M', 'a', 'm', 'a'] });
  const shuffled = shuffledTiles(tiles);
  assert.deepEqual(shuffledTiles(tiles), shuffled);
  assert.notDeepEqual(shuffled, tiles);
  assert.deepEqual(shuffled.map(t => t.id).sort(), tiles.map(t => t.id));
  assert.deepEqual(shuffledTiles([]), []);
});

test('repeated tiles are distinct and a later identical tile works first', () => {
  const tiles = forgeChunks({ german: 'Mama' }, { chunks: ['M', 'a', 'm', 'a'] });
  let draft = chooseTile(tiles, 'M', 3).draft;
  assert.equal(draft, 'Ma');
  assert.deepEqual(selectedTiles(tiles, draft), [0, 1]);
  draft = chooseTile(tiles, draft, 2).draft;
  assert.equal(chooseTile(tiles, draft, 3).draft, 'Mama');
});

test('wrong order preserves progress and identifies the next spelling piece', () => {
  const tiles = forgeChunks({ german: 'Brief' }, { chunks: ['Br', 'ie', 'f'] });
  const result = chooseTile(tiles, 'Br', 2);
  assert.equal(result.draft, 'Br');
  assert.match(result.hint, /ie/);
  assert.equal(undoDraft(tiles, 'Brie'), 'Br');
  assert.equal(undoDraft(tiles, 'Br'), '');
  assert.equal(undoDraft(tiles, '🧱x'), '🧱');
  assert.deepEqual(selectedTiles(tiles, 'wrong'), []);
  assert.equal(chooseTile(tiles, 'wrong', 1).draft, 'wrong');
  assert.equal(chooseTile(tiles, 'Brief', 1).draft, 'Brief');
});
