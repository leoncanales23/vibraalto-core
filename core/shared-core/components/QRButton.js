import { trackEvent } from '../js/analytics.js';

export function createQRButton({ label = 'Escanear QR', onClick } = {}) {
  const button = document.createElement('button');
  button.className = 'vibra-button';
  button.textContent = label;
  button.addEventListener('click', () => {
    trackEvent('qr_button_clicked');
    if (typeof onClick === 'function') onClick();
  });
  return button;
}
