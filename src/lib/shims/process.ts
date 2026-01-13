const nextTick = (cb: () => void) => {
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(cb);
  } else {
    Promise.resolve().then(cb);
  }
};

const globalWithProcess = globalThis as { process?: { env?: Record<string, string>; browser?: boolean; nextTick?: typeof nextTick } };
const existing = globalWithProcess.process ?? {};

globalWithProcess.process = {
  ...existing,
  env: existing.env ?? {},
  browser: true,
  nextTick,
};
