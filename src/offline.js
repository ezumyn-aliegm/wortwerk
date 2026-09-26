// The returned promise settles after the initial installation, even for a waiting update.
// Status concerns the app shell only; learner progress is managed separately by the app.
export async function prepareOffline(onStatus = () => {}) {
  const cleanups = [];
  let stopped = false;
  let lastStatus;
  const report = (status) => {
    if (!stopped && status !== lastStatus) {
      lastStatus = status;
      onStatus(status);
    }
  };
  const cleanup = () => {
    stopped = true;
    for (const remove of cleanups) remove();
  };
  if (!globalThis.isSecureContext || !globalThis.navigator?.serviceWorker) {
    report('unavailable');
    return cleanup;
  }

  report('downloading');
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/', updateViaCache: 'none',
    });
    await new Promise((resolve) => {
      const watched = new Set();
      const ready = () => { report('ready'); resolve(); };
      const unavailable = () => { report('unavailable'); resolve(); };
      const listen = (target, name, handler) => {
        target.addEventListener(name, handler);
        cleanups.push(() => target.removeEventListener(name, handler));
      };
      const watch = (worker) => {
        if (!worker || watched.has(worker)) return;
        watched.add(worker);
        const changed = () => {
          if (['installed', 'activating', 'activated'].includes(worker.state)) ready();
          else if (worker.state === 'redundant') {
            if (registration.active || registration.waiting) ready();
            else unavailable();
          } else if (!registration.active && !registration.waiting) report('downloading');
        };
        listen(worker, 'statechange', changed);
        changed();
      };
      listen(registration, 'updatefound', () => watch(registration.installing));
      watch(registration.installing);
      if (registration.active || registration.waiting) ready();
      else if (!registration.installing) unavailable();
    });
  } catch {
    report('unavailable');
  }
  return cleanup;
}
