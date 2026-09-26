import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { buildOffline } from '../scripts/build-offline.mjs';
import { prepareOffline } from '../src/offline.js';

const origin = 'https://wortwerk.test';

async function fixture(t) {
  const dist = await mkdtemp(join(tmpdir(), 'wortwerk-offline-'));
  t.after(() => rm(dist, { recursive: true, force: true }));
  await mkdir(join(dist, 'assets', 'nested'), { recursive: true });
  const files = {
    'index.html': '<html>Wortwerk shell</html>',
    'assets/main.js': 'console.log("lesson")',
    'assets/nested/lesson.json': '{"word":"lernen"}',
    'manifest.webmanifest': '{"name":"Wortwerk"}',
    'app-icon.svg': '<svg/>',
    'favicon.svg': '<svg/>',
    'learner-backup.json': '{"private":true}',
  };
  for (const [file, content] of Object.entries(files)) await writeFile(join(dist, file), content);
  const build = await buildOffline(dist);
  return { dist, files, build, source: await readFile(join(dist, 'sw.js'), 'utf8') };
}

function environment(files) {
  const stores = new Map();
  const requests = [];
  let offline = false;
  let failPath;
  let failureStatus;
  const key = (input) => new URL(typeof input === 'string' ? input : input.url, origin).href;
  const fetch = async (input, options = {}) => {
    const url = new URL(key(input));
    requests.push({ url: url.href, redirect: options.redirect ?? input.redirect, credentials: input.credentials });
    assert.equal(url.origin, origin, 'worker must never fetch another origin');
    assert.equal(options.redirect ?? input.redirect, 'error', 'redirects cannot escape the origin');
    if (offline) throw new TypeError('Network unavailable');
    if (url.pathname === failPath) {
      if (failureStatus) return new Response('Failed shell download', { status: failureStatus });
      throw new TypeError('Network unavailable');
    }
    const content = files[url.pathname.slice(1)];
    return new Response(content ?? 'live navigation, possibly private', { status: 200 });
  };
  const caches = {
    has: async (name) => stores.has(name),
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
    open: async (name) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        match: async (input) => entries.get(key(input))?.clone(),
        // Cache.addAll is an atomic batch, as in the browser: stage every response first.
        addAll: async (inputs) => {
          const responses = await Promise.all(inputs.map(fetch));
          if (responses.some((response) => !response.ok)) throw new TypeError('Bad precache response');
          inputs.forEach((input, i) => entries.set(key(input), responses[i].clone()));
        },
      };
    },
  };
  const load = (source) => {
    const listeners = new Map();
    let claims = 0;
    let skips = 0;
    const self = {
      location: new URL('/sw.js', origin),
      clients: { claim: async () => { claims++; } },
      skipWaiting: () => { skips++; },
      addEventListener: (name, handler) => listeners.set(name, handler),
    };
    vm.runInNewContext(source, { self, caches, fetch, Request, Response, URL, Set });
    return {
      lifecycle: async (name) => {
        let completion;
        listeners.get(name)({ waitUntil: (promise) => { completion = promise; } });
        await completion;
      },
      request: (path, options = {}) => {
        let response;
        const request = { url: new URL(path, origin).href, method: 'GET', mode: 'cors', ...options };
        listeners.get('fetch')({ request, respondWith: (promise) => { response = promise; } });
        return response;
      },
      get claims() { return claims; },
      get skips() { return skips; },
    };
  };
  return {
    stores, requests, load,
    setOffline: (value) => { offline = value; },
    fail: (path, status) => { failPath = path; failureStatus = status; },
  };
}

test('version hashes every shell file and nested asset; repeated builds are stable', async (t) => {
  const { dist, build } = await fixture(t);
  assert.equal((await buildOffline(dist)).version, build.version, 'generated sw.js is excluded');
  assert.ok(build.files.includes('/assets/nested/lesson.json'));
  assert.ok(!build.files.includes('/learner-backup.json'));
  let previous = build.version;
  for (const path of build.files) {
    await writeFile(join(dist, path.slice(1)), `changed ${path}`);
    const next = (await buildOffline(dist)).version;
    assert.notEqual(next, previous, path);
    previous = next;
  }
  await writeFile(join(dist, 'assets', 'extra.js'), 'new asset');
  assert.notEqual((await buildOffline(dist)).version, previous);
});

