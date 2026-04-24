import * as THREE from "three";
import { weaponLoadout, type WeaponId, type WeaponTuning } from "./config";
import { applyToonToObject } from "./rendering/ToonMaterial";

export type WeaponInstance = {
  id: WeaponId;
  tuning: WeaponTuning;
  group: THREE.Group;
  ammo: number;
};

type EquipCallback = (instance: WeaponInstance, previous: WeaponInstance | null) => void;

export class WeaponSystem {
  private readonly slots = new Map<WeaponId, WeaponInstance>();
  private readonly order: WeaponId[] = [];
  private currentId: WeaponId | null = null;
  private onEquipCb: EquipCallback | null = null;

  constructor(private readonly socket: THREE.Object3D) {}

  registerWeapon(id: WeaponId, group: THREE.Group, magSize?: number) {
    const tuning = weaponLoadout[id];
    applyToonToObject(group, {
      color: tuning.tint,
      shadowColor: "#1c1a20",
      steps: 3,
      rimColor: "#fff1d8",
      rimStrength: 0.28,
      rimWidth: 0.32
    });
    group.visible = false;
    group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) mesh.castShadow = true;
    });
    this.socket.add(group);
    const instance: WeaponInstance = {
      id,
      tuning,
      group,
      ammo: magSize ?? tuning.magSize
    };
    this.slots.set(id, instance);
    this.order.push(id);
  }

  onEquip(cb: EquipCallback) {
    this.onEquipCb = cb;
  }

  equip(id: WeaponId) {
    const instance = this.slots.get(id);
    if (!instance) return;
    if (this.currentId === id) return;
    const prev = this.currentId ? this.slots.get(this.currentId) ?? null : null;
    if (prev) prev.group.visible = false;
    instance.group.visible = true;
    this.currentId = id;
    this.onEquipCb?.(instance, prev);
  }

  current(): WeaponInstance | null {
    return this.currentId ? this.slots.get(this.currentId) ?? null : null;
  }

  next() {
    if (this.order.length === 0 || !this.currentId) return;
    const idx = this.order.indexOf(this.currentId);
    const nextId = this.order[(idx + 1) % this.order.length];
    this.equip(nextId);
  }

  has(id: WeaponId) {
    return this.slots.has(id);
  }

  setAmmo(id: WeaponId, ammo: number) {
    const instance = this.slots.get(id);
    if (instance) instance.ammo = ammo;
  }

  list(): WeaponInstance[] {
    return this.order.map((id) => this.slots.get(id)!).filter(Boolean);
  }
}
