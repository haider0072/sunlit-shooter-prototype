import * as THREE from "three";
import { palette } from "./palette";

export class EffectManager {
  private readonly items: THREE.Object3D[] = [];
  private readonly muzzleFlashTexture: THREE.Texture;
  private readonly smokeTexture: THREE.Texture;

  constructor(private readonly scene: THREE.Scene, private readonly camera: THREE.Camera) {
    this.muzzleFlashTexture = EffectManager.createMuzzleFlashTexture();
    this.smokeTexture = EffectManager.createSmokeTexture();
  }

  get count(): number {
    return this.items.length;
  }

  addTransient(object: THREE.Object3D) {
    this.items.push(object);
    this.scene.add(object);
  }

  update(dt: number) {
    for (let i = this.items.length - 1; i >= 0; i -= 1) {
      const effect = this.items[i];
      effect.userData.life -= dt;
      effect.position.addScaledVector(effect.userData.velocity, dt);
      if (effect.userData.spin) {
        effect.rotation.x += effect.userData.spin.x * dt;
        effect.rotation.y += effect.userData.spin.y * dt;
        effect.rotation.z += effect.userData.spin.z * dt;
      }
      if (!effect.userData.noScale) effect.scale.multiplyScalar(1 + dt * 2.5);
      const opacity = Math.max(0, effect.userData.life / effect.userData.maxLife);
      if ((effect as THREE.Sprite).isSprite) {
        const mat = (effect as THREE.Sprite).material as THREE.SpriteMaterial;
        mat.opacity = opacity * (effect.userData.baseOpacity ?? 1);
      } else if ((effect as THREE.Mesh).isMesh) {
        const mat = (effect as THREE.Mesh).material as THREE.MeshBasicMaterial;
        mat.opacity = opacity;
      } else if ((effect as THREE.Light).isLight) {
        const light = effect as THREE.Light;
        const base = effect.userData.baseIntensity ?? light.intensity;
        light.intensity = base * opacity;
      } else {
        effect.traverse((child) => {
          if (!(child as THREE.Mesh).isMesh) return;
          const material = (child as THREE.Mesh).material;
          if (Array.isArray(material)) {
            material.forEach((mat) => {
              if ("opacity" in mat) mat.opacity = opacity;
            });
          } else if ("opacity" in material) {
            material.opacity = opacity;
          }
        });
      }
      if (effect.userData.life <= 0) {
        this.scene.remove(effect);
        if ((effect as THREE.Sprite).isSprite) {
          ((effect as THREE.Sprite).material as THREE.SpriteMaterial).dispose();
          this.items.splice(i, 1);
          continue;
        }
        effect.traverse((child) => {
          if (!(child as THREE.Mesh).isMesh) return;
          const mesh = child as THREE.Mesh;
          const material = mesh.material;
          if (Array.isArray(material)) {
            material.forEach((mat) => mat.dispose());
          } else {
            material.dispose();
          }
          mesh.geometry.dispose();
        });
        this.items.splice(i, 1);
      }
    }
  }

