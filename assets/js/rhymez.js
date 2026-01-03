(() => {
  const loader = document.getElementById('camera-loading');
  const statusText = document.getElementById('status-text');
  const successTitle = document.getElementById('success-title');
  const successDescription = document.getElementById('success-description');
  const rhymezMessage = document.getElementById('rhymez-message');

  const setStatus = (message) => {
    if (statusText) statusText.textContent = message;
  };

  const hideLoader = () => {
    if (loader) loader.classList.add('hidden');
  };

  window.cameraControllerOptions = {
    onReady: () => {
      hideLoader();
      setStatus('Mic check: rastreo activo. Mantén tu rostro en cuadro.');
    },
    onAccessGranted: () => {
      setStatus('Flow autorizado. El estudio de Rhymez se abrió para ti.');
      if (successTitle) successTitle.textContent = 'Flow desbloqueado';
      if (successDescription) {
        successDescription.textContent = 'Eres mayor de edad. Prepárate para recibir los mensajes del Guardián del Ritmo.';
      }
      if (rhymezMessage) {
        rhymezMessage.textContent = 'Escucha con atención: cada verso tiene su propósito.';
        rhymezMessage.classList.remove('text-gray-500');
        rhymezMessage.classList.add('text-green-600', 'font-semibold');
      }
    },
    onError: () => {
      hideLoader();
      setStatus('No pudimos activar tu cámara. Activa permisos o usa la entrada manual.');
    }
  };
})();
