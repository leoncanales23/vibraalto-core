// Elementos del DOM (Asegúrate de que existan en el HTML)
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const statusText = document.getElementById('status-text');
const loader = document.getElementById('camera-loading');
const manualBtn = document.getElementById('manual-entry-btn');
const vibraCanvas = document.getElementById('vibra-field');
const audioToggle = document.getElementById('audio-toggle');
const audioStatus = document.getElementById('audio-status');
const presetOptions = document.getElementById('preset-options');
const presetDescription = document.getElementById('preset-description');

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
      activateVibraField();
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

// ------------------------------------------
// Experiencia sensorial: gestos + audio-reactive + presets
// ------------------------------------------

const vibraPresets = [
  {
    id: 'aurora',
    name: 'Aurora Solar',
    tags: ['Visión', 'Ritual'],
    description: 'Capas aurorales que reaccionan al pulso de tu gesto y al brillo de las frecuencias altas.',
    colorA: [0.12, 0.07, 0.22],
    colorB: [0.75, 0.62, 0.98],
    glow: [0.85, 0.65, 0.25],
    noiseScale: 3.2,
    storyPulse: 0.5
  },
  {
    id: 'selva',
    name: 'Selva Subterránea',
    tags: ['Raíz', 'Pulso'],
    description: 'Un tapiz verde y ámbar que se ondula con graves, como raíces que respiran.',
    colorA: [0.06, 0.15, 0.1],
    colorB: [0.33, 0.64, 0.47],
    glow: [0.92, 0.67, 0.15],
    noiseScale: 2.2,
    storyPulse: 0.7
  },
  {
    id: 'nocturna',
    name: 'Órbita Nocturna',
    tags: ['Círculos', 'Futuro'],
    description: 'Vórtices morados que se dejan guiar por la trayectoria de tu cursor.',
    colorA: [0.08, 0.05, 0.16],
    colorB: [0.48, 0.32, 0.96],
    glow: [0.3, 0.68, 0.98],
    noiseScale: 4.1,
    storyPulse: 0.9
  }
];

const vibraState = {
  initialized: false,
  gl: null,
  program: null,
  attribLocations: {},
  uniformLocations: {},
  forcePoints: [],
  maxForces: 4,
  audioContext: null,
  analyser: null,
  audioData: null,
  audioLevel: 0,
  audioStream: null,
  animationId: null,
  currentPreset: vibraPresets[0],
  lastPointer: null
};

function activateVibraField() {
  if (!vibraCanvas || vibraState.initialized) {
    if (vibraCanvas) resizeVibraCanvas();
    return;
  }

  initPresetPanel();
  if (!initVibraGL()) return;
  vibraState.initialized = true;
  resizeVibraCanvas();
  startVibraLoop();
}

function initPresetPanel() {
  if (!presetOptions || !presetDescription) return;
  presetOptions.innerHTML = '';

  vibraPresets.forEach((preset, index) => {
    const card = document.createElement('button');
    card.className = 'preset-card';
    card.setAttribute('type', 'button');
    card.dataset.presetId = preset.id;

    const textWrapper = document.createElement('div');
    const title = document.createElement('p');
    title.className = 'text-sm font-semibold text-gray-900';
    title.textContent = preset.name;
    const tags = document.createElement('div');
    tags.className = 'flex items-center gap-2 mt-1';

    preset.tags.forEach(tag => {
      const chip = document.createElement('span');
      chip.className = 'preset-chip primary';
      chip.textContent = tag;
      tags.appendChild(chip);
    });

    textWrapper.appendChild(title);
    textWrapper.appendChild(tags);

    const icon = document.createElement('span');
    icon.className = 'text-xs font-semibold text-purple-600';
    icon.textContent = '▶';

    card.appendChild(textWrapper);
    card.appendChild(icon);

    card.addEventListener('click', () => {
      vibraState.currentPreset = preset;
      updatePresetSelection(preset.id);
    });

    if (index === 0) card.classList.add('active');
    presetOptions.appendChild(card);
  });

  presetDescription.textContent = vibraState.currentPreset.description;
}

function updatePresetSelection(id) {
  if (!presetOptions || !presetDescription) return;
  const cards = presetOptions.querySelectorAll('.preset-card');
  cards.forEach(card => {
    card.classList.toggle('active', card.dataset.presetId === id);
  });
  presetDescription.textContent = vibraState.currentPreset.description;
}

