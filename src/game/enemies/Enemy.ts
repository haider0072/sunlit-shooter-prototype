import * as THREE from "three";
import { createToonMaterial } from "../rendering/ToonMaterial";
import { animePalette } from "../anime/palette";

export type EnemyType = "rusher" | "shooter" | "heavy";

export type EnemyArchetype = {
  type: EnemyType;
  displayName: string;
  maxHp: number;
  moveSpeed: number;
  attackRange: number;
  detectRange: number;
  damagePerSec: number;
  scoreValue: number;
  scale: number;
  primary: THREE.ColorRepresentation;
  secondary: THREE.ColorRepresentation;
  accent: THREE.ColorRepresentation;
};

export const enemyArchetypes: Record<EnemyType, EnemyArchetype> = {
  rusher: {
    type: "rusher",
    displayName: "Rusher",
    maxHp: 2,
    moveSpeed: 7.8,
    attackRange: 2.2,
    detectRange: 55,
    damagePerSec: 18,
    scoreValue: 25,
    scale: 0.9,
    primary: "#ff4d78",
    secondary: "#7a1a35",
    accent: "#ffdc4a"
  },
  shooter: {
    type: "shooter",
    displayName: "Shooter",
    maxHp: 3,
    moveSpeed: 4.2,
    attackRange: 22,
    detectRange: 48,
    damagePerSec: 9,
    scoreValue: 40,
    scale: 1.0,
    primary: "#8f6bff",
    secondary: "#3a2670",
    accent: "#39f0ff"
  },
  heavy: {
    type: "heavy",
    displayName: "Heavy",
    maxHp: 7,
    moveSpeed: 2.6,
    attackRange: 4.5,
    detectRange: 42,
    damagePerSec: 28,
    scoreValue: 120,
    scale: 1.28,
    primary: "#5a6a7a",
    secondary: "#262f3a",
    accent: "#ff7a2b"
  }
};

export type EnemyState = "idle" | "alert" | "chase" | "attack" | "retreat" | "dead";

export class Enemy {
  readonly type: EnemyType;
  readonly archetype: EnemyArchetype;
  readonly group: THREE.Group;
  readonly bodyMesh: THREE.Mesh;
  readonly headMesh: THREE.Mesh;
  hp: number;
  state: EnemyState = "idle";
  velocity = new THREE.Vector3();
  attackCooldown = 0;
  shootCooldown = 0;
  alive = true;
  lastSeenTime = 0;
  spawnFlashTimer = 0.6;
  private hitFlashTimer = 0;
  private bob = Math.random() * Math.PI * 2;
  private readonly baseColor: THREE.Color;

