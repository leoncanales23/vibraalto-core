# vibraalto-hosting23
Landing Firebase Hosting con identidad VibraAlto, filtro +18 y hook ExoLeón.

## Pipeline 3D (Marching Cubes → Blender headless)

Nueva tubería para generar mallas a partir de densidades volumétricas y postprocesarlas con Blender en modo headless:

1) Instala dependencias Python:
```bash
pip install .  # usa pyproject.toml
```

2) Genera la malla con Marching Cubes:
```bash
python -m pipeline.cli capture \
  --input density.npy \
  --output mesh.obj \
  --iso-level 0.55 \
  --spacing 0.8,0.8,1.2 \
  --step-size 2 \
  --format obj
```

3) Postprocesa en Blender (remesh + solidify + export):
```bash
python -m pipeline.cli postprocess \
  --input mesh.obj \
  --output final.glb \
  --voxel-size 0.004 \
  --solidify-thickness 0.001 \
  --format glb \
  --smooth-shading
```

4) Pipeline completo con un solo comando:
```bash
python -m pipeline.cli full \
  --density density.npy \
  --intermediate /tmp/mc.obj \
  --output final.glb \
  --iso-level 0.55 \
  --spacing 1,1,1 \
  --step-size 1 \
  --format glb \
  --voxel-size 0.004 \
  --solidify-thickness 0.001
```

Notas:
- Acepta grids `.npy`/`.npz`.
- Permite guardar/cargar configuración JSON (`--config-out`, `--config-in`).
- El script `pipeline/blender_runner.py` está pensado para ejecutarse dentro de Blender (`blender --background --python ...`).
