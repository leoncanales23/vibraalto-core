// Elementos del DOM (Asegúrate de que existan en el HTML)
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const statusText = document.getElementById('status-text');
const loader = document.getElementById('camera-loading');
const manualBtn = document.getElementById('manual-entry-btn');

// Elementos de transición del nuevo HTML (Paso 1 y Paso 2)
const stepScanner = document.getElementById('step-scanner'); // Paso 1 (Scanner)
const stepSuccess = document.getElementById('step-success'); // Paso 2 (Éxito)

// Nuevo elemento: Contenedor principal del scanner (ya no se usa para animación de borde, pero se mantiene la referencia por si acaso)
// Se obtiene subiendo dos niveles desde <video> para llegar al contenedor de la tarjeta (el que tiene la clase 'p-2').
const cameraWrapper = video.parentElement.parentElement; 

let modelsLoaded = false;
let streamActive = false;
let detectionLoopId; // Usaremos esto para cancelar requestAnimationFrame
let lastDetectionTime = 0;
const DETECTION_INTERVAL_MS = 500; // Intervalo de tiempo para ejecutar la detección pesada

// 1. FUNCIONES DE UTILIDAD

/**
 * Función que detiene la cámara, limpia el bucle de detección y realiza la transición
 * del Paso 1 (Scanner) al Paso 2 (Éxito).
 */
function grantAccess() {
  // 1. Detener el bucle de requestAnimationFrame
  if (detectionLoopId) {
    cancelAnimationFrame(detectionLoopId);
  }

  // 2. Detener la transmisión de la cámara
  if (video && video.srcObject) {
    const tracks = video.srcObject.getTracks();
    tracks.forEach(track => track.stop());
  }

  // 3. REMOVIDO: ya no se remueve la animación de borde
  /*
  if (cameraWrapper) {
      cameraWrapper.classList.remove('processing-border');
  }
  */

  // 4. Realizar la transición (usando los IDs del HTML)
  console.log("Acceso concedido. Transicionando al contenido de éxito.");
  if (stepScanner && stepSuccess) {
      stepScanner.classList.add('hidden');
      stepSuccess.classList.remove('hidden');
      // Asegurar que Lucide Icons se rendericen correctamente en el nuevo paso
      if (typeof lucide !== 'undefined' && lucide.createIcons) {
          lucide.createIcons();
      }
  } else {
      console.error("Error de transición: No se pudo encontrar el contenedor del escáner ('step-scanner') o el de éxito ('step-success').");
  }
}

// Inicialización del botón manual
if (manualBtn) {
    // 1. Mostrar el botón después de 6 segundos (dar tiempo a la IA)
    setTimeout(() => {
        manualBtn.classList.remove('hidden');
    }, 6000);

    // 2. Enlazar el evento click directamente
    manualBtn.addEventListener('click', grantAccess); 
}


// 2. INICIALIZACIÓN DE LA CÁMARA Y FACE API

/**
 * Carga los modelos de la IA desde la ruta local.
 */
async function loadModels() {
  try {
    // RUTA CORREGIDA: Apuntando a la carpeta local 'models'
    const MODEL_URL = './models';
    
    if (statusText) statusText.innerText = "Cargando modelos IA...";

    await Promise.all([
      // Solo necesitamos 'tinyFaceDetector' y 'ageGenderNet' para este caso
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL)
    ]);
    
    modelsLoaded = true;
    startVideo();
  } catch (err) {
    // Manejo de errores si la IA falla
    console.error("Error al cargar modelos de IA:", err);
    if (statusText) statusText.innerText = "Error IA (Modelos no cargados)";
    if (manualBtn) manualBtn.classList.remove('hidden'); // Mostrar el botón manual si falla la IA
  }
}

/**
 * Inicia la transmisión de video desde la cámara del usuario.
 */
function startVideo() {
  navigator.mediaDevices.getUserMedia({ video: {} })
    .then(stream => {
      video.srcObject = stream;
      // Añadimos un listener para asegurar que el video se cargue y reproduzca antes de la detección
      video.onloadedmetadata = () => {
          video.play();
      };
      streamActive = true;
      if (statusText) statusText.innerText = "Esperando rostro...";
    })
    .catch(err => {
      // Manejo de errores si no hay permisos o la cámara falla
      console.error("Error al acceder a la cámara:", err);
      if (statusText) statusText.innerText = "Cámara no disponible";
      if (manualBtn) manualBtn.classList.remove('hidden');
    });
}

