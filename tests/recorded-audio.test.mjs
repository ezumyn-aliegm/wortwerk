import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { collectAudioLines, audioKey } from '../src/audio-lines.js';
import { playRecording, stopRecording } from '../src/recorded-audio.js';

test('all current German and English speech lines have a unique recording', async () => {
  const catalog = JSON.parse(await readFile(new URL('../src/audio-catalog.json', import.meta.url)));
  const manifest = JSON.parse(await readFile(new URL('../voice-manifest.json', import.meta.url)));
  const lines = collectAudioLines();
  assert.equal(lines.length, manifest.clips.length);
  assert.equal(new Set(Object.values(catalog)).size, lines.length);
  assert.ok(lines.some(line => line.language === 'de' && line.text === 'die Briefe'));
  assert.ok(lines.some(line => line.language === 'en'));
  for (const line of lines) assert.ok(catalog[audioKey(line.text, line.language)]);
});

test('every planned clip exists and matches the generated voice index', async () => {
  const manifest = JSON.parse(await readFile(new URL('../voice-manifest.json', import.meta.url)));
  const index = JSON.parse(await readFile(new URL('../public/voice/voice-index.json', import.meta.url)));
  for (const clip of manifest.clips) {
    const entry = index.clips[clip.id];
    assert.equal(entry?.text, clip.text);
    assert.equal(entry.language, clip.language);
    const file = await readFile(new URL(`../public/voice/${entry.file}`, import.meta.url));
    assert.equal(file.length, entry.bytes);
    assert.ok(file.length > 64);
  }
});

test('only one recording plays and cleanup cannot stop another button', async () => {
  class AudioStub {
    constructor(source) { this.source = source; this.paused = false; }
    play() { return Promise.resolve(); }
    pause() { this.paused = true; }
  }
  const first = playRecording('/one.mp3', assert.fail, AudioStub);
  const second = playRecording('/two.mp3', assert.fail, AudioStub);
  assert.equal(first.paused, true);
  stopRecording(first);
  assert.equal(second.paused, false);
  stopRecording(second);
  assert.equal(second.paused, true);
});

test('failed playback reports an error without browser speech fallback', async () => {
  let errors = 0;
  class BrokenAudio {
    play() { return Promise.reject(new Error('offline')); }
    pause() {}
  }
  playRecording('/missing.mp3', () => errors++, BrokenAudio);
  await Promise.resolve();
  assert.equal(errors, 1);
});
