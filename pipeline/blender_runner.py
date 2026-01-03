"""
Script para ejecutarse dentro de Blender en modo headless.

Uso:
blender --background --python pipeline/blender_runner.py -- \
  --input /tmp/mesh.obj \
  --output /tmp/mesh.glb \
  --format glb \
  --voxel-size 0.004 \
  --solidify-thickness 0.002
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Iterable

try:
    import bpy  # type: ignore
except ImportError as exc:  # pragma: no cover - solo disponible en Blender
    raise RuntimeError(
        "Este script debe ejecutarse desde Blender (bpy no disponible). "
        "Ejemplo: blender --background --python pipeline/blender_runner.py -- --help"
    ) from exc


def _clear_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for block in bpy.data.meshes:
        bpy.data.meshes.remove(block)


def _import_mesh(path: Path):
    ext = path.suffix.lower()
    if ext == ".obj":
        bpy.ops.wm.obj_import(filepath=str(path))
    elif ext in {".glb", ".gltf"}:
        bpy.ops.wm.gltf_import(filepath=str(path))
    elif ext == ".ply":
        bpy.ops.wm.ply_import(filepath=str(path))
    elif ext == ".stl":
        bpy.ops.wm.stl_import(filepath=str(path))
    else:
        raise ValueError(f"Formato de entrada no soportado para Blender: {ext}")
    if not bpy.context.selected_objects:
        raise RuntimeError("No se importó ningún objeto desde el archivo.")
    return bpy.context.selected_objects[0]


def _apply_remesh(obj, voxel_size: float, adaptivity: float, mode: str = "VOXEL") -> None:
    remesh = obj.modifiers.new(name="Remesh", type="REMESH")
    remesh.mode = mode
    remesh.voxel_size = voxel_size
    remesh.adaptivity = adaptivity
    bpy.ops.object.modifier_apply(modifier=remesh.name)


def _apply_solidify(obj, thickness: float, offset: float) -> None:
    solid = obj.modifiers.new(name="Solidify", type="SOLIDIFY")
    solid.thickness = thickness
    solid.offset = offset
    bpy.ops.object.modifier_apply(modifier=solid.name)


def _set_shade_smooth(obj) -> None:
    bpy.ops.object.shade_smooth()
    for poly in obj.data.polygons:
        poly.use_smooth = True


def _export_mesh(obj, output_path: Path, export_format: str) -> None:
    export_format = export_format.lower()
    output_path = output_path.with_suffix(f".{export_format}")
    if export_format == "obj":
        bpy.ops.wm.obj_export(filepath=str(output_path), export_normals=True, export_triangulated_mesh=True)
    elif export_format in {"glb", "gltf"}:
        bpy.ops.export_scene.gltf(filepath=str(output_path), export_format="GLB" if export_format == "glb" else "GLTF_SEPARATE")
    elif export_format == "ply":
        bpy.ops.wm.ply_export(filepath=str(output_path), export_normals=True)
    elif export_format == "stl":
        bpy.ops.wm.stl_export(filepath=str(output_path))
    else:
        raise ValueError(f"Formato de exportación no soportado: {export_format}")
    print(f"[blender_runner] Exportado a {output_path}")


def parse_args(argv: Iterable[str] | None = None) -> argparse.Namespace:
    if argv is None:
        argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    parser = argparse.ArgumentParser(description="Postproceso headless de malla en Blender.")
    parser.add_argument("--input", required=True, type=Path, help="Ruta de la malla de entrada.")
    parser.add_argument("--output", required=True, type=Path, help="Ruta de salida (la extensión define el formato).")
    parser.add_argument("--format", default=None, help="Formato de exportación (obj, glb, gltf, ply, stl).")
    parser.add_argument("--voxel-size", default=0.005, type=float, help="Tamaño de voxel para el Remesh.")
    parser.add_argument("--remesh-mode", default="VOXEL", choices={"VOXEL", "SMOOTH", "SHARP"}, help="Modo de Remesh.")
    parser.add_argument("--adaptivity", default=0.0, type=float, help="Nivel de adaptividad para remesh (0-1).")
    parser.add_argument("--solidify-thickness", default=0.0, type=float, help="Espesor para Solidify (0 desactiva).")
    parser.add_argument("--solidify-offset", default=0.0, type=float, help="Offset de Solidify.")
    parser.add_argument("--smooth-shading", action="store_true", help="Activa suavizado de normales.")
    return parser.parse_args(list(argv))


def main(argv: Iterable[str] | None = None) -> None:
    args = parse_args(argv)
    _clear_scene()
    obj = _import_mesh(args.input)
    if args.voxel_size > 0:
        _apply_remesh(obj, voxel_size=args.voxel_size, adaptivity=args.adaptivity, mode=args.remesh_mode)
    if args.solidify_thickness != 0:
        _apply_solidify(obj, thickness=args.solidify_thickness, offset=args.solidify_offset)
    if args.smooth_shading:
        _set_shade_smooth(obj)
    fmt = args.format or args.output.suffix.replace(".", "")
    _export_mesh(obj, args.output, fmt)


if __name__ == "__main__":  # pragma: no cover - ejecutable desde Blender
    main()