  constructor(type: EnemyType, spawnPosition: THREE.Vector3) {
    this.type = type;
    this.archetype = enemyArchetypes[type];
    this.hp = this.archetype.maxHp;
    this.group = new THREE.Group();
    this.group.name = `Enemy_${type}`;

    // Procedural anime chibi body
    const bodyGeo = new THREE.BoxGeometry(0.7, 0.9, 0.5);
    const bodyMat = createToonMaterial({
      color: this.archetype.primary,
      shadowColor: this.archetype.secondary,
      steps: 3,
      rimColor: "#ffffff",
      rimStrength: 0.22,
      rimWidth: 0.35
    });
    this.baseColor = new THREE.Color(this.archetype.primary);
    this.bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.bodyMesh.position.y = 0.9;
    this.bodyMesh.castShadow = true;
    this.bodyMesh.receiveShadow = true;
    this.group.add(this.bodyMesh);

    // Head — bigger than body for chibi proportion
    const headGeo = new THREE.SphereGeometry(0.42, 14, 12);
    const headMat = createToonMaterial({
      color: "#ffe4cc",
      shadowColor: "#b3866a",
      steps: 4,
      rimStrength: 0.18
    });
    this.headMesh = new THREE.Mesh(headGeo, headMat);
    this.headMesh.position.y = 1.82;
    this.headMesh.castShadow = true;
    this.headMesh.userData.isHead = true;
    this.group.add(this.headMesh);

    // Hair / hood
    const hairGeo = new THREE.SphereGeometry(0.46, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.65);
    const hairMat = createToonMaterial({
      color: this.archetype.secondary,
      shadowColor: "#1a1026",
      steps: 3,
      rimColor: this.archetype.accent,
      rimStrength: 0.3,
      rimWidth: 0.4
    });
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.y = 1.86;
    hair.castShadow = true;
    this.group.add(hair);

    // Eyes — simple anime eyes
    const eyeGeo = new THREE.SphereGeometry(0.06, 8, 6);
    const eyeMat = new THREE.MeshBasicMaterial({ color: this.archetype.accent });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.12, 1.82, 0.37);
    const rightEye = leftEye.clone();
    rightEye.position.x = 0.12;
    this.group.add(leftEye, rightEye);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.2, 0.72, 0.2);
    const armMat = bodyMat.clone();
    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-0.48, 1.0, 0);
    leftArm.castShadow = true;
    const rightArm = leftArm.clone();
    rightArm.position.x = 0.48;
    this.group.add(leftArm, rightArm);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.24, 0.6, 0.24);
    const legMat = createToonMaterial({
      color: this.archetype.secondary,
      shadowColor: "#140c1f",
      steps: 3,
      rimStrength: 0.12
    });
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.18, 0.3, 0);
    leftLeg.castShadow = true;
    const rightLeg = leftLeg.clone();
    rightLeg.position.x = 0.18;
    this.group.add(leftLeg, rightLeg);

    // If heavy — add armor shoulders
    if (type === "heavy") {
      const shoulderGeo = new THREE.BoxGeometry(1.1, 0.22, 0.6);
      const shoulderMat = createToonMaterial({
        color: this.archetype.accent,
        shadowColor: "#7a3510",
        steps: 3,
        rimStrength: 0.25
      });
      const shoulders = new THREE.Mesh(shoulderGeo, shoulderMat);
      shoulders.position.y = 1.38;
      shoulders.castShadow = true;
      this.group.add(shoulders);
    }

    // Weapon for shooter
    if (type === "shooter") {
      const weaponGeo = new THREE.BoxGeometry(0.12, 0.12, 0.6);
      const weaponMat = createToonMaterial({
        color: this.archetype.accent,
        shadowColor: "#0a3340",
        steps: 3,
        rimStrength: 0.25
      });
      const weapon = new THREE.Mesh(weaponGeo, weaponMat);
      weapon.position.set(0.5, 1.1, -0.35);
      weapon.castShadow = true;
      this.group.add(weapon);
    }

    this.group.scale.setScalar(this.archetype.scale);
    this.group.position.copy(spawnPosition);
  }

  update(dt: number, playerPosition: THREE.Vector3, elapsed: number): EnemyUpdateResult {
    if (!this.alive) return { fireDirection: null };
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.spawnFlashTimer = Math.max(0, this.spawnFlashTimer - dt);
    this.bob += dt * 3;

    const toPlayer = new THREE.Vector3().subVectors(playerPosition, this.group.position);
    toPlayer.y = 0;
    const distance = toPlayer.length();
    const dir = distance > 0.001 ? toPlayer.clone().normalize() : new THREE.Vector3(0, 0, 1);
    const seePlayer = distance < this.archetype.detectRange;

    // State transitions
    if (this.state === "idle" && seePlayer) this.state = "alert";
    if (this.state === "alert" && distance > this.archetype.attackRange * 1.1) this.state = "chase";
    if (this.state === "chase" && distance <= this.archetype.attackRange) this.state = "attack";
    if (this.state === "attack" && distance > this.archetype.attackRange * 1.15) this.state = "chase";
    if (!seePlayer && this.state !== "dead") this.state = "idle";

    // Behaviour by state
    let fireDirection: THREE.Vector3 | null = null;
    if (this.state === "chase") {
      this.velocity.copy(dir).multiplyScalar(this.archetype.moveSpeed);
    } else if (this.state === "attack") {
      if (this.type === "shooter") {
        // Shooter holds distance and fires
        if (distance < this.archetype.attackRange * 0.6) {
          this.velocity.copy(dir).multiplyScalar(-this.archetype.moveSpeed * 0.6);
        } else {
          this.velocity.multiplyScalar(Math.pow(0.002, dt));
        }
        if (this.shootCooldown <= 0) {
          fireDirection = dir.clone();
          this.shootCooldown = 1.1;
        }
      } else {
        // Rusher / heavy close in
        this.velocity.copy(dir).multiplyScalar(this.archetype.moveSpeed * 0.35);
      }
    } else if (this.state === "alert") {
      this.velocity.multiplyScalar(Math.pow(0.002, dt));
    } else {
      this.velocity.multiplyScalar(Math.pow(0.001, dt));
    }

    // Apply movement
    this.group.position.addScaledVector(this.velocity, dt);

    // Face player
    if (distance > 0.01) {
      this.group.rotation.y = Math.atan2(dir.x, dir.z);
    }

    // Body bob on movement
    const speed = this.velocity.length();
    const bobAmp = Math.min(speed * 0.02, 0.12);
    this.group.position.y = Math.sin(this.bob) * bobAmp;

    // Hit flash fade
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
      const flash = this.hitFlashTimer / 0.18;
      const bodyMat = this.bodyMesh.material as THREE.MeshStandardMaterial;
      bodyMat.color.copy(this.baseColor).lerp(new THREE.Color("#ffffff"), flash);
    }

    // Spawn flash — scale up from 0 to 1 briefly
    if (this.spawnFlashTimer > 0) {
      const t = 1 - this.spawnFlashTimer / 0.6;
      const s = this.archetype.scale * (0.1 + t * 0.9);
      this.group.scale.setScalar(s);
    } else if (this.group.scale.x !== this.archetype.scale) {
      this.group.scale.setScalar(this.archetype.scale);
    }

    void elapsed;
    return { fireDirection };
  }

  takeDamage(amount: number, headshot = false): { killed: boolean; damageDealt: number } {
    if (!this.alive) return { killed: false, damageDealt: 0 };
    const dmg = headshot ? amount * 2 : amount;
    this.hp -= dmg;
    this.hitFlashTimer = 0.18;
    if (this.hp <= 0) {
      this.alive = false;
      this.state = "dead";
      return { killed: true, damageDealt: dmg };
    }
    return { killed: false, damageDealt: dmg };
  }

  getWorldCenter(target = new THREE.Vector3()) {
    this.group.getWorldPosition(target);
    target.y += 1.2 * this.archetype.scale;
    return target;
  }

  getHeadWorldPosition(target = new THREE.Vector3()) {
    this.headMesh.getWorldPosition(target);
    return target;
  }
}

export type EnemyUpdateResult = {
  fireDirection: THREE.Vector3 | null;
};

void animePalette;
