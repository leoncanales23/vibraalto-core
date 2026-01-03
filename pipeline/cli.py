"""
CLI para capturar densidad (Marching Cubes) y postprocesar con Blender headless.

Ejemplos:
  python -m pipeline.cli capture --input density.npy --output mesh.obj --iso-level 0.6 --spacing 0.8,0.8,1.2
  python -m pipeline.cli postprocess --input mesh.obj --output final.glb --voxel-size 0.003 --solidify-thickness 0.001
  python -m pipeline.cli full --density density.npy --output final.glb --iso-level 0.55 --voxel-size 0.004 --format glb
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path
from typing import Iterable, List, Tuple

from pipeline.density_capture import (
    DensityCaptureConfig,
    capture_density_to_mesh,
    load_config,
    save_config,
)


def _parse_spacing(value: str) -> Tuple[float, float, float]:
    parts = value.split(",")
    if len(parts) != 3:
        raise argparse.ArgumentTypeError("El espaciado debe tener formato x,y,z (tres valores separados por coma).")
    return tuple(float(v) for v in parts)  # type: ignore[return-value]


def _parse_step_size(value: str) -> int:
    step = int(value)
    if step < 1:
        raise argparse.ArgumentTypeError("El step_size debe ser >= 1.")
    return step


def _run_blender(input_mesh: Path, output_mesh: Path, args: argparse.Namespace) -> None:
    blender_executable = args.blender or "blender"
    script_path = Path(__file__).with_name("blender_runner.py")
    cmd: List[str] = [
        blender_executable,
        "--background",
        "--python",
        str(script_path),
        "--",
        "--input",
        str(input_mesh),
        "--output",
        str(output_mesh),
        "--format",
        args.format or output_mesh.suffix.replace(".", ""),
        "--voxel-size",
        str(args.voxel_size),
        "--remesh-mode",
        args.remesh_mode,
        "--adaptivity",
        str(args.adaptivity),
    ]
    if args.solidify_thickness:
        cmd.extend(["--solidify-thickness", str(args.solidify_thickness)])
    if args.solidify_offset:
        cmd.extend(["--solidify-offset", str(args.solidify_offset)])
    if args.smooth_shading:
        cmd.append("--smooth-shading")

    print(f"[cli] Ejecutando Blender headless: {' '.join(cmd)}")
    subprocess.run(cmd, check=True)


def add_capture_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--input", required=True, type=Path, help="Grid de densidad (.npy o .npz).")
    parser.add_argument("--output", required=True, type=Path, help="Malla de salida (usa extensión o --format).")
    parser.add_argument("--iso-level", default=0.5, type=float, help="Iso-superficie para Marching Cubes.")
    parser.add_argument(
        "--spacing",
        default="1,1,1",
        type=_parse_spacing,
        help="Espaciado XYZ (mm o unidades del grid), formato x,y,z.",
    )
    parser.add_argument("--step-size", default=1, type=_parse_step_size, help="Salto de Marching Cubes (resolución).")
    parser.add_argument("--format", default=None, help="Formato de exportación: obj, ply, glb, gltf, stl.")
    parser.add_argument("--config-out", type=Path, help="Guarda un JSON con la configuración usada.")
    parser.add_argument("--config-in", type=Path, help="Carga un JSON con configuración.")


def _build_capture_config(args: argparse.Namespace) -> DensityCaptureConfig:
    if args.config_in:
        config = load_config(args.config_in)
    else:
        config = DensityCaptureConfig(
            iso_level=args.iso_level,
            spacing=args.spacing,
            step_size=args.step_size,
            export_format=args.format or args.output.suffix.replace(".", "") or "obj",
        )
    if args.config_out:
        save_config(config, args.config_out)
    return config


def handle_capture(args: argparse.Namespace) -> Path:
    config = _build_capture_config(args)
    output = capture_density_to_mesh(args.input, args.output, config)
    print(f"[cli] Malla generada con Marching Cubes: {output}")
    return output


def handle_postprocess(args: argparse.Namespace) -> None:
    _run_blender(args.input, args.output, args)


def handle_full(args: argparse.Namespace) -> None:
    capture_args = argparse.Namespace(
        input=args.density,
        output=args.intermediate,
        iso_level=args.iso_level,
        spacing=args.spacing,
        step_size=args.step_size,
        format=args.capture_format,
        config_out=None,
        config_in=args.config_in,
    )
    mesh_path = handle_capture(capture_args)
    # Reusar parámetros de postproceso
    post_args = argparse.Namespace(
        input=mesh_path,
        output=args.output,
        format=args.format,
        voxel_size=args.voxel_size,
        remesh_mode=args.remesh_mode,
        adaptivity=args.adaptivity,
        solidify_thickness=args.solidify_thickness,
        solidify_offset=args.solidify_offset,
        smooth_shading=args.smooth_shading,
        blender=args.blender,
    )
    handle_postprocess(post_args)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Pipeline de Marching Cubes + Blender headless.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    capture_parser = subparsers.add_parser("capture", help="Convierte densidad a malla.")
    add_capture_arguments(capture_parser)
    capture_parser.set_defaults(func=handle_capture)

    post_parser = subparsers.add_parser("postprocess", help="Ejecuta remesh/solidify/export en Blender headless.")
    post_parser.add_argument("--input", required=True, type=Path, help="Malla de entrada para Blender.")
    post_parser.add_argument("--output", required=True, type=Path, help="Malla de salida.")
    post_parser.add_argument("--format", default=None, help="Formato de exportación final.")
    post_parser.add_argument("--voxel-size", default=0.005, type=float, help="Tamaño de voxel para Remesh.")
    post_parser.add_argument("--remesh-mode", choices={"VOXEL", "SMOOTH", "SHARP"}, default="VOXEL")
    post_parser.add_argument("--adaptivity", default=0.0, type=float)
    post_parser.add_argument("--solidify-thickness", default=0.0, type=float)
    post_parser.add_argument("--solidify-offset", default=0.0, type=float)
    post_parser.add_argument("--smooth-shading", action="store_true")
    post_parser.add_argument("--blender", default=None, help="Ruta al ejecutable de Blender.")
    post_parser.set_defaults(func=handle_postprocess)

    full_parser = subparsers.add_parser("full", help="Captura densidad y lanza postproceso en Blender.")
    full_parser.add_argument("--density", required=True, type=Path, help="Grid de densidad de entrada.")
    full_parser.add_argument(
        "--intermediate",
        required=True,
        type=Path,
        help="Ruta temporal/intermedia para guardar la malla de Marching Cubes.",
    )
    full_parser.add_argument("--output", required=True, type=Path, help="Malla final tras Blender.")
    full_parser.add_argument("--iso-level", default=0.5, type=float)
    full_parser.add_argument("--spacing", default="1,1,1", type=_parse_spacing)
    full_parser.add_argument("--step-size", default=1, type=_parse_step_size)
    full_parser.add_argument("--capture-format", default="obj")
    full_parser.add_argument("--format", default="glb")
    full_parser.add_argument("--config-in", type=Path, help="Config JSON para reproducir parámetros de captura.")
    full_parser.add_argument("--voxel-size", default=0.005, type=float)
    full_parser.add_argument("--remesh-mode", choices={"VOXEL", "SMOOTH", "SHARP"}, default="VOXEL")
    full_parser.add_argument("--adaptivity", default=0.0, type=float)
    full_parser.add_argument("--solidify-thickness", default=0.0, type=float)
    full_parser.add_argument("--solidify-offset", default=0.0, type=float)
    full_parser.add_argument("--smooth-shading", action="store_true")
    full_parser.add_argument("--blender", default=None, help="Ruta al ejecutable de Blender.")
    full_parser.set_defaults(func=handle_full)

    return parser


def main(argv: Iterable[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(list(argv) if argv is not None else None)
    result = args.func(args)
    if result:
        print(result)


if __name__ == "__main__":
    main()

