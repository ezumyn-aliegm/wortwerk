import test from 'node:test';
import assert from 'node:assert/strict';
import { WORDS } from '../src/data.js';
import { firstWordContent } from '../src/first-word-content.js';
import { collectAudioLines } from '../src/audio-lines.js';

test('first teaching card includes every example, usage and assessed form with available audio', () => {
  const audio = new Set(collectAudioLines().map(x=>JSON.stringify([x.language,x.text])));
  for (const word of WORDS) {
    const before=JSON.stringify(word);
    const content=firstWordContent(word);
    assert.ok(content.some(x=>x.answer===word.example));
    for(const [sentence,,answer] of word.usages) assert.ok(content.some(x=>x.answer===sentence.replace('___',answer)));
    for(const [,answer] of word.forms) assert.ok(content.some(x=>x.answer===answer));
    for(const page of content) {
      assert.ok(audio.has(JSON.stringify(['de',page.answer])));
      assert.ok(audio.has(JSON.stringify(['en',page.explanation])));
    }
    assert.equal(JSON.stringify(word),before);
  }
});