function initVibraGL() {
  const gl = vibraCanvas.getContext('webgl');
  if (!gl) {
    console.error('WebGL no disponible para el canvas interactivo.');
    return false;
  }

  const vertexSrc = `
    attribute vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fragmentSrc = `
    precision highp float;
    #define MAX_FORCES 4
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform int u_forceCount;
    uniform vec3 u_forcePoints[MAX_FORCES];
    uniform float u_audioLevel;
    uniform vec3 u_colorA;
    uniform vec3 u_colorB;
    uniform vec3 u_glowColor;
    uniform float u_noiseScale;
    uniform float u_storyPulse;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution.xy;
      vec2 centered = uv - 0.5;
      centered.x *= u_resolution.x / u_resolution.y;

      float time = u_time * 0.2;
      float n = noise(uv * u_noiseScale + time);
      float swirl = sin((uv.x + uv.y) * (3.1416 + u_storyPulse) + time * 3.0);

      float field = 0.0;
      for (int i = 0; i < MAX_FORCES; i++) {
        if (i >= u_forceCount) break;
        vec3 fp = u_forcePoints[i];
        float dist = length(uv - fp.xy);
        float influence = fp.z * exp(-12.0 * dist);
        field += influence;
      }

      float audioGlow = u_audioLevel * (0.5 + 0.5 * noise(uv * 8.0 + time * 2.0));
      float mask = clamp(0.4 + swirl * 0.15 + field, 0.0, 1.0);
      vec3 base = mix(u_colorA, u_colorB, mask);
      vec3 finalColor = base + u_glowColor * (audioGlow + field * 0.4);

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSrc);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
  if (!vertexShader || !fragmentShader) return false;
  const program = linkProgram(gl, vertexShader, fragmentShader);
  if (!program) return false;

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1, 1, -1, -1, 1,
    -1, 1, 1, -1, 1, 1
  ]), gl.STATIC_DRAW);

  const attribLocations = {
    position: gl.getAttribLocation(program, 'a_position')
  };

  const uniformLocations = {
    resolution: gl.getUniformLocation(program, 'u_resolution'),
    time: gl.getUniformLocation(program, 'u_time'),
    forceCount: gl.getUniformLocation(program, 'u_forceCount'),
    forcePoints: gl.getUniformLocation(program, 'u_forcePoints'),
    audioLevel: gl.getUniformLocation(program, 'u_audioLevel'),
    colorA: gl.getUniformLocation(program, 'u_colorA'),
    colorB: gl.getUniformLocation(program, 'u_colorB'),
    glowColor: gl.getUniformLocation(program, 'u_glowColor'),
    noiseScale: gl.getUniformLocation(program, 'u_noiseScale'),
    storyPulse: gl.getUniformLocation(program, 'u_storyPulse')
  };

  gl.useProgram(program);
  gl.enableVertexAttribArray(attribLocations.position);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.vertexAttribPointer(attribLocations.position, 2, gl.FLOAT, false, 0, 0);

  vibraState.gl = gl;
  vibraState.program = program;
  vibraState.attribLocations = attribLocations;
  vibraState.uniformLocations = uniformLocations;

  vibraCanvas.addEventListener('pointermove', handlePointerForce);
  vibraCanvas.addEventListener('pointerdown', handlePointerForce);
  window.addEventListener('resize', resizeVibraCanvas);
  if (audioToggle) audioToggle.addEventListener('click', toggleAudioReactive);

  return true;
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Error compilando shader:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function linkProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Error enlazando programa:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function resizeVibraCanvas() {
  if (!vibraCanvas || !vibraState.gl) return;
  const dpr = window.devicePixelRatio || 1;
  const { width, height } = vibraCanvas.getBoundingClientRect();
  const safeWidth = width || 640;
  const safeHeight = height || 360;
  vibraCanvas.width = safeWidth * dpr;
  vibraCanvas.height = safeHeight * dpr;
  vibraState.gl.viewport(0, 0, vibraCanvas.width, vibraCanvas.height);
}

