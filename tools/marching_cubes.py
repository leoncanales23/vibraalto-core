"""
Implementación ligera de Marching Cubes sin dependencias externas.

Se apoya en las tablas clásicas definidas en `marching_cubes_tables.py` y usa
únicamente NumPy para interpolar los vértices de la superficie isovolumen.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List, Sequence, Tuple

import numpy as np

from .marching_cubes_tables import EDGE_TABLE, TRI_TABLE

# Coordenadas relativas de los 8 vértices de un cubo unidad.
CUBE_CORNERS = np.array(
    [
        [0, 0, 0],
        [1, 0, 0],
        [1, 1, 0],
        [0, 1, 0],
        [0, 0, 1],
        [1, 0, 1],
        [1, 1, 1],
        [0, 1, 1],
    ],
    dtype=np.float32,
)

# Conexiones de las 12 aristas del cubo (cada una referencia dos vértices).
EDGE_CONNECTIONS: Tuple[Tuple[int, int], ...] = (
    (0, 1),
    (1, 2),
    (2, 3),
    (3, 0),
    (4, 5),
    (5, 6),
    (6, 7),
    (7, 4),
    (0, 4),
    (1, 5),
    (2, 6),
    (3, 7),
)


@dataclass
class MarchingCubesResult:
    vertices: np.ndarray
    faces: np.ndarray


def _vertex_interp(
    p1: np.ndarray, p2: np.ndarray, v1: float, v2: float, iso_level: float
) -> np.ndarray:
    """Interpola la posición exacta del vértice en una arista."""
    if abs(iso_level - v1) < 1e-5:
        return p1
    if abs(iso_level - v2) < 1e-5:
        return p2
    if abs(v1 - v2) < 1e-5:
        return p1

    mu = (iso_level - v1) / (v2 - v1)
    return p1 + mu * (p2 - p1)


def _compute_cube_index(values: Sequence[float], iso_level: float) -> int:
    """Calcula el índice de caso en base a los 8 valores del cubo."""
    cube_index = 0
    for i, v in enumerate(values):
        if v < iso_level:
            cube_index |= 1 << i
    return cube_index


def marching_cubes(
    volume: np.ndarray, iso_level: float = 0.5, spacing: Sequence[float] = (1.0, 1.0, 1.0)
) -> MarchingCubesResult:
    """
    Genera vértices y caras triangulares a partir de un volumen binario/escala de grises.

    Args:
        volume: Arreglo 3D con los voxeles.
        iso_level: Umbral para la superficie.
        spacing: Escala de voxel en cada eje (x, y, z).

    Returns:
        MarchingCubesResult con arrays de vértices (N, 3) y caras (M, 3).
    """
    vol = np.asarray(volume, dtype=np.float32)
    if vol.ndim != 3:
        raise ValueError(f"El volumen debe ser 3D, se recibió {vol.ndim}D.")

    sx, sy, sz = spacing
    dims = vol.shape

    vertices: List[np.ndarray] = []
    faces: List[List[int]] = []
    vertex_cache: Dict[Tuple[int, int, int, int], int] = {}

    for x in range(dims[0] - 1):
        for y in range(dims[1] - 1):
            for z in range(dims[2] - 1):
                # 8 valores del cubo actual
                cube_values = [
                    vol[x + dx, y + dy, z + dz]
                    for dx, dy, dz in CUBE_CORNERS.astype(int)
                ]

                cube_index = _compute_cube_index(cube_values, iso_level)
                edges = EDGE_TABLE[cube_index]
                if edges == 0:
                    continue

                vert_list: List[np.ndarray] = [np.zeros(3, dtype=np.float32)] * 12
                base = np.array([x, y, z], dtype=np.float32)

                for edge in range(12):
                    if edges & (1 << edge):
                        a0, b0 = EDGE_CONNECTIONS[edge]
                        p1 = (base + CUBE_CORNERS[a0]) * (sx, sy, sz)
                        p2 = (base + CUBE_CORNERS[b0]) * (sx, sy, sz)
                        v1, v2 = cube_values[a0], cube_values[b0]
                        vert_list[edge] = _vertex_interp(p1, p2, v1, v2, iso_level)

                tri = TRI_TABLE[cube_index]
                for idx in range(0, len(tri), 3):
                    if tri[idx] == -1:
                        break
                    face_vertices: List[int] = []
                    for offset in range(3):
                        edge_idx = tri[idx + offset]
                        key = (x, y, z, edge_idx)
                        if key not in vertex_cache:
                            vertex_cache[key] = len(vertices)
                            vertices.append(vert_list[edge_idx])
                        face_vertices.append(vertex_cache[key])
                    faces.append(face_vertices)

    if not vertices or not faces:
        return MarchingCubesResult(np.empty((0, 3), dtype=np.float32), np.empty((0, 3), dtype=np.int32))

    return MarchingCubesResult(
        vertices=np.vstack(vertices).astype(np.float32),
        faces=np.vstack(faces).astype(np.int32),
    )

