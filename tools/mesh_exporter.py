"""CLI de exportación de mallas a partir de máscaras binarias.

Flujo:
1. Carga máscara (GPU opcional para el preprocesamiento).
2. Marching Cubes -> malla en CPU.
3. Blender headless aplica Quadriflow + Smooth + Solidify y exporta.
4. Guarda en /exports/{session}/{name}.{ext} y genera metadatos JSON.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, Sequence, Tuple

import numpy as np

if __package__ is None:
    sys.path.append(str(Path(__file__).resolve().parent))
    from marching_cubes import MarchingCubesResult, marching_cubes  # type: ignore
else:
    from .marching_cubes import MarchingCubesResult, marching_cubes

EXPORT_ROOT = Path(__file__).resolve().parent.parent / "exports"


@dataclass
class ExportMetadata:
    session: str
    name: str
    format: str
    scale: float
    spacing: Tuple[float, float, float]
    vertices: int
    faces: int
    bounds_min: Tuple[float, float, float]
    bounds_max: Tuple[float, float, float]
    params: Dict[str, Any]
    source: str
    used_gpu: bool


def _parse_spacing(raw: str) -> Tuple[float, float, float]:
    parts = [float(x.strip()) for x in raw.split(",")]
    if len(parts) != 3:
        raise argparse.ArgumentTypeError("El espaciado debe ser 'x,y,z'")
    return parts[0], parts[1], parts[2]


def load_mask(mask_path: Path, use_gpu: bool) -> Tuple[np.ndarray, bool]:
    """Carga máscara (Numpy) y opcionalmente la fuerza a GPU antes de volver a CPU."""
    if not mask_path.exists():
        raise FileNotFoundError(f"No se encontró la máscara en {mask_path}")

    loaded = np.load(mask_path)
    if isinstance(loaded, np.lib.npyio.NpzFile):
        if not loaded.files:
            raise ValueError(f"El archivo NPZ {mask_path} no contiene arrays.")
        mask = loaded[loaded.files[0]]
    else:
        mask = loaded
    mask_on_gpu = False

    if use_gpu:
        try:
            import cupy as cp

            mask_gpu = cp.asarray(mask)
            mask = cp.asnumpy(mask_gpu)
            mask_on_gpu = True
        except Exception as exc:  # noqa: BLE001
            print(f"[WARN] No se pudo usar GPU (cupy): {exc}", file=sys.stderr)

    if mask.ndim == 2:
        # Extruir un plano plano para obtener un volumen mínimo.
        mask = np.stack([mask, mask], axis=-1)
    if mask.ndim != 3:
        raise ValueError(f"La máscara debe ser 3D o 2D, se recibió {mask.ndim}D.")

    # Normalización a [0,1] para el umbral.
    mask = (mask.astype(np.float32) - mask.min()) / (mask.ptp() + 1e-6)
    return mask, mask_on_gpu


def write_obj(path: Path, vertices: np.ndarray, faces: np.ndarray) -> None:
    with path.open("w", encoding="utf-8") as f:
        for v in vertices:
            f.write(f"v {v[0]:.6f} {v[1]:.6f} {v[2]:.6f}\n")
        for face in faces:
            f.write(f"f {face[0] + 1} {face[1] + 1} {face[2] + 1}\n")


def invoke_blender(
    blender_path: str,
    script_path: Path,
    input_obj: Path,
    output_path: Path,
    fmt: str,
    scale: float,
    quadriflow_target: int,
    smooth_iterations: int,
    solidify_thickness: float,
) -> None:
    cmd = [
        blender_path,
        "--background",
        "--python",
        str(script_path),
        "--",
        "--input",
        str(input_obj),
        "--output",
        str(output_path),
        "--format",
        fmt,
        "--scale",
        str(scale),
        "--quadriflow-target",
        str(quadriflow_target),
        "--smooth-iterations",
        str(smooth_iterations),
        "--solidify-thickness",
        str(solidify_thickness),
    ]
    result = subprocess.run(cmd, check=False, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(
            f"Blender falló ({result.returncode}). stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
        )


def build_metadata(
    mesh: MarchingCubesResult,
    args: argparse.Namespace,
    mask_path: Path,
    used_gpu: bool,
    scaled_vertices: np.ndarray,
) -> ExportMetadata:
    verts = scaled_vertices if scaled_vertices.size else np.zeros((0, 3), dtype=np.float32)
    bounds_min = verts.min(axis=0).tolist() if len(verts) else [0.0, 0.0, 0.0]
    bounds_max = verts.max(axis=0).tolist() if len(verts) else [0.0, 0.0, 0.0]
    return ExportMetadata(
        session=args.session,
        name=args.name,
        format=args.format,
        scale=args.scale,
        spacing=args.spacing,
        vertices=int(mesh.vertices.shape[0]),
        faces=int(mesh.faces.shape[0]),
        bounds_min=tuple(float(x) for x in bounds_min),
        bounds_max=tuple(float(x) for x in bounds_max),
        params={
            "quadriflow_target": args.quadriflow_target,
            "smooth_iterations": args.smooth_iterations,
            "solidify_thickness": args.solidify_thickness,
            "form": args.form,
        },
        source=str(mask_path),
        used_gpu=used_gpu,
    )


def export_mask(args: argparse.Namespace) -> Path:
    mask, used_gpu = load_mask(Path(args.mask), args.use_gpu)
    mc_result = marching_cubes(mask, iso_level=args.iso, spacing=args.spacing)
    scaled_vertices = mc_result.vertices * args.scale

    session_dir = EXPORT_ROOT / args.session
    session_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir) / f"{args.name}_raw.obj"
        write_obj(tmp_path, scaled_vertices, mc_result.faces)

        output_path = session_dir / f"{args.name}.{args.format}"
        blender_script = Path(__file__).with_name("blender_postprocess.py")
        invoke_blender(
            args.blender_path,
            blender_script,
            tmp_path,
            output_path,
            args.format,
            args.scale,
            args.quadriflow_target,
            args.smooth_iterations,
            args.solidify_thickness,
        )

    metadata = build_metadata(mc_result, args, Path(args.mask), used_gpu, scaled_vertices)
    metadata_path = session_dir / f"{args.name}.json"
    metadata_path.write_text(json.dumps(asdict(metadata), indent=2), encoding="utf-8")
    return metadata_path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Exportar malla desde máscara binaria.")
    parser.add_argument("command", choices=["export"], help="Comando principal.")
    parser.add_argument("--form", required=True, choices=["mask"], help="Origen de la geometría.")
    parser.add_argument("--mask", required=True, help="Ruta a la máscara .npy/.npz")
    parser.add_argument("--format", required=True, choices=["gltf", "obj", "stl"], help="Formato final.")
    parser.add_argument("--session", default=datetime.utcnow().strftime("%Y%m%d-%H%M%S"), help="ID de sesión.")
    parser.add_argument("--name", default=None, help="Nombre base del archivo exportado.")
    parser.add_argument("--scale", type=float, default=1.0, help="Factor de escala aplicado a la malla.")
    parser.add_argument("--iso", type=float, default=0.5, help="Iso-nivel para Marching Cubes.")
    parser.add_argument("--spacing", type=_parse_spacing, default=(1.0, 1.0, 1.0), help="Espaciado voxel x,y,z.")
    parser.add_argument("--use-gpu", action="store_true", help="Subir máscara a GPU antes del marching cubes.")
    parser.add_argument("--blender-path", default="blender", help="Binario de Blender para ejecución headless.")
    parser.add_argument("--quadriflow-target", type=int, default=8000, help="Número objetivo de caras tras Quadriflow.")
    parser.add_argument("--smooth-iterations", type=int, default=3, help="Iteraciones del modificador Smooth.")
    parser.add_argument("--solidify-thickness", type=float, default=0.002, help="Espesor para Solidify.")
    return parser


def main(raw_args: Iterable[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(raw_args)
    if args.command != "export":
        parser.error("Solo se soporta el comando 'export'.")

    if args.name is None:
        args.name = Path(args.mask).stem

    try:
        metadata_path = export_mask(args)
    except Exception as exc:  # noqa: BLE001
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1

    print(f"Malla exportada. Metadatos: {metadata_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