function handlePointerForce(event) {
  if (!vibraCanvas) return;
  const rect = vibraCanvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = 1 - (event.clientY - rect.top) / rect.height;
  const now = performance.now();

  let strength = 0.8;
  if (vibraState.lastPointer) {
    const dx = vibraState.lastPointer.x - x;
    const dy = vibraState.lastPointer.y - y;
    const dt = Math.max(now - vibraState.lastPointer.time, 16);
    const speed = Math.sqrt(dx * dx + dy * dy) / dt;
    strength = Math.min(1.2, 0.4 + speed * 180);
  }

  vibraState.lastPointer = { x, y, time: now };
  vibraState.forcePoints.push({ x, y, strength, life: 1 });
  if (vibraState.forcePoints.length > vibraState.maxForces) vibraState.forcePoints.shift();
}

function toggleAudioReactive() {
  if (vibraState.audioContext) {
    stopAudioReactive();
    return;
  }
  startAudioReactive();
}

async function startAudioReactive() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    vibraState.audioContext = audioContext;
    vibraState.analyser = analyser;
    vibraState.audioData = new Uint8Array(analyser.frequencyBinCount);
    vibraState.audioStream = stream;

    if (audioStatus) audioStatus.textContent = 'Audio-reactive activo';
    if (audioToggle) audioToggle.textContent = 'Desactivar audio';
  } catch (err) {
    console.error('No se pudo iniciar el audio-reactive:', err);
    if (audioStatus) audioStatus.textContent = 'Permisos de audio rechazados';
  }
}

function stopAudioReactive() {
  if (vibraState.audioStream) {
    vibraState.audioStream.getTracks().forEach(track => track.stop());
  }
  if (vibraState.audioContext) {
    vibraState.audioContext.close();
  }
  vibraState.audioContext = null;
  vibraState.analyser = null;
  vibraState.audioData = null;
  vibraState.audioStream = null;
  vibraState.audioLevel = 0;
  if (audioStatus) audioStatus.textContent = 'Audio-reactive inactivo';
  if (audioToggle) audioToggle.textContent = 'Activar audio-reactive';
}

function readAudioLevel() {
  if (!vibraState.analyser || !vibraState.audioData) {
    vibraState.audioLevel = 0;
    return;
  }
  vibraState.analyser.getByteFrequencyData(vibraState.audioData);
  let sum = 0;
  for (let i = 0; i < vibraState.audioData.length; i++) {
    sum += vibraState.audioData[i];
  }
  const avg = sum / vibraState.audioData.length;
  vibraState.audioLevel = Math.min(1, avg / 255);
}

function startVibraLoop() {
  if (!vibraState.gl || !vibraState.program) return;

  const render = (timestamp) => {
    if (!vibraState.gl) return;
    readAudioLevel();
    updateForces();
    drawFrame(timestamp);
    vibraState.animationId = requestAnimationFrame(render);
  };

  vibraState.animationId = requestAnimationFrame(render);
}

function updateForces() {
  vibraState.forcePoints = vibraState.forcePoints
    .map(force => ({ ...force, life: force.life - 0.015 }))
    .filter(force => force.life > 0);
}

function drawFrame(timestamp) {
  const gl = vibraState.gl;
  if (!gl) return;

  gl.useProgram(vibraState.program);

  const preset = vibraState.currentPreset;

  gl.uniform2f(vibraState.uniformLocations.resolution, vibraCanvas.width, vibraCanvas.height);
  gl.uniform1f(vibraState.uniformLocations.time, timestamp / 1000);
  gl.uniform1i(vibraState.uniformLocations.forceCount, vibraState.forcePoints.length);

  const forceArray = new Float32Array(vibraState.maxForces * 3);
  vibraState.forcePoints.forEach((force, index) => {
    const base = index * 3;
    forceArray[base] = force.x;
    forceArray[base + 1] = force.y;
    forceArray[base + 2] = force.strength * force.life;
  });
  gl.uniform3fv(vibraState.uniformLocations.forcePoints, forceArray);
  gl.uniform1f(vibraState.uniformLocations.audioLevel, vibraState.audioLevel);
  gl.uniform3fv(vibraState.uniformLocations.colorA, preset.colorA);
  gl.uniform3fv(vibraState.uniformLocations.colorB, preset.colorB);
  gl.uniform3fv(vibraState.uniformLocations.glowColor, preset.glow);
  gl.uniform1f(vibraState.uniformLocations.noiseScale, preset.noiseScale);
  gl.uniform1f(vibraState.uniformLocations.storyPulse, preset.storyPulse);

  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

// En caso de que el usuario cargue directamente el paso de éxito (por SPA), intenta inicializar
if (stepSuccess && !stepSuccess.classList.contains('hidden')) {
  activateVibraField();
}