  spawnImpact(position: THREE.Vector3, color: THREE.Color) {
    this.spawnBulletMark(position, color);
    for (let i = 0; i < 7; i += 1) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.026 + i * 0.003, 8, 8),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72 })
      );
      mesh.position.copy(position);
      mesh.userData.life = 0.24 + i * 0.012;
      mesh.userData.maxLife = mesh.userData.life;
      mesh.userData.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 1.8,
        Math.random() * 1.45,
        (Math.random() - 0.5) * 1.8
      );
      this.addTransient(mesh);
    }
  }

  spawnGroundDust(position: THREE.Vector3) {
    const dust = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.smokeTexture,
        color: "#9e947d",
        transparent: true,
        opacity: 0.26,
        depthWrite: false
      })
    );
    dust.position.copy(position).add(new THREE.Vector3(0, 0.08, 0));
    dust.scale.setScalar(0.34);
    dust.userData.life = 0.22;
    dust.userData.maxLife = 0.22;
    dust.userData.velocity = new THREE.Vector3(0, 0.18, 0);
    dust.userData.baseOpacity = 0.26;
    this.addTransient(dust);
  }

  spawnExplosion(position: THREE.Vector3) {
    const flash = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.muzzleFlashTexture,
        color: "#fff2c0",
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 1,
        depthTest: false,
        depthWrite: false
      })
    );
    flash.position.copy(position).add(new THREE.Vector3(0, 0.55, 0));
    flash.scale.set(2.2, 1.5, 1);
    flash.renderOrder = 130;
    flash.userData.life = 0.18;
    flash.userData.maxLife = 0.18;
    flash.userData.velocity = new THREE.Vector3(0, 0.45, 0);
    flash.userData.baseOpacity = 1;
    this.addTransient(flash);

    const light = new THREE.PointLight("#ff8c3a", 8.5, 9);
    light.position.copy(position).add(new THREE.Vector3(0, 0.8, 0));
    light.userData.life = 0.18;
    light.userData.maxLife = 0.18;
    light.userData.velocity = new THREE.Vector3();
    light.userData.baseIntensity = light.intensity;
    this.addTransient(light);

    for (let i = 0; i < 18; i += 1) {
      const angle = (i / 18) * Math.PI * 2;
      const outward = new THREE.Vector3(Math.cos(angle), 0.2 + Math.random() * 0.6, Math.sin(angle)).normalize();
      const ember = new THREE.Mesh(
        new THREE.SphereGeometry(0.035 + Math.random() * 0.025, 8, 8),
        new THREE.MeshBasicMaterial({
          color: i % 3 === 0 ? "#fff2b2" : "#ff7a2e",
          transparent: true,
          opacity: 0.86
        })
      );
      ember.position.copy(position).add(new THREE.Vector3(0, 0.35, 0));
      ember.userData.life = 0.42 + Math.random() * 0.22;
      ember.userData.maxLife = ember.userData.life;
      ember.userData.velocity = outward.multiplyScalar(2.4 + Math.random() * 2.2);
      this.addTransient(ember);
    }

    for (let i = 0; i < 5; i += 1) {
      const smoke = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.smokeTexture,
          color: "#80796b",
          transparent: true,
          opacity: 0.32,
          depthWrite: false
        })
      );
      smoke.position.copy(position).add(new THREE.Vector3((Math.random() - 0.5) * 0.55, 0.35 + Math.random() * 0.35, (Math.random() - 0.5) * 0.55));
      smoke.scale.setScalar(0.62 + Math.random() * 0.42);
      smoke.userData.life = 0.78 + Math.random() * 0.35;
      smoke.userData.maxLife = smoke.userData.life;
      smoke.userData.velocity = new THREE.Vector3((Math.random() - 0.5) * 0.42, 0.62 + Math.random() * 0.42, (Math.random() - 0.5) * 0.42);
      smoke.userData.baseOpacity = 0.32;
      this.addTransient(smoke);
    }
  }

  spawnBulletMark(position: THREE.Vector3, color: THREE.Color) {
    const onGround = position.y <= 0.13;
    const normal = onGround ? new THREE.Vector3(0, 1, 0) : this.camera.position.clone().sub(position).normalize();
    const markColor = color.equals(palette.coral) ? "#8d332d" : "#263239";
    const mark = new THREE.Mesh(
      new THREE.CircleGeometry(onGround ? 0.075 : 0.06, 14),
      new THREE.MeshBasicMaterial({
        color: markColor,
        transparent: true,
        opacity: 0.54,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    mark.position.copy(position).addScaledVector(normal, 0.012);
    mark.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    mark.renderOrder = 40;
    mark.userData.life = 4.5;
    mark.userData.maxLife = 4.5;
    mark.userData.velocity = new THREE.Vector3();
    mark.userData.noScale = true;
    this.addTransient(mark);
  }

  spawnTracer(start: THREE.Vector3, end: THREE.Vector3) {
    const direction = end.clone().sub(start);
    direction.normalize();

    const flash = new THREE.PointLight(palette.coral, 2.8, 4.2);
    flash.position.copy(start);
    flash.userData.life = 0.055;
    flash.userData.maxLife = 0.055;
    flash.userData.velocity = new THREE.Vector3();
    flash.userData.baseIntensity = flash.intensity;
    this.addTransient(flash);
  }

  spawnMuzzleBurst(position: THREE.Vector3, direction: THREE.Vector3, firstPerson: boolean) {
    const flashPosition = position.clone().addScaledVector(direction, 0.08);
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(firstPerson ? 0.09 : 0.18, firstPerson ? 0.28 : 0.52, 8, 1, true),
      new THREE.MeshBasicMaterial({
        color: "#ff9b3d",
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.86,
        side: THREE.DoubleSide
      })
    );
    flame.renderOrder = 126;
    flame.position.copy(flashPosition).addScaledVector(direction, 0.24);
    flame.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    flame.userData.life = 0.065;
    flame.userData.maxLife = 0.065;
    flame.userData.velocity = direction.clone().multiplyScalar(0.16);
    flame.userData.noScale = true;
    this.addTransient(flame);

    const burst = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.muzzleFlashTexture,
        color: "#fff4dc",
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 1
      })
    );
    burst.renderOrder = 128;
    burst.position.copy(flashPosition);
    burst.scale.set(firstPerson ? 0.22 : 0.54, firstPerson ? 0.12 : 0.28, 1);
    burst.userData.life = 0.075;
    burst.userData.maxLife = 0.075;
    burst.userData.velocity = direction.clone().multiplyScalar(0.12);
    burst.userData.noScale = true;
    this.addTransient(burst);

    const streak = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.muzzleFlashTexture,
        color: "#ff9b3d",
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.62
      })
    );
    streak.renderOrder = 127;
    streak.position.copy(flashPosition).addScaledVector(direction, firstPerson ? 0.18 : 0.32);
    streak.scale.set(firstPerson ? 0.28 : 0.72, firstPerson ? 0.045 : 0.09, 1);
    streak.userData.life = 0.055;
    streak.userData.maxLife = 0.055;
    streak.userData.velocity = direction.clone().multiplyScalar(0.38);
    streak.userData.noScale = true;
    streak.userData.baseOpacity = 0.62;
    this.addTransient(streak);

    for (let i = 0; i < 2; i += 1) {
      const smoke = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.smokeTexture,
          color: "#b8b096",
          depthTest: true,
          depthWrite: false,
          transparent: true,
          opacity: 0.22
        })
      );
      smoke.renderOrder = 25;
      smoke.position.copy(flashPosition).addScaledVector(direction, 0.15 + i * 0.12);
      smoke.scale.setScalar((firstPerson ? 0.12 : 0.22) + i * (firstPerson ? 0.04 : 0.08));
      smoke.userData.life = 0.22 + i * 0.05;
      smoke.userData.maxLife = smoke.userData.life;
      smoke.userData.velocity = direction.clone().multiplyScalar(0.32 + i * 0.18).add(new THREE.Vector3(0, 0.05, 0));
      smoke.userData.baseOpacity = 0.22;
      this.addTransient(smoke);
    }

    const light = new THREE.PointLight(palette.coral, 3.8, 3.6);
    light.position.copy(flashPosition);
    light.userData.life = 0.065;
    light.userData.maxLife = 0.065;
    light.userData.velocity = new THREE.Vector3();
    light.userData.baseIntensity = light.intensity;
    this.addTransient(light);
  }

  spawnShellEjection(muzzlePosition: THREE.Vector3, shotDirection: THREE.Vector3) {
    const forward = shotDirection.clone().normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
    if (right.lengthSq() < 0.001) right.set(1, 0, 0);
    right.normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();

    const shell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.08, 8),
      new THREE.MeshStandardMaterial({ color: "#f6d38d", metalness: 0.7, roughness: 0.3 })
    );
    shell.renderOrder = 112;
    shell.position.copy(muzzlePosition).addScaledVector(right, 0.09).addScaledVector(up, -0.02);
    shell.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), right.clone().addScaledVector(up, 0.4).normalize());
    shell.userData.life = 0.58;
    shell.userData.maxLife = 0.58;
    shell.userData.noScale = true;
    shell.userData.velocity = right
      .clone()
      .multiplyScalar(1.8 + Math.random() * 0.6)
      .addScaledVector(up, 1.3 + Math.random() * 0.7)
      .addScaledVector(forward, -0.28);
    shell.userData.spin = new THREE.Vector3(
      14 + Math.random() * 8,
      18 + Math.random() * 8,
      10 + Math.random() * 8
    );
    this.addTransient(shell);
  }

  private static createMuzzleFlashTexture(): THREE.Texture {
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = 128;
    textureCanvas.height = 128;
    const ctx = textureCanvas.getContext("2d");
    if (!ctx) throw new Error("Unable to create muzzle flash texture");

    const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
    gradient.addColorStop(0, "rgba(255,255,245,1)");
    gradient.addColorStop(0.18, "rgba(255,244,190,0.95)");
    gradient.addColorStop(0.42, "rgba(255,142,45,0.55)");
    gradient.addColorStop(0.72, "rgba(255,86,28,0.18)");
    gradient.addColorStop(1, "rgba(255,86,28,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    const streak = ctx.createLinearGradient(0, 64, 128, 64);
    streak.addColorStop(0, "rgba(255,120,35,0)");
    streak.addColorStop(0.32, "rgba(255,188,80,0.55)");
    streak.addColorStop(0.5, "rgba(255,255,230,0.96)");
    streak.addColorStop(0.68, "rgba(255,188,80,0.48)");
    streak.addColorStop(1, "rgba(255,120,35,0)");
    ctx.fillStyle = streak;
    ctx.fillRect(0, 54, 128, 20);

    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private static createSmokeTexture(): THREE.Texture {
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = 96;
    textureCanvas.height = 96;
    const ctx = textureCanvas.getContext("2d");
    if (!ctx) throw new Error("Unable to create smoke texture");
    const gradient = ctx.createRadialGradient(48, 48, 3, 48, 48, 46);
    gradient.addColorStop(0, "rgba(210,205,185,0.34)");
    gradient.addColorStop(0.45, "rgba(150,145,125,0.16)");
    gradient.addColorStop(1, "rgba(100,100,90,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 96, 96);

    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
}
