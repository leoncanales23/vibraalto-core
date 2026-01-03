const BRIDGE_EVENT = 'exo:bridge';

export function notifyExo(event, detail = {}) {
  if (typeof window === 'undefined') return;
  const payload = { event, detail, ts: Date.now() };
  window.dispatchEvent(new CustomEvent(BRIDGE_EVENT, { detail: payload }));
}

export function listenToExo(callback) {
  if (typeof window === 'undefined' || typeof callback !== 'function') return () => {};
  const handler = (evt) => callback(evt.detail);
  window.addEventListener(BRIDGE_EVENT, handler);
  return () => window.removeEventListener(BRIDGE_EVENT, handler);
}
