import * as THREE from "three";
import { animePalette } from "./palette";

type EffectItem = {
  object: THREE.Object3D;
  life: number;
  maxLife: number;
  velocity?: THREE.Vector3;
  spin?: THREE.Vector3;
  scaleRate?: number;
  onUpdate?: (item: EffectItem, dt: number) => void;
};

export class AnimeEffects {
  private readonly items: EffectItem[] = [];
  private readonly sparkTexture: THREE.Texture;
  private readonly ringTexture: THREE.Texture;
  private readonly slashTexture: THREE.Texture;

  constructor(private readonly scene: THREE.Scene) {
    this.sparkTexture = AnimeEffects.makeSparkTexture();
    this.ringTexture = AnimeEffects.makeRingTexture();
    this.slashTexture = AnimeEffects.makeSlashTexture();
  }

  get count() {
    return this.items.length;
  }

  update(dt: number) {
    for (let i = this.items.length - 1; i >= 0; i -= 1) {
      const item = this.items[i];
      item.life -= dt;
      if (item.velocity) item.object.position.addScaledVector(item.velocity, dt);
      if (item.spin) {
        item.object.rotation.x += item.spin.x * dt;
        item.object.rotation.y += item.spin.y * dt;
        item.object.rotation.z += item.spin.z * dt;
      }
      if (item.scaleRate) {
        item.object.scale.multiplyScalar(1 + item.scaleRate * dt);
      }
      const alpha = Math.max(0, item.life / item.maxLife);
      const sprite = item.object as THREE.Sprite;
      if (sprite.isSprite) {
        const mat = sprite.material as THREE.SpriteMaterial;
        mat.opacity = alpha;
      }
      item.onUpdate?.(item, dt);
      if (item.life <= 0) {
        this.scene.remove(item.object);
        this.disposeObject(item.object);
        this.items.splice(i, 1);
      }
    }
  }

