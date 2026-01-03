# Legacy core map

Este directorio conserva el archivo histórico que bloqueaba la creación de subcarpetas
bajo `/core` cuando existía como archivo plano. El contenido original ahora vive en
`CORE_MAP.txt` para mantener la referencia sin interferir con la estructura actual.

## ¿Cómo leer el mapa?
1. Abre `CORE_MAP.txt` para ver el árbol original de módulos Vibra.
2. Usa el árbol como guía al migrar o reagrupar recursos hacia `core/shared-core` u
   otras carpetas activas.
3. Si necesitas volver a un módulo antiguo, crea una subcarpeta nueva en `core/legacy`
   y conserva allí los artefactos antes de modernizarlos.
