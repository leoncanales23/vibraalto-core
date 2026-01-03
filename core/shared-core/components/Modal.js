export function createModal({ title, content, onClose } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'vibra-modal__overlay';

  const modal = document.createElement('div');
  modal.className = 'vibra-modal';

  const header = document.createElement('div');
  header.className = 'vibra-modal__header';
  const heading = document.createElement('h3');
  heading.textContent = title || '';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'vibra-button';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => {
    close();
    if (typeof onClose === 'function') onClose();
  });
  header.appendChild(heading);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'vibra-modal__body';
  if (content instanceof Node) {
    body.appendChild(content);
  } else if (content) {
    body.innerHTML = content;
  }

  modal.appendChild(header);
  modal.appendChild(body);
  overlay.appendChild(modal);

  function close() {
    overlay.remove();
  }

  function open() {
    document.body.appendChild(overlay);
  }

  return { overlay, open, close };
}
