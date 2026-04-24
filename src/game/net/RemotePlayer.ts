import * as THREE from "three";
import { createToonMaterial } from "../rendering/ToonMaterial";
import { animePalette } from "../anime/palette";
import { animeWeaponFactories } from "../anime/weapons";
import { createContactShadow } from "../anime/groundOverlay";
import type { WeaponId } from "../config";
import type { PeerStatePayload } from "./NetworkManager";

export class RemotePlayer {
  readonly id: string;
  readonly group: THREE.Group;
  private readonly weaponSocket = new THREE.Group();
  private weaponGroups: Partial<Record<WeaponId, THREE.Group>> = {};
  private currentWeapon: WeaponId = "rifle";
  private targetPos = new THREE.Vector3();
  private targetYaw = 0;
  private bob = 0;
  private lastUpdateT = 0;

  constructor(id: string) {
    this.id = id;
    this.group = new THREE.Group();
    this.group.name = `Remote_${id}`;

    // Chibi ally body
    const bodyMat = createToonMaterial({
      color: animePalette.allyBlue,
      shadowColor: "#1f4a7a",
      steps: 3,
      rimColor: "#dff6ff",
      rimStrength: 0.28,
      rimWidth: 0.36
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.95, 0.55), bodyMat);
    body.position.y = 0.92;
    body.castShadow = true;
    body.receiveShadow = true;
    this.group.add(body);

    const headMat = createToonMaterial({
      color: "#ffe4cc",
      shadowColor: "#b3866a",
      steps: 4,
      rimStrength: 0.18
    });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 12), headMat);
    head.position.y = 1.82;
    head.castShadow = true;
    this.group.add(head);

    const hairMat = createToonMaterial({
      color: "#2b4b73",
      shadowColor: "#0c1a2b",
      steps: 3,
      rimColor: animePalette.neonCyan,
      rimStrength: 0.3
    });
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.46, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.65),
      hairMat
    );
    hair.position.y = 1.86;
    hair.castShadow = true;
    this.group.add(hair);

    const eyeMat = new THREE.MeshBasicMaterial({ color: animePalette.neonCyan });
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), eyeMat);
    leftEye.position.set(-0.12, 1.82, 0.37);
    const rightEye = leftEye.clone();
    rightEye.position.x = 0.12;
    this.group.add(leftEye, rightEye);

    const armMat = bodyMat.clone();
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.2), armMat);
    leftArm.position.set(-0.5, 1.0, 0);
    leftArm.castShadow = true;
    const rightArm = leftArm.clone();
    rightArm.position.x = 0.5;
    this.group.add(leftArm, rightArm);

    const legMat = createToonMaterial({
      color: "#1d2f4a",
      shadowColor: "#080f1a",
      steps: 3,
      rimStrength: 0.1
    });
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.6, 0.24), legMat);
    leftLeg.position.set(-0.18, 0.3, 0);
    leftLeg.castShadow = true;
    const rightLeg = leftLeg.clone();
    rightLeg.position.x = 0.18;
    this.group.add(leftLeg, rightLeg);

    // Weapon socket on right shoulder-ish
    this.weaponSocket.position.set(0.5, 1.1, 0.1);
    this.weaponSocket.rotation.set(0, 0, 0);
    this.weaponSocket.scale.setScalar(0.5);
    this.group.add(this.weaponSocket);

    const ids: WeaponId[] = ["rifle", "pistol", "smg"];
    for (const id of ids) {
      const w = animeWeaponFactories[id]();
      w.visible = id === "rifle";
      this.weaponSocket.add(w);
      this.weaponGroups[id] = w;
    }

    const shadow = createContactShadow();
    shadow.position.set(0, 0.02, 0);
    shadow.scale.set(1.4, 1.4, 1);
    this.group.add(shadow);
  }

  applyState(state: PeerStatePayload) {
    this.targetPos.set(state.pos[0], state.pos[1], state.pos[2]);
    this.targetYaw = state.yaw;
    this.lastUpdateT = state.t;
    if (state.weaponId !== this.currentWeapon) {
      const prev = this.weaponGroups[this.currentWeapon];
      const next = this.weaponGroups[state.weaponId];
      if (prev) prev.visible = false;
      if (next) next.visible = true;
      this.currentWeapon = state.weaponId;
    }
  }

  update(dt: number) {
    this.group.position.lerp(this.targetPos, Math.min(1, dt * 12));
    const curYaw = this.group.rotation.y;
    const delta = Math.atan2(Math.sin(this.targetYaw - curYaw), Math.cos(this.targetYaw - curYaw));
    this.group.rotation.y = curYaw + delta * Math.min(1, dt * 12);
    this.bob += dt * 4;
    // Subtle idle sway
    this.group.position.y = this.targetPos.y + Math.sin(this.bob) * 0.02;
  }

  dispose() {
    this.group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      }
    });
  }
}
