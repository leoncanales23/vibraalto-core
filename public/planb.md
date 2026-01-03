# Plan B — VibraAlto Core

> Modo de continuidad sin biometría ni dependencias críticas. Activa el flag `corePlanBActive` (window) para que EXO y el Muro reaccionen.

## Objetivos
- Mantener el acceso al core a través de GitHub Pages y agegate.html.
- Responder con mensajes sobrios desde EXO cuando haya incidentes.
- Priorizar la lectura (no escritura) en el Muro de Verdades.
- Minimizar dependencias externas hasta normalizar servicios.

## Activación
1. Define `window.corePlanBActive = true` en el entorno que monte el core o importa `setPlanBActive(true)` desde `assets/core.js`.
2. Opcional: añade detalles adicionales en `window.corePlanBNotes` para que los servicios sepan qué hacer.

## Efectos esperados
- **Age gate**: sigue siendo obligatorio; no se salta bajo ningún contexto.
- **EXO**: el hook debe responder con mensajes concisos, evitando promesas que dependan de proveedores caídos.
- **Muro de Verdades**: opera solo lectura con fallback local (ver `muro.html`).
- **WP/Front**: cualquier script de WordPress debe redirigir a `agegate.html` si `localStorage.vibraalto_age_verified` no está en `true`.

## Playbook rápido
- Hosting con problemas → Servir directamente desde `public/` en GitHub Pages.
- Firestore inaccesible → usar los placeholders locales descritos en `muro.html` y comunicar incidencia a EXO.
- Canal WhatsApp/Correo caído → derivar a mensaje fijo en WP y registrar en EXO para seguimiento manual.
- Assets faltantes → verificar rutas en `public/media` antes de re-subir.

## Restauración
- Una vez normalizado, cambia `corePlanBActive` a `false` y verifica que Firestore, audios y WP respondan sin redirecciones inesperadas.
