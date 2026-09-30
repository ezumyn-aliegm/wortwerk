import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { collectAudioLines, audioKey } from '../src/audio-lines.js';

const clips = collectAudioLines().map(line => ({
  id: `${line.language}_${createHash('sha256').update(audioKey(line.text, line.language)).digest('hex').slice(0, 24)}`,
  ...line,
}));
const manifest = { voice_id: 'eve', out_dir: 'public/voice', clips };
await writeFile(new URL('../voice-manifest.json', import.meta.url), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(new URL('../src/audio-catalog.json', import.meta.url), JSON.stringify(Object.fromEntries(
  clips.map(clip => [audioKey(clip.text, clip.language), `/voice/${clip.id}.mp3`]),
), null, 2) + '\n');
console.log(`${clips.length} unique clips; ${clips.reduce((n, clip) => n + clip.text.length, 0)} characters`);
