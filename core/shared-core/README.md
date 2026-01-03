# shared-core

La capa `shared-core` centraliza estilos, utilidades y componentes DOM reutilizables
para las experiencias Vibra. Se mantiene agnóstica a frameworks y sin dependencias
externas para convivir con implementaciones estáticas o legadas.

## Contenido
- `styles/`: variables de tema, reset base y tokens de la identidad Vibra.
- `js/`: helpers de configuración, sesión, analytics y puentes de integración.
- `components/`: bloques presentacionales que operan con APIs nativas del DOM.

## Scanner paso a paso
1. **Styles**: importa `styles/vibra.css` o `styles/base.css` en tus páginas. Las
   variables en `styles/variables.css` permiten ajustar colores y radios.
2. **Config & sesión**: inicializa tu configuración con `mergeConfig` y persiste
   preferencias de usuario mediante `session.js` (`getSession`, `saveSession`).
3. **Age gate**: usa `age-gate.js` para comprobar mayoría de edad; llama a
   `requireAdult` con un callback de bloqueo y marca la verificación con
   `markAgeGateComplete`.
4. **Analytics**: registra eventos con `trackEvent(name, payload)` y escucha el evento
   del navegador `vibra:analytics` para integrarlo con tu proveedor.
5. **Exo bridge**: comunica módulos entre sí con `notifyExo` y suscripciones
   `listenToExo`, ideal para experiencias embebidas.
6. **Componentes DOM**: renderiza `Header`, `Footer`, `Modal` o `QRButton` pasando
   opciones simples; todos devuelven nodos listos para montar en el documento.

## Notas de uso
- Evita modificar los archivos directamente; crea extensiones específicas en tu
  módulo y reutiliza las utilidades desde aquí.
- Si migras lógica vieja, colócala primero en `core/legacy` y luego extrae las partes
  reutilizables hacia `shared-core` para mantener el historial limpio.
