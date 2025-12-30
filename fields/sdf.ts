export type Vec3 = [number, number, number];

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);

/**
 * Signed distance to a sphere centered at the origin.
 */
export function sphere(point: Vec3, radius: number): number {
  return len(point) - radius;
}

/**
 * Signed distance to a capsule defined by a segment AB and radius r.
 */
export function capsule(point: Vec3, a: Vec3, b: Vec3, radius: number): number {
  const pa = sub(point, a);
  const ba = sub(b, a);
  const h = clamp01(dot(pa, ba) / dot(ba, ba));
  return len(sub(pa, scale(ba, h))) - radius;
}

/**
 * Simple face-like mask constructed from a skull sphere, a vertical jaw capsule
 * and a small chin sphere. The origin is placed near the eye-line.
 */
export function faceMaskSimple(point: Vec3, size: number): number {
  const skullCenter: Vec3 = [0, -size * 0.15, 0];
  const skull = sphere(sub(point, skullCenter), size);

  const jaw = capsule(point, [0, size * 0.1, 0], [0, -size * 0.95, 0], size * 0.55);
  const chin = sphere(sub(point, [0, -size, 0]), size * 0.35);

  // Union between skull, jaw and chin.
  let mask = Math.min(skull, Math.min(jaw, chin));

  // Subtle taper on the cheeks and forehead to keep the silhouette mask-like.
  const cheekTaper = Math.max(Math.abs(point[0]) - size * 0.75, Math.abs(point[2]) - size * 0.55);
  const browCut = point[1] - size * 1.05;

  mask = Math.max(mask, cheekTaper);
  mask = Math.max(mask, browCut);
  return mask;
}

/**
 * Convenience helpers for composing SDFs when experimenting with new fields.
 */
export const sdfOps = {
  union: (d1: number, d2: number) => Math.min(d1, d2),
  intersect: (d1: number, d2: number) => Math.max(d1, d2),
  subtract: (d1: number, d2: number) => Math.max(d1, -d2),
  smoothUnion: (d1: number, d2: number, k = 0.1) => {
    const h = clamp01(0.5 + 0.5 * (d2 - d1) / k);
    return (1.0 - h) * d1 + h * d2 - k * h * (1.0 - h);
  }
};
