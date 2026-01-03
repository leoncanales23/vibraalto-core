const defaultPlanB = {
  objetivo: 'Mantener continuidad del core sin biometría',
  acciones: [
    'Redirigir tráfico únicamente vía agegate y rutas estáticas del core.',
    'Responder desde EXO con mensajes cortos y factuales si hay incidentes.',
    'Priorizar la lectura del Muro de Verdades en modo solo lectura.',
    'Elevar alertas cuando un proveedor clave falle (hosting, auth, WhatsApp).'
  ]
};

if (!('corePlanBActive' in window)) {
  window.corePlanBActive = false;
}

if (!('corePlanBNotes' in window)) {
  window.corePlanBNotes = defaultPlanB;
}

export function isPlanBActive() {
  return window.corePlanBActive === true;
}

export function setPlanBActive(state) {
  window.corePlanBActive = Boolean(state);
  document.dispatchEvent(new CustomEvent('planbchange', { detail: { active: window.corePlanBActive } }));
}

export function getPlanBNotes() {
  return window.corePlanBNotes;
}
