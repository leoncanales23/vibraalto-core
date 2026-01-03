"""
Script para ejecutarse dentro de Blender (--background --python).

Acciones:
- Importa OBJ generado por Marching Cubes.
- Quadriflow remesh, Smooth, Solidify.
- Exporta a glTF/OBJ/STL.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import bpy


def parse_args() -> argparse.Namespace:
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    else:
        argv = []

    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--format", required=True, choices=["gltf", "obj", "stl"])
    parser.add_argument("--scale", type=float, default=1.0)
    parser.add_argument("--quadriflow-target", type=int, default=8000)
    parser.add_argument("--smooth-iterations", type=int, default=3)
    parser.add_argument("--solidify-thickness", type=float, default=0.002)
    return parser.parse_args(argv)


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_obj(path: Path) -> bpy.types.Object:
    bpy.ops.import_scene.obj(filepath=str(path))
    obj = bpy.context.selected_objects[0]
    bpy.context.view_layer.objects.active = obj
    return obj


def apply_scale(obj: bpy.types.Object, scale: float) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.transform.resize(value=(scale, scale, scale))
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)


def apply_quadriflow(obj: bpy.types.Object, target_faces: int) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.quadriflow_remesh(
        target_faces=target_faces,
        use_preserve_sharp=True,
        use_preserve_boundary=True,
        use_mesh_symmetry=False,
    )


def apply_smooth(obj: bpy.types.Object, iterations: int) -> None:
    if iterations <= 0:
        return
    mod = obj.modifiers.new(name="Smooth", type="SMOOTH")
    mod.iterations = iterations
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.shade_smooth()


def apply_solidify(obj: bpy.types.Object, thickness: float) -> None:
    if thickness <= 0:
        return
    mod = obj.modifiers.new(name="Solidify", type="SOLIDIFY")
    mod.thickness = thickness
    bpy.ops.object.modifier_apply(modifier=mod.name)


def export(obj: bpy.types.Object, path: Path, fmt: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    if fmt == "gltf":
        bpy.ops.export_scene.gltf(
            filepath=str(path),
            export_format="GLTF_SEPARATE",
            use_selection=True,
            export_apply=True,
        )
    elif fmt == "obj":
        bpy.ops.export_scene.obj(filepath=str(path), use_selection=True, use_mesh_modifiers=True)
    elif fmt == "stl":
        bpy.ops.export_mesh.stl(filepath=str(path), use_selection=True, use_mesh_modifiers=True)
    else:
        raise ValueError(f"Formato no soportado: {fmt}")


def main() -> None:
    args = parse_args()
    reset_scene()
    obj = import_obj(Path(args.input))
    apply_scale(obj, args.scale)
    apply_quadriflow(obj, args.quadriflow_target)
    apply_smooth(obj, args.smooth_iterations)
    apply_solidify(obj, args.solidify_thickness)
    export(obj, Path(args.output), args.format)


if __name__ == "__main__":
    main()

