import { isPlanBActive, getPlanBNotes } from './assets/core.js';

export function exoHook(data) {
  const planBState = isPlanBActive();
  const notes = getPlanBNotes();

  console.log('EXO Hook recibido:', data);
  if (planBState) {
    console.log('Plan B activo. Responder con protocolo de contingencia.', notes);
  } else {
    console.log('Plan B inactivo. Continuidad normal.');
  }
}
