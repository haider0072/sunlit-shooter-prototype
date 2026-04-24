import * as THREE from "three";
import { createToonMaterial, applyToonToObject } from "../rendering/ToonMaterial";
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

  constructor(id: string, characterTemplate?: THREE.Object3D) {
    this.id = id;
    this.group = new THREE.Group();
    this.group.name = `Remote_${id}`;

    if (characterTemplate) {
      // Use the real Quaternius soldier — clone and tint ally cyan
      const clone = characterTemplate.clone(true);
      applyToonToObject(clone, {
        color: animePalette.allyBlue,
        shadowColor: "#1f4a7a",
        steps: 3,
        rimColor: "#dff6ff",
        rimStrength: 0.32,
        rimWidth: 0.35
      });
      clone.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });
      this.group.add(clone);

      // Weapon socket positioned like player's right hand-ish area
      this.weaponSocket.position.set(0.45, 1.2, 0.15);
      this.weaponSocket.rotation.set(0, THREE.MathUtils.degToRad(-85), 0);
      this.weaponSocket.scale.setScalar(0.55);
      this.group.add(this.weaponSocket);
    } else {
      // Fallback chibi body
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

      const headMat = createToonMaterial({ color: "#ffe4cc", shadowColor: "#b3866a", steps: 4, rimStrength: 0.18 });
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 12), headMat);
      head.position.y = 1.82;
      head.castShadow = true;
      this.group.add(head);

      const armMat = bodyMat.clone();
      const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.2), armMat);
      leftArm.position.set(-0.5, 1.0, 0);
      const rightArm = leftArm.clone();
      rightArm.position.x = 0.5;
      this.group.add(leftArm, rightArm);

      const legMat = createToonMaterial({ color: "#1d2f4a", shadowColor: "#080f1a", steps: 3, rimStrength: 0.1 });
      const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.6, 0.24), legMat);
      leftLeg.position.set(-0.18, 0.3, 0);
      const rightLeg = leftLeg.clone();
      rightLeg.position.x = 0.18;
      this.group.add(leftLeg, rightLeg);

      this.weaponSocket.position.set(0.5, 1.1, 0.1);
      this.weaponSocket.rotation.set(0, 0, 0);
      this.weaponSocket.scale.setScalar(0.5);
      this.group.add(this.weaponSocket);
    }

    // Ally marker — floating cyan ring above head so user can't mistake for enemy
    const ringMat = new THREE.MeshBasicMaterial({ color: animePalette.neonCyan, toneMapped: false, transparent: true, opacity: 0.8 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.05, 8, 20), ringMat);
    ring.position.y = 2.55;
    ring.rotation.x = Math.PI / 2;
    ring.userData.isAllyMarker = true;
    this.group.add(ring);

    // Ally beam (cyan vertical light column on ground)
    const beamMat = new THREE.MeshBasicMaterial({ color: animePalette.neonCyan, toneMapped: false, transparent: true, opacity: 0.18, depthWrite: false });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 3.0, 12, 1, true), beamMat);
    beam.position.y = 1.5;
    beam.renderOrder = 3;
    this.group.add(beam);

    const ids: WeaponId[] = ["rifle", "pistol", "smg"];
    for (const id of ids) {
      const w = animeWeaponFactories[id]();
      w.visible = id === "rifle";
      this.weaponSocket.add(w);
      this.weaponGroups[id] = w;
    }

    const shadow = createContactShadow();
    shadow.position.set(0, 0.02, 0);
    shadow.scale.set(1.5, 1.5, 1);
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
    this.group.position.y = this.targetPos.y + Math.sin(this.bob) * 0.02;
    // Rotate ally marker ring
    this.group.traverse((child) => {
      if (child.userData?.isAllyMarker) child.rotation.z += dt * 2;
    });
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
