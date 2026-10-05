import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {posix} from 'node:path';
import {withAutumnWave} from '../scripts/install-wave-two.mjs';
import {migrateLibrary} from '../src/library.js';
import {freshState, startSession, setDraft} from '../src/engine.js';

test('container runtime includes every relative dependency of copied source modules', async () => {
  const docker = await readFile(new URL('../Dockerfile', import.meta.url), 'utf8');
  const runtime = docker.split('FROM node:22-alpine\n')[1];
  const sources = [...runtime.matchAll(/^COPY (src\/.*) \.\/src\/$/gm)].flatMap(match => match[1].split(' '));
  for (const source of sources) {
    const code = await readFile(new URL(`../${source}`, import.meta.url), 'utf8');
    for (const [, dependency] of code.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
      const target = posix.normalize(posix.join(posix.dirname(source), dependency));
      assert.ok(sources.includes(target), `${source} imports missing runtime module ${target}`);
    }
  }
  assert.match(runtime, /COPY scripts\/install-wave-two\.mjs \.\/scripts\//);
});
test('administrative autumn install preserves all prior progress and is idempotent', () => {
  const legacy = setDraft(startSession(freshState(), Date.parse('2026-10-01T13:00:00Z')), 'preserve draft');
  const saved = migrateLibrary(legacy), before = structuredClone(saved);
  const result = withAutumnWave(saved);
  assert.ok(result.added);
  assert.deepEqual(saved, before);
  assert.deepEqual(result.state.waves[0], before.waves[0]);
  assert.equal(result.state.selectedWaveId, before.selectedWaveId);
  assert.deepEqual(result.state.activity, before.activity);
  assert.equal(result.state.waves.length, 2);
  assert.equal(withAutumnWave(result.state).added, false);
});
