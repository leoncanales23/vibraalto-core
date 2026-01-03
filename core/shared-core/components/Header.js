export function createHeader(title, options = {}) {
  const el = document.createElement('header');
  el.className = options.className || 'vibra-header';
  const h1 = document.createElement('h1');
  h1.textContent = title || 'Vibra';
  el.appendChild(h1);
  if (options.actions && Array.isArray(options.actions)) {
    const actions = document.createElement('div');
    actions.className = 'vibra-header__actions';
    options.actions.forEach((action) => action && actions.appendChild(action));
    el.appendChild(actions);
  }
  return el;
}