test('installed assets and navigation work offline without caching live navigation or learner data', async (t) => {
  const { files, source, build } = await fixture(t);
  const env = environment(files);
  const worker = env.load(source);
  await worker.lifecycle('install');
  assert.equal(worker.skips, 0);
  assert.ok(env.requests.every((request) => request.credentials === 'omit'));
  const cache = env.stores.get(`wortwerk-shell-${build.version}`);
  assert.deepEqual([...cache.keys()].sort(), build.files.map((path) => origin + path).sort());
  assert.equal(await (await worker.request('/lesson?learner=private', { mode: 'navigate' })).text(),
    'live navigation, possibly private');
  assert.equal(cache.size, build.files.length, 'navigation response must never be stored');
  env.setOffline(true);
  const before = env.requests.length;
  assert.equal(await (await worker.request('/assets/main.js')).text(), files['assets/main.js']);
  assert.equal(await (await worker.request('/assets/nested/lesson.json')).text(), files['assets/nested/lesson.json']);
  assert.equal(env.requests.length, before, 'cached assets do not need a network request');
  assert.equal(await (await worker.request('/lesson?learner=private', { mode: 'navigate' })).text(), files['index.html']);
  assert.equal(cache.size, build.files.length);
});

test('API requests never get a cached response or navigation fallback, online or offline', async (t) => {
  const { files, source } = await fixture(t);
  const env = environment(files);
  const worker = env.load(source);
  await worker.lifecycle('install');
  for (const offline of [false, true]) {
    env.setOffline(offline);
    const before = env.requests.length;
    for (const path of ['/api', '/api/', '/api/progress', '/api/session?learner=1']) {
      for (const mode of ['cors', 'navigate']) {
        assert.equal(worker.request(path, { mode }), undefined, `${path}: ${mode}`);
      }
    }
    assert.equal(env.requests.length, before, 'API remains entirely outside the service worker');
  }
  for (const store of env.stores.values()) {
    assert.ok([...store.keys()].every((url) => !new URL(url).pathname.startsWith('/api')));
  }
});

test('cross-origin, non-GET, and non-shell requests are untouched', async (t) => {
  const { files, source } = await fixture(t);
  const env = environment(files);
  const worker = env.load(source);
  await worker.lifecycle('install');
  const before = env.requests.length;
  assert.equal(worker.request('https://external.test/assets/main.js'), undefined);
  assert.equal(worker.request('https://external.test/', { mode: 'navigate' }), undefined);
  assert.equal(worker.request('/assets/main.js', { method: 'POST' }), undefined);
  assert.equal(worker.request('/learner-backup.json'), undefined);
  assert.equal(worker.request('/assets/main.js?private=1'), undefined);
  assert.equal(env.requests.length, before);
});

test('failed update leaves old shell usable; activation deletes only older Wortwerk shells', async (t) => {
  const { dist, files, source, build } = await fixture(t);
  const env = environment(files);
  const oldWorker = env.load(source);
  await oldWorker.lifecycle('install');
  const oldName = `wortwerk-shell-${build.version}`;
  env.stores.set('another-app', new Map());
  env.stores.set('wortwerk-learner-storage', new Map());
  files['assets/main.js'] = 'new lesson';
  await writeFile(join(dist, 'assets', 'main.js'), files['assets/main.js']);
  const next = await buildOffline(dist);
  const nextName = `wortwerk-shell-${next.version}`;
  const newWorker = env.load(await readFile(join(dist, 'sw.js'), 'utf8'));
  env.fail('/assets/main.js');
  await assert.rejects(newWorker.lifecycle('install'), /Network unavailable/);
  assert.ok(env.stores.has(oldName));
  assert.ok(!env.stores.has(nextName), 'failed install leaves no partial shell');
  env.fail('/assets/main.js', 503);
  await assert.rejects(newWorker.lifecycle('install'), /Bad precache response/);
  assert.ok(env.stores.has(oldName));
  assert.ok(!env.stores.has(nextName), 'HTTP failure also leaves no partial shell');
  env.setOffline(true);
  assert.equal(await (await oldWorker.request('/assets/main.js')).text(), 'console.log("lesson")');
  env.setOffline(false);
  env.fail(undefined);
  await newWorker.lifecycle('install');
  assert.equal(newWorker.skips, 0);
  assert.ok(env.stores.has(oldName), 'successful update retains old shell until activation');
  assert.equal(await (await oldWorker.request('/assets/main.js')).text(), 'console.log("lesson")');
  await newWorker.lifecycle('activate');
  assert.equal(newWorker.claims, 1);
  assert.deepEqual([...env.stores.keys()].sort(), ['another-app', 'wortwerk-learner-storage', nextName].sort());
});

