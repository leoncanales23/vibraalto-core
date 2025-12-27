const AGE_GATE_KEY = 'vibraalto_age_verified';
const DESTINATION = 'https://vibraalto.cl';
const EXIT_URL = 'https://www.google.com';

if (localStorage.getItem(AGE_GATE_KEY) === 'true') {
  window.location.href = DESTINATION;
}

document.addEventListener('DOMContentLoaded', () => {
  const confirmBtn = document.getElementById('confirmBtn');
  const exitBtn = document.getElementById('exitBtn');

  confirmBtn?.addEventListener('click', () => {
    localStorage.setItem(AGE_GATE_KEY, 'true');
    window.location.href = DESTINATION;
  });

  exitBtn?.addEventListener('click', () => {
    window.location.href = EXIT_URL;
  });
});
