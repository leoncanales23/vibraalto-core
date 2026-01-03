import {
  BufferGeometry,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Material,
  Mesh,
  Object3D,
  PlaneGeometry,
  Vector3,
} from 'three';

export interface ParticleAgentConfig {
  count: number;
  material: Material;
  baseGeometry?: BufferGeometry;
  spread?: number;
}

export type ParticleUpdater = (index: number, position: Vector3, velocity: Vector3) => void;

export class ParticleAgents {
  readonly mesh: Mesh<InstancedBufferGeometry, Material | Material[]>;
  readonly geometry: InstancedBufferGeometry;
  readonly positions: Float32Array;
  readonly velocities: Float32Array;
  private readonly positionAttribute: InstancedBufferAttribute;
  private readonly velocityAttribute: InstancedBufferAttribute;
  private readonly tempPosition = new Vector3();
  private readonly tempVelocity = new Vector3();

  constructor(config: ParticleAgentConfig) {
    const { count, material } = config;
    const base = (config.baseGeometry ?? new PlaneGeometry(0.025, 0.025)) as BufferGeometry;

    this.positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);

    this.geometry = new InstancedBufferGeometry();
    this.geometry.instanceCount = count;
    this.geometry.index = base.index;
    this.geometry.setAttribute('position', base.getAttribute('position'));
    if (base.getAttribute('normal')) {
      this.geometry.setAttribute('normal', base.getAttribute('normal'));
    }
    if (base.getAttribute('uv')) {
      this.geometry.setAttribute('uv', base.getAttribute('uv'));
    }

    this.positionAttribute = new InstancedBufferAttribute(this.positions, 3);
    this.velocityAttribute = new InstancedBufferAttribute(this.velocities, 3);

    this.geometry.setAttribute('iPosition', this.positionAttribute);
    this.geometry.setAttribute('iVelocity', this.velocityAttribute);

    this.mesh = new Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;

    this.seed(config.spread ?? 1);
  }

  seed(spread: number): void {
    for (let i = 0; i < this.geometry.instanceCount; i += 1) {
      this.positions[i * 3] = (Math.random() * 2 - 1) * spread;
      this.positions[i * 3 + 1] = (Math.random() * 2 - 1) * spread;
      this.positions[i * 3 + 2] = (Math.random() * 2 - 1) * spread;

      this.velocities[i * 3] = 0;
      this.velocities[i * 3 + 1] = 0;
      this.velocities[i * 3 + 2] = 0;
    }
    this.flagAttributes();
  }

  update(dt: number, updater?: ParticleUpdater): void {
    const count = this.geometry.instanceCount ?? 0;
    for (let i = 0; i < count; i += 1) {
      this.tempPosition.fromArray(this.positions, i * 3);
      this.tempVelocity.fromArray(this.velocities, i * 3);

      if (updater) {
        updater(i, this.tempPosition, this.tempVelocity);
      }

      this.tempPosition.addScaledVector(this.tempVelocity, dt);

      this.tempPosition.toArray(this.positions, i * 3);
      this.tempVelocity.toArray(this.velocities, i * 3);
    }

    this.flagAttributes();
  }

  lookAt(target: Object3D | Vector3): void {
    if (target instanceof Object3D) {
      this.mesh.lookAt(target.position);
      return;
    }
    this.mesh.lookAt(target);
  }

  setVelocity(index: number, velocity: Vector3): void {
    velocity.toArray(this.velocities, index * 3);
    this.velocityAttribute.needsUpdate = true;
  }

  setPosition(index: number, position: Vector3): void {
    position.toArray(this.positions, index * 3);
    this.positionAttribute.needsUpdate = true;
  }

  private flagAttributes(): void {
    this.positionAttribute.needsUpdate = true;
    this.velocityAttribute.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    if (Array.isArray(this.mesh.material)) {
      this.mesh.material.forEach((mat) => mat.dispose());
    } else {
      this.mesh.material.dispose();
    }
  }
}

export function createBillboardGeometry(): BufferGeometry {
  const size = 0.05;
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      [
        -size, size, 0,
        size, size, 0,
        -size, -size, 0,
        size, -size, 0,
      ],
      3,
    ),
  );
  geometry.setAttribute('uv', new Float32BufferAttribute([
    0, 1,
    1, 1,
    0, 0,
    1, 0,
  ], 2));
  geometry.setIndex([0, 2, 1, 2, 3, 1]);
  return geometry;
}
