# VibraAlto Core

Landing estática para hosting (Firebase/GitHub Pages) con filtro +18, Muro de Verdades en solo lectura y hook EXO listo para integrar mensajería.

## Estructura principal

```
public/
├── index.html          # Landing narrativa sin biometría
├── agegate.html        # Filtro +18 (localStorage)
├── agegate.css / js    # Estilos y lógica del age gate
├── muro.html           # Muro de Verdades (Firestore read-only)
├── exoleon-hook.js     # Stub del agente EXO
├── assets/             # Estilos/JS compartidos (incluye core.js y styles.css)
├── media/              # Único origen de audios y HTML auxiliares
└── planb.md            # Protocolo de contingencia (Plan B)
```

`firebase.json` apunta a la carpeta `public` para mantener todo el core en un solo lugar.

## Flujo +18 (WordPress + core)
1. WordPress (o el frontend principal) revisa `localStorage.vibraalto_age_verified` en el `<head>`.
2. Si falta la clave, redirige a `https://leoncanales23.github.io/vibraalto-core/agegate.html` (o al agegate hospedado).
3. El age gate confirma edad, guarda la clave en localStorage y devuelve a `https://vibraalto.cl`.
4. Las páginas del core (index/muro) también verifican la clave y redirigen al agegate si no existe.

## Muro de Verdades
- Lee únicamente desde Firestore (colección `verdades`) usando los SDK de Firebase 10.
- No hay formularios ni endpoints de escritura.
- Si falta configuración (`window.vibraaltoFirebaseConfig`), muestra frases de ejemplo en local.
- Audios (`trueno_neblina_placeholder.mp3`, `susurro_androgino.mp3`) se cargan desde `public/media/verdades-archivo/audio/` y solo se reproducen tras interacción del usuario.

## EXO Hook
`public/exoleon-hook.js` exporta `exoHook(data)`, registrando actividad y reflejando si `corePlanBActive` está habilitado. Importa `assets/core.js` para conocer el estado y notas del Plan B.

## Plan B
- `public/planb.md` documenta acciones y efectos esperados.
- `assets/core.js` define `window.corePlanBActive` (false por defecto) y helpers para consultarlo.
- Al activar Plan B, EXO debe responder sobrio y el Muro muestra badge de contingencia.

## Media centralizada
Todos los recursos compartidos se alojan en `public/media` (blog-futuro, planeta-base-vibra, verdades-archivo). Reutiliza rutas relativas para evitar duplicados entre WordPress y el core.

## Despliegue rápido
1. Sustituye los placeholders de Firebase en `window.vibraaltoFirebaseConfig` (muro.html) antes de publicar.
2. Reemplaza los MP3 de `media/verdades-archivo/audio` por las pistas finales manteniendo nombres.
3. Deploy Firebase: `firebase deploy --only hosting` (requiere CLI configurada).
4. Para GitHub Pages, publica el contenido de `public/`.