test('a failed same-version install does not delete an already complete cache', async (t) => {
  const { files, source, build } = await fixture(t);
  const env = environment(files);
  await env.load(source).lifecycle('install');
  env.setOffline(true);
  await assert.rejects(env.load(source).lifecycle('install'));
  assert.equal(env.stores.get(`wortwerk-shell-${build.version}`).size, build.files.length);
});

function browser(t, registration, { secure = true, supported = true, reject = false } = {}) {
  const saved = ['navigator', 'isSecureContext'].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  let registrations = 0;
  Object.defineProperty(globalThis, 'isSecureContext', { configurable: true, value: secure });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: supported ? { serviceWorker: {
      register: async (url, options) => {
        registrations++;
        assert.equal(url, '/sw.js');
        assert.equal(options.scope, '/');
        assert.equal(options.updateViaCache, 'none');
        if (reject) throw new Error('Registration denied');
        return registration;
      },
      get ready() { throw new Error('Must not wait indefinitely for activation'); },
    } } : {},
  });
  t.after(() => {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  return () => registrations;
}

function registration(state) {
  const worker = Object.assign(new EventTarget(), { state });
  const registration = Object.assign(new EventTarget(), {
    installing: state === 'installing' ? worker : null,
    waiting: state === 'installed' ? worker : null,
    active: state === 'activated' ? worker : null,
  });
  return { worker, registration };
}

test('prepareOffline waits for completed initial precache, not activation, and cleans up listeners', async (t) => {
  const setup = registration('installing');
  browser(t, setup.registration);
  const statuses = [];
  let settled = false;
  const result = prepareOffline((status) => statuses.push(status)).then((cleanup) => { settled = true; return cleanup; });
  await new Promise(setImmediate);
  assert.equal(settled, false);
  assert.deepEqual(statuses, ['downloading']);
  setup.worker.state = 'installed';
  setup.worker.dispatchEvent(new Event('statechange'));
  const cleanup = await result;
  assert.deepEqual(statuses, ['downloading', 'ready']);
  cleanup();
  setup.worker.state = 'redundant';
  setup.worker.dispatchEvent(new Event('statechange'));
  assert.deepEqual(statuses, ['downloading', 'ready']);
});

for (const state of ['installed', 'activated']) {
  test(`prepareOffline resolves for an already ${state} worker`, { timeout: 1000 }, async (t) => {
    browser(t, registration(state).registration);
    const statuses = [];
    const cleanup = await prepareOffline((status) => statuses.push(status));
    assert.deepEqual(statuses, ['downloading', 'ready']);
    cleanup();
  });
}

test('prepareOffline reports initial installation failure', async (t) => {
  const setup = registration('installing');
  browser(t, setup.registration);
  const statuses = [];
  const result = prepareOffline((status) => statuses.push(status));
  await new Promise(setImmediate);
  setup.worker.state = 'redundant';
  setup.worker.dispatchEvent(new Event('statechange'));
  (await result)();
  assert.deepEqual(statuses, ['downloading', 'unavailable']);
});

test('an update failure keeps readiness when an old active worker exists', async (t) => {
  const setup = registration('activated');
  browser(t, setup.registration);
  const statuses = [];
  const cleanup = await prepareOffline((status) => statuses.push(status));
  const update = Object.assign(new EventTarget(), { state: 'installing' });
  setup.registration.installing = update;
  setup.registration.dispatchEvent(new Event('updatefound'));
  update.state = 'redundant';
  update.dispatchEvent(new Event('statechange'));
  assert.deepEqual(statuses, ['downloading', 'ready']);
  cleanup();
});

for (const options of [{ secure: false }, { supported: false }, { reject: true }]) {
  test(`prepareOffline handles unavailable service worker: ${JSON.stringify(options)}`, async (t) => {
    const count = browser(t, undefined, options);
    const statuses = [];
    const cleanup = await prepareOffline((status) => statuses.push(status));
    assert.equal(statuses.at(-1), 'unavailable');
    assert.equal(count(), options.reject ? 1 : 0);
    cleanup();
  });
}