// Variables para almacenar la última detección y asegurar que el recuadro 
// se dibuje continuamente incluso si la detección de la IA es más lenta.
let lastDetectionResult = null;
let successCount = 0;
const MIN_AGE = 18;
const CONFIRM_COUNT = 5;

/**
 * Dibuja los resultados de la última detección en el Canvas.
 * Se llama en cada frame (usando requestAnimationFrame) para mantener la fluidez visual.
 */
function drawDetection(detection) {
    const displaySize = { 
        width: video.videoWidth || video.clientWidth, 
        height: video.videoHeight || video.clientHeight
    };
    faceapi.matchDimensions(canvas, displaySize);
    
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (!detection) return;

    // Re-dimensionar los resultados para el tamaño del Canvas
    const resizedDetections = faceapi.resizeResults([detection], displaySize);
    const result = resizedDetections[0];
    const age = Math.round(result.age);

    // Lógica de dibujo del recuadro
    const box = result.detection.box;
    const boxColor = (age >= MIN_AGE) ? '#e0b539' : '#ff0000'; // Dorado (VibraAlto) o Rojo
    
    context.strokeStyle = boxColor;
    context.lineWidth = 3;
    context.strokeRect(box.x, box.y, box.width, box.height);

    // Dibuja la etiqueta de edad
    context.fillStyle = boxColor;
    context.fillRect(box.x, box.y - 25, 80, 25);
    
    context.font = '16px Arial';
    context.fillStyle = 'black';
    context.fillText(`Edad: ${age}`, box.x + 5, box.y - 8);

    // Lógica de verificación (la IA ya hizo el trabajo pesado)
    if (age >= MIN_AGE) {
        successCount++;
        if (statusText) statusText.innerText = `Verificando... Edad: ${age} - ${successCount}/${CONFIRM_COUNT}`;
        
        if (successCount >= CONFIRM_COUNT) { 
            grantAccess();
        }
    } else {
        successCount = 0;
        if (statusText) statusText.innerText = `Edad insuficiente (<${MIN_AGE}). Detectado: ${age}`;
    }
}

/**
 * Bucle principal de detección que garantiza la fluidez de la UI.
 * Se llama constantemente (RAF), pero la detección pesada se limita a 500ms.
 */
function detectionLoop(timestamp) {
    // 1. Mantener la fluidez: Dibuja el último resultado inmediatamente en cada frame.
    drawDetection(lastDetectionResult);

    // 2. Controlar la detección pesada: Solo ejecutar cada DETECTION_INTERVAL_MS
    if (timestamp - lastDetectionTime > DETECTION_INTERVAL_MS) {
        lastDetectionTime = timestamp;

        // Ejecutar detección de Face API (puede bloquear el hilo brevemente)
        faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withAgeAndGender()
            .then(detection => {
                if (detection) {
                    // Guardar el resultado para que drawDetection lo use en los próximos frames
                    lastDetectionResult = detection;
                } else {
                    lastDetectionResult = null;
                    successCount = 0;
                    if (statusText) statusText.innerText = "Buscando rostro...";
                }
            })
            .catch(err => {
                console.error("Error durante la detección de FaceAPI:", err);
                lastDetectionResult = null;
                successCount = 0;
            });
    }
    
    // 3. Continuar el bucle
    detectionLoopId = requestAnimationFrame(detectionLoop);
}

/**
 * Configura el loop de detección una vez que el video comienza a reproducirse.
 */
video.addEventListener('play', () => {
  if (loader) loader.classList.add('hidden');
  
  // REMOVIDO: Ya no se inicia la animación de borde continuo en el contenedor de la cámara
  /*
  if (cameraWrapper) {
      cameraWrapper.classList.add('processing-border');
  }
  */

  if (statusText) statusText.innerText = "Analizando...";

  // Iniciar el bucle de detección optimizado
  lastDetectionTime = performance.now();
  detectionLoopId = requestAnimationFrame(detectionLoop);
});

// Iniciar la carga de modelos al cargar la página
loadModels();