import * as THREE from "three";

export type CameraMode = "third" | "first";

export type Target = {
  root: THREE.Group;
  meshes: THREE.Object3D[];
  hp: number;
  maxHp: number;
  wobble: number;
  baseY: number;
  baseScale: number;
  baseLift: number;
  hoverAmplitude: number;
  active: boolean;
};

export type Projectile = {
  root: THREE.Group;
  velocity: THREE.Vector3;
  previous: THREE.Vector3;
  life: number;
  distance: number;
  maxDistance: number;
};

export type Grenade = {
  root: THREE.Group;
  velocity: THREE.Vector3;
  life: number;
  fuse: number;
  bounces: number;
  exploded: boolean;
};

export type AimTrace = {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  point: THREE.Vector3;
  hitObjectName: string | null;
  hitDistance: number | null;
  result: "target" | "ground" | "range";
};

export type ShotResult = {
  direction: THREE.Vector3;
  point: THREE.Vector3;
  target?: Target;
  aimPoint: THREE.Vector3;
  baseDirection: THREE.Vector3;
  spread: number;
  moving: boolean;
  origin: THREE.Vector3;
  hitObjectName: string | null;
  hitDistance: number | null;
  groundDistance: number | null;
  rangeDistance: number;
  result: string;
  aimTrace: AimTrace;
};

export type PreShotState = {
  frame: number;
  time: number;
  ammoBefore: number;
  cooldownBefore: number;
  reloadBefore: number;
  statusBefore: string;
};
