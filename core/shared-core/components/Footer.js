export function createFooter(text, options = {}) {
  const el = document.createElement('footer');
  el.className = options.className || 'vibra-footer';
  const span = document.createElement('span');
  span.textContent = text || '© Vibra';
  el.appendChild(span);
  if (options.links && Array.isArray(options.links)) {
    const nav = document.createElement('nav');
    options.links.forEach(({ label, href }) => {
      const link = document.createElement('a');
      link.href = href || '#';
      link.textContent = label;
      nav.appendChild(link);
    });
    el.appendChild(nav);
  }
  return el;
}
