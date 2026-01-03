"""
Generador de mallas a partir de campos de densidad usando Marching Cubes.

El módulo está pensado para alimentar la tubería de Blender headless:
1. Se lee un grid de densidad (``.npy`` o ``.npz``).
2. Se ejecuta Marching Cubes para obtener la malla.
3. Se exporta a un formato estándar (OBJ/PLY/GLB, etc.).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Tuple

import numpy as np
import trimesh
from skimage import measure


SUPPORTED_EXPORT_FORMATS = {"obj", "ply", "glb", "gltf", "stl"}


@dataclass
class DensityCaptureConfig:
    """Configuración para el paso de Marching Cubes."""

    iso_level: float = 0.5
    spacing: Tuple[float, float, float] = (1.0, 1.0, 1.0)
    step_size: int = 1
    export_format: str = "obj"

    @classmethod
    def from_mapping(cls, payload: dict) -> "DensityCaptureConfig":
        spacing = payload.get("spacing", (1.0, 1.0, 1.0))
        if isinstance(spacing, str):
            spacing = tuple(float(v) for v in spacing.split(","))
        return cls(
            iso_level=float(payload.get("iso_level", 0.5)),
            spacing=tuple(spacing),  # type: ignore[arg-type]
            step_size=int(payload.get("step_size", 1)),
            export_format=str(payload.get("export_format", "obj")).lower(),
        )


def _ensure_supported_format(path: Path, export_format: str | None) -> str:
    fmt = (export_format or path.suffix.replace(".", "")).lower()
    if fmt not in SUPPORTED_EXPORT_FORMATS:
        raise ValueError(
            f"Formato '{fmt}' no soportado. Usa uno de: {', '.join(sorted(SUPPORTED_EXPORT_FORMATS))}"
        )
    return fmt


def load_density_grid(input_path: Path) -> np.ndarray:
    """
    Carga un grid de densidad desde un archivo ``.npy`` o ``.npz``.
    El resultado es un ``numpy.ndarray`` 3D.
    """
    if not input_path.exists():
        raise FileNotFoundError(f"No existe el archivo de densidad: {input_path}")

    if input_path.suffix == ".npy":
        grid = np.load(input_path)
    elif input_path.suffix == ".npz":
        with np.load(input_path) as data:
            # Usamos la primera clave encontrada
            first_key = next(iter(data.files))
            grid = data[first_key]
    else:
        raise ValueError("Solo se aceptan archivos .npy o .npz para el grid de densidad.")

    if grid.ndim != 3:
        raise ValueError(f"Se esperaba un grid 3D, pero se obtuvo una forma {grid.shape}.")
    return grid


def run_marching_cubes(
    grid: np.ndarray, iso_level: float, spacing: Iterable[float], step_size: int
) -> trimesh.Trimesh:
    """
    Ejecuta Marching Cubes sobre un grid 3D y devuelve una malla ``trimesh.Trimesh``.
    """
    vertices, faces, normals, _ = measure.marching_cubes(
        volume=grid, level=iso_level, spacing=tuple(spacing), step_size=step_size, allow_degenerate=False
    )
    return trimesh.Trimesh(vertices=vertices, faces=faces, vertex_normals=normals, process=False)


def export_mesh(mesh: trimesh.Trimesh, output_path: Path, export_format: str | None = None) -> Path:
    """
    Exporta la malla al formato indicado usando la extensión del archivo o ``export_format``.
    """
    fmt = _ensure_supported_format(output_path, export_format)
    output_path = output_path.with_suffix(f".{fmt}")
    mesh.export(output_path, file_type=fmt)
    return output_path


def capture_density_to_mesh(
    density_path: Path, output_path: Path, config: DensityCaptureConfig | None = None
) -> Path:
    """
    Pipeline completo: carga densidad → Marching Cubes → exporta.
    """
    config = config or DensityCaptureConfig()
    grid = load_density_grid(density_path)
    mesh = run_marching_cubes(
        grid=grid,
        iso_level=config.iso_level,
        spacing=config.spacing,
        step_size=config.step_size,
    )
    return export_mesh(mesh, output_path, config.export_format)


def save_config(config: DensityCaptureConfig, path: Path) -> None:
    """Guarda la configuración en JSON para reproducir parámetros."""
    payload = {
        "iso_level": config.iso_level,
        "spacing": list(config.spacing),
        "step_size": config.step_size,
        "export_format": config.export_format,
    }
    path.write_text(json.dumps(payload, indent=2))


def load_config(path: Path) -> DensityCaptureConfig:
    """Lee un JSON de configuración y devuelve ``DensityCaptureConfig``."""
    payload = json.loads(path.read_text())
    return DensityCaptureConfig.from_mapping(payload)

