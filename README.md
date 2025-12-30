# vibraalto-hosting23
Landing Firebase Hosting con identidad VibraAlto, filtro +18 y hook ExoLeón.

## Exportar máscaras a mallas (CLI)

Nueva utilidad para generar geometría desde máscaras binarias y exportar en formatos `gltf | obj | stl`.

Requisitos:
- Python 3.10+
- NumPy (`pip install numpy`)
- Blender instalado y accesible en `PATH` (o define `--blender-path`)

Ejemplo rápido:
```bash
python -m tools.mesh_exporter export \
  --form mask \
  --mask ./data/mask.npy \
  --format gltf \
  --session demo-$(date +%s) \
  --name vibraalto-mask
```

El proceso genera `/exports/{session}/{name}.{ext}` y `/exports/{session}/{name}.json` con metadatos de escala y parámetros de Quadriflow/Smooth/Solidify.
