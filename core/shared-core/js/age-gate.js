import { getSession, saveSession } from './session.js';

const AGE_FLAG = 'age_verified';

export function hasPassedAgeGate() {
  const session = getSession();
  return Boolean(session && session[AGE_FLAG]);
}

export function markAgeGateComplete() {
  const session = getSession() || {};
  session[AGE_FLAG] = true;
  saveSession(session);
}

export function requireAdult(onFail) {
  if (!hasPassedAgeGate() && typeof onFail === 'function') {
    onFail();
    return false;
  }
  return true;
}
