import * as THREE from "three";
import { projectileTuning } from "./config";
import { palette } from "./palette";
import type { Projectile } from "./types";

export class ProjectileSystem {
  private readonly projectiles: Projectile[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  get count(): number {
    return this.projectiles.length;
  }

  spawn(position: THREE.Vector3, impact: THREE.Vector3, bulletTemplate: THREE.Group | null) {
    const shotLine = impact.clone().sub(position);
    const fullDistance = shotLine.length();
    if (fullDistance < 0.05) return;
    const distance = Math.min(fullDistance, projectileTuning.maxDistance);
    const direction = shotLine.normalize();
    const root = new THREE.Group();
    root.position.copy(position);
    root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);

    if (bulletTemplate) {
      const bullet = bulletTemplate.clone(true);
      const bounds = new THREE.Box3().setFromObject(bullet);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const maxSide = Math.max(size.x, size.y, size.z, 0.001);
      bullet.position.sub(center);
      bullet.scale.setScalar(0.24 / maxSide);
      root.add(bullet);
    }

    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 10, 10),
      new THREE.MeshBasicMaterial({ color: "#fff8d7", transparent: true, opacity: 0.98, depthTest: false })
    );
    body.renderOrder = 104;
    body.userData.transient = true;
    root.add(body);

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 10, 10),
      new THREE.MeshBasicMaterial({ color: palette.coral, transparent: true, opacity: 0.34, depthTest: false, depthWrite: false })
    );
    glow.renderOrder = 103;
    glow.userData.transient = true;
    root.add(glow);

    const trail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.004, 0.82, 6),
      new THREE.MeshBasicMaterial({ color: palette.cream, transparent: true, opacity: 0.48, depthTest: false, depthWrite: false })
    );
    trail.renderOrder = 102;
    trail.position.z = -0.44;
    trail.rotation.x = Math.PI / 2;
    trail.userData.transient = true;
    root.add(trail);

    this.projectiles.push({
      root,
      velocity: direction.clone().multiplyScalar(projectileTuning.speed),
      previous: position.clone(),
      life: distance / projectileTuning.speed,
      distance: 0,
      maxDistance: distance
    });
    this.scene.add(root);
  }

  update(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      const projectile = this.projectiles[i];
      projectile.life -= dt;
      projectile.previous.copy(projectile.root.position);
      projectile.root.position.addScaledVector(projectile.velocity, dt);

      const travel = projectile.root.position.distanceTo(projectile.previous);
      projectile.distance += travel;
      if (travel > 0.001) {
        projectile.root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), projectile.velocity.clone().normalize());
      }

      if (projectile.life <= 0 || projectile.distance >= projectile.maxDistance) {
        this.remove(i);
      }
    }
  }

  private remove(index: number) {
    const [projectile] = this.projectiles.splice(index, 1);
    if (!projectile) return;
    this.scene.remove(projectile.root);
    projectile.root.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh || !child.userData.transient) return;
      const mesh = child as THREE.Mesh;
      mesh.geometry.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) {
        material.forEach((m) => m.dispose());
      } else {
        material.dispose();
      }
    });
  }
}
