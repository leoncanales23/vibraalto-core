const SESSION_KEY = 'vibra_session';

export function getSession() {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[shared-core] Invalid session payload', err);
    return null;
  }
}

export function saveSession(payload) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
}

export function clearSession() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(SESSION_KEY);
}
