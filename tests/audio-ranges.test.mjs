import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { createServer } from '../server.mjs';
import { buildOffline } from '../scripts/build-offline.mjs';

const content = Buffer.from([0, 255, 2, 128, 4, 5, 6, 7, 8, 9]);
const cases = [
  ['bytes=0-1', 206, 0, 1], ['bytes=3-6', 206, 3, 6],
  ['bytes=7-', 206, 7, 9], ['bytes=-3', 206, 7, 9],
  ['bytes=-50', 206, 0, 9], ['bytes=8-50', 206, 8, 9],
  ...['bytes=10-', 'bytes=5-4', 'bytes=-0', 'bytes=-', 'bytes=0-1,3-4',
    'items=0-1', 'bytes=abc-2', 'bytes=9007199254740992-', 'bytes=0-1junk']
    .map(value => [value, 416]),
];

async function fixture(t) {
  const dist = await mkdtemp(join(tmpdir(), 'wortwerk-ranges-'));
  t.after(() => rm(dist, { recursive: true, force: true }));
  await mkdir(join(dist, 'voice'));
  await writeFile(join(dist, 'index.html'), 'shell');
  await writeFile(join(dist, 'voice', 'sample.mp3'), content);
  await writeFile(join(dist, 'voice', 'empty.mp3'), '');
  return dist;
}

async function checkRanges(request) {
  for (const [range, status, start, end] of cases) {
    const response = await request('/voice/sample.mp3', { headers: { Range: range } });
    assert.equal(response.status, status, range);
    assert.equal(response.headers.get('accept-ranges'), 'bytes', range);
    assert.equal(response.headers.get('content-range'), status === 206
      ? `bytes ${start}-${end}/10` : 'bytes */10', range);
    assert.equal(response.headers.get('content-length'), String(status === 206 ? end - start + 1 : 0));
    if (status === 206) assert.equal(response.headers.get('content-type'), 'audio/mpeg');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), status === 206
      ? content.subarray(start, end + 1) : Buffer.alloc(0), range);
  }
  const full = await request('/voice/sample.mp3');
  assert.equal(full.status, 200);
  assert.deepEqual(Buffer.from(await full.arrayBuffer()), content, 'full file survives ranged reads');
  const empty = await request('/voice/empty.mp3', { headers: { Range: 'bytes=0-' } });
  assert.equal(empty.status, 416);
  assert.equal(empty.headers.get('content-range'), 'bytes */0');
  const html = await request('/index.html', { headers: { Range: 'bytes=0-1' } });
  assert.equal(html.status, 200, 'ranges apply only to MP3');
  assert.equal(await html.text(), 'shell');
}

test('real HTTP serves MP3 single byte ranges and preserves HEAD and other files', async t => {
  const dist = await fixture(t);
  const server = createServer({ env: {}, distDir: dist });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const request = (path, options) => fetch(`http://127.0.0.1:${server.address().port}${path}`, options);
  await checkRanges(request);
  const head = await request('/voice/sample.mp3', { method: 'HEAD', headers: { Range: 'bytes=0-1' } });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('accept-ranges'), 'bytes');
  assert.equal(head.headers.get('content-length'), '10');
  assert.equal((await head.arrayBuffer()).byteLength, 0);
});

test('generated worker serves cached MP3 ranges offline without modifying cached bytes', async t => {
  const dist = await fixture(t);
  const build = await buildOffline(dist);
  assert.ok(build.files.includes('/voice/sample.mp3'));
  const origin = 'https://wortwerk.test';
  const entries = new Map([
    [origin + '/voice/sample.mp3', new Response(content, { headers: { 'Content-Type': 'audio/mpeg' } })],
    [origin + '/voice/empty.mp3', new Response('')],
    [origin + '/index.html', new Response('shell')],
  ]);
  const listeners = new Map();
  let networkCalls = 0;
  vm.runInNewContext(await readFile(join(dist, 'sw.js'), 'utf8'), {
    self: { location: new URL(origin), addEventListener: (name, handler) => listeners.set(name, handler) },
    caches: { open: async () => ({ match: async input => entries.get(typeof input === 'string' ? input : input.url)?.clone() }) },
    fetch: async () => { networkCalls++; throw new Error('offline'); },
    URL, Request, Response, Headers,
  });
  const request = (path, options) => {
    let result;
    listeners.get('fetch')({ request: new Request(origin + path, options), respondWith: promise => { result = promise; } });
    return result;
  };
  await checkRanges(request);
  assert.equal(networkCalls, 0);
  entries.delete(origin + '/voice/sample.mp3');
  await assert.rejects(request('/voice/sample.mp3', { headers: { Range: 'bytes=0-1' } }), /offline/);
  assert.equal(networkCalls, 1, 'cache misses use the existing network fallback');
});
