import { getConfig } from './config.js';

const eventBuffer = [];

export function trackEvent(name, payload = {}) {
  const config = getConfig();
  if (!config.analytics.enabled) return;
  const entry = { name, payload, ts: Date.now(), provider: config.analytics.provider };
  eventBuffer.push(entry);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vibra:analytics', { detail: entry }));
  }
}

export function flushEvents() {
  const events = eventBuffer.splice(0, eventBuffer.length);
  return events;
}
