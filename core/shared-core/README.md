# shared-core

The `shared-core` layer centralizes reusable UI primitives, configuration helpers, and
browser utilities that multiple Vibra experiences rely on. It is intentionally
framework-agnostic so it can be consumed from static pages, vanilla JavaScript, or
future component systems without re-implementing the same logic.

## Contents
- `styles/`: Theme variables, base resets, and Vibra-specific styling tokens.
- `js/`: Shared utilities for configuration, session handling, analytics, and
  cross-app integrations.
- `components/`: Small presentational building blocks that work with plain DOM APIs.

Each module is self-contained and avoids third-party dependencies to keep legacy
integrations working while we gradually modernize the codebase.