  spawnHitSpark(position: THREE.Vector3, critical = false) {
    const color = critical ? animePalette.critSpark : animePalette.hitSpark;
    const coreMat = new THREE.SpriteMaterial({
      map: this.sparkTexture,
      color,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const core = new THREE.Sprite(coreMat);
    core.position.copy(position);
    core.scale.setScalar(critical ? 1.4 : 0.9);
    this.scene.add(core);
    this.items.push({ object: core, life: 0.22, maxLife: 0.22, scaleRate: 8 });

    // Radial sparkle petals
    const petals = critical ? 8 : 5;
    for (let i = 0; i < petals; i += 1) {
      const mat = new THREE.SpriteMaterial({
        map: this.sparkTexture,
        color,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const spark = new THREE.Sprite(mat);
      spark.position.copy(position);
      const angle = (i / petals) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 6 + Math.random() * 5;
      const vel = new THREE.Vector3(Math.cos(angle) * speed, (Math.random() - 0.2) * 4, Math.sin(angle) * speed);
      spark.scale.setScalar(0.25 + Math.random() * 0.2);
      this.scene.add(spark);
      this.items.push({ object: spark, life: 0.28, maxLife: 0.28, velocity: vel, scaleRate: -1.5 });
    }

    // Ring shockwave
    const ringMat = new THREE.SpriteMaterial({
      map: this.ringTexture,
      color,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.9
    });
    const ring = new THREE.Sprite(ringMat);
    ring.position.copy(position);
    ring.scale.setScalar(0.3);
    this.scene.add(ring);
    this.items.push({ object: ring, life: 0.24, maxLife: 0.24, scaleRate: 14 });
  }

  spawnMuzzleBurst(position: THREE.Vector3, direction: THREE.Vector3) {
    const flashMat = new THREE.SpriteMaterial({
      map: this.sparkTexture,
      color: animePalette.neonYellow,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const flash = new THREE.Sprite(flashMat);
    flash.position.copy(position).addScaledVector(direction, 0.15);
    flash.scale.setScalar(0.7);
    this.scene.add(flash);
    this.items.push({ object: flash, life: 0.06, maxLife: 0.06, scaleRate: -4 });

    // Slash streak
    const slashMat = new THREE.SpriteMaterial({
      map: this.slashTexture,
      color: animePalette.neonYellow,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const slash = new THREE.Sprite(slashMat);
    slash.position.copy(position).addScaledVector(direction, 0.8);
    slash.scale.set(2.2, 0.4, 1);
    slash.material.rotation = Math.atan2(direction.y, Math.hypot(direction.x, direction.z));
    this.scene.add(slash);
    this.items.push({ object: slash, life: 0.08, maxLife: 0.08, scaleRate: 6 });
  }

  spawnPolygonShatter(position: THREE.Vector3, color: THREE.ColorRepresentation) {
    const baseColor = new THREE.Color(color);
    const shardGeo = new THREE.TetrahedronGeometry(0.22, 0);
    const group = new THREE.Group();
    const shardCount = 14;
    for (let i = 0; i < shardCount; i += 1) {
      const mat = new THREE.MeshBasicMaterial({
        color: baseColor,
        transparent: true,
        opacity: 1
      });
      const shard = new THREE.Mesh(shardGeo, mat);
      shard.position.copy(position);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 7,
        2 + Math.random() * 5,
        (Math.random() - 0.5) * 7
      );
      const spin = new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
      );
      group.add(shard);
      this.items.push({
        object: shard,
        life: 0.75,
        maxLife: 0.75,
        velocity: vel,
        spin,
        onUpdate: (item, dt) => {
          item.velocity!.y -= 14 * dt;
          const m = (item.object as THREE.Mesh).material as THREE.MeshBasicMaterial;
          m.opacity = Math.max(0, item.life / item.maxLife);
        }
      });
    }
    this.scene.add(group);
  }

  spawnDamageNumber(position: THREE.Vector3, camera: THREE.Camera, amount: number, critical: boolean) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.font = `bold ${critical ? 96 : 72}px "Zen Kaku Gothic New", system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const label = critical ? `${amount}!` : `${amount}`;
    ctx.lineWidth = 10;
    ctx.strokeStyle = "#1b1629";
    ctx.strokeText(label, 128, 64);
    ctx.fillStyle = critical ? "#ffe14a" : "#ffffff";
    ctx.fillText(label, 128, 64);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(position);
    sprite.scale.set(critical ? 1.6 : 1.2, critical ? 0.8 : 0.6, 1);
    sprite.renderOrder = 1000;
    this.scene.add(sprite);

    const cameraRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    const drift = new THREE.Vector3(0, 2.4, 0).addScaledVector(cameraRight, (Math.random() - 0.5) * 2);
    this.items.push({
      object: sprite,
      life: 0.9,
      maxLife: 0.9,
      velocity: drift,
      onUpdate: (item) => {
        (item.object as THREE.Sprite).material.opacity = Math.max(0, item.life / item.maxLife);
      }
    });
  }

  private disposeObject(object: THREE.Object3D) {
    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      }
      const sprite = child as THREE.Sprite;
      if (sprite.isSprite) {
        sprite.material.dispose();
      }
    });
    const asSprite = object as THREE.Sprite;
    if (asSprite.isSprite) asSprite.material.dispose();
  }

  private static makeSparkTexture() {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.25, "rgba(255,255,255,0.9)");
    gradient.addColorStop(0.6, "rgba(255,255,255,0.35)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    // Cross star
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(size / 2 - 2, 0, 4, size);
    ctx.fillRect(0, size / 2 - 2, size, 4);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private static makeRingTexture() {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.strokeStyle = "rgba(255,255,255,1)";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
    ctx.stroke();
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private static makeSlashTexture() {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createLinearGradient(0, 32, size, 32);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(0.5, "rgba(255,255,255,1)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 20, size, 24);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
}
