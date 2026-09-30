import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const defaultDist = fileURLToPath(new URL('../dist/', import.meta.url));

// Only public build output belongs here. Never enumerate API data or runtime storage.
export async function buildOffline(dist = defaultDist) {
  dist = resolve(dist);
  const files = ['index.html'];
  const rootFiles = await readdir(dist);
  for (const name of ['favicon.svg', 'app-icon.svg', 'manifest.webmanifest']) {
    if (rootFiles.includes(name)) files.push(name);
  }
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) files.push(relative(dist, path).split(sep).join('/'));
    }
  }
  if (rootFiles.includes('assets')) await visit(resolve(dist, 'assets'));
  if (rootFiles.includes('voice')) await visit(resolve(dist, 'voice'));
  files.sort();
  const urls = files.map((file) => '/' + file.split('/').map(encodeURIComponent).join('/'));
  const body = `
const SHELL = ${JSON.stringify(urls)};
const SHELL_URLS = new Set(SHELL.map(path => new URL(path, self.location.origin).href));

function audioRange(value, size) {
  const match = /^bytes=(\\d*)-(\\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2]) || !size) return null;
  const first = match[1] ? Number(match[1]) : null;
  const last = match[2] ? Number(match[2]) : null;
  if ((first !== null && !Number.isSafeInteger(first)) ||
      (last !== null && !Number.isSafeInteger(last))) return null;
  if (first === null) return last > 0 ? [Math.max(0, size - last), size - 1] : null;
  if (first >= size || (last !== null && last < first)) return null;
  return [first, Math.min(last ?? size - 1, size - 1)];
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const existed = await caches.has(CACHE_NAME);
    const cache = await caches.open(CACHE_NAME);
    try {
      // addAll commits one atomic batch: a failed download cannot leave a partial shell.
      await cache.addAll(SHELL.map(path => new Request(new URL(path, self.location.origin), {
        cache: 'reload', credentials: 'omit', redirect: 'error'
      })));
    } catch (error) {
      if (!existed) await caches.delete(CACHE_NAME);
      throw error;
    }
    // No skipWaiting: open lessons keep their existing worker and cached assets.
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('wortwerk-shell-') && key !== CACHE_NAME) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin ||
      url.pathname === '/api' || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(request, { redirect: 'error' });
      } catch (error) {
        const cache = await caches.open(CACHE_NAME);
        const shell = await cache.match('/index.html');
        if (shell) return shell;
        throw error;
      }
    })());
  } else if (SHELL_URLS.has(url.href)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const isAudio = url.pathname.toLowerCase().endsWith('.mp3');
      // Match the full precached response without Range or other request headers.
      const cached = await cache.match(isAudio ? url.href : request);
      if (!cached) return fetch(request, { redirect: 'error' });
      const rangeHeader = request.headers?.get('range');
      if (!isAudio || rangeHeader == null || cached.status !== 200) return cached;
      const content = await cached.arrayBuffer();
      const range = audioRange(rangeHeader, content.byteLength);
      const headers = new Headers(cached.headers);
      headers.set('Accept-Ranges', 'bytes');
      if (!range) {
        headers.set('Content-Range', 'bytes */' + content.byteLength);
        headers.set('Content-Length', '0');
        return new Response(null, { status: 416, headers });
      }
      const [start, end] = range;
      headers.set('Content-Type', 'audio/mpeg');
      headers.set('Content-Range', 'bytes ' + start + '-' + end + '/' + content.byteLength);
      headers.set('Content-Length', String(end - start + 1));
      return new Response(content.slice(start, end + 1), { status: 206, headers });
    })());
  }
});
`;
  const hash = createHash('sha256').update(body);
  for (const file of files) {
    const content = await readFile(resolve(dist, file));
    hash.update(JSON.stringify([file, content.length])).update(content);
  }
  const version = hash.digest('hex');
  await writeFile(resolve(dist, 'sw.js'), `const CACHE_NAME = 'wortwerk-shell-${version}';\n${body}`);
  return { version, files: urls };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { version, files } = await buildOffline();
  console.log(`Offline shell: ${files.length} files (${version.slice(0, 12)})`);
}
