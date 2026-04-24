import * as THREE from "three";
import { createToonMaterial } from "../rendering/ToonMaterial";
import { animePalette } from "./palette";

type AnimeWeaponColors = {
  body: THREE.ColorRepresentation;
  accent: THREE.ColorRepresentation;
  glow: THREE.ColorRepresentation;
  trim: THREE.ColorRepresentation;
};

const paletteByType: Record<"rifle" | "pistol" | "smg", AnimeWeaponColors> = {
  rifle: {
    body: "#f7a8c8",
    accent: "#ffe1ef",
    glow: "#ff3e9a",
    trim: "#2d1b3b"
  },
  pistol: {
    body: "#ff86b8",
    accent: "#ffd8e8",
    glow: "#ff3e9a",
    trim: "#1a1026"
  },
  smg: {
    body: "#5ed9ff",
    accent: "#c6f2ff",
    glow: "#39f0ff",
    trim: "#0f2a35"
  }
};

function bodyMat(color: THREE.ColorRepresentation) {
  return createToonMaterial({
    color,
    shadowColor: "#2a1d36",
    steps: 4,
    rimColor: "#ffffff",
    rimStrength: 0.35,
    rimWidth: 0.32,
    specular: true
  });
}

function accentMat(color: THREE.ColorRepresentation) {
  return createToonMaterial({
    color,
    shadowColor: "#4a3a56",
    steps: 3,
    rimStrength: 0.15
  });
}

function glowMat(color: THREE.ColorRepresentation) {
  return new THREE.MeshBasicMaterial({ color, toneMapped: false });
}

function trimMat(color: THREE.ColorRepresentation) {
  return createToonMaterial({
    color,
    shadowColor: "#0a0814",
    steps: 3,
    rimStrength: 0.08
  });
}

export function createAnimeRifle() {
  const colors = paletteByType.rifle;
  const group = new THREE.Group();
  group.name = "AnimeRifle";

  // Main body — elongated box
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 1.2), bodyMat(colors.body));
  body.position.set(0, 0, 0);
  group.add(body);

  // Upper rail accent
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 1.05), accentMat(colors.accent));
  rail.position.set(0, 0.135, -0.05);
  group.add(rail);

  // Scope cylinder
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.28, 12), trimMat(colors.trim));
  scope.rotation.z = Math.PI / 2;
  scope.position.set(0, 0.21, -0.15);
  group.add(scope);

  // Scope lens glow
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.038, 16), glowMat(colors.glow));
  lens.rotation.y = Math.PI / 2;
  lens.position.set(0.14, 0.21, -0.15);
  group.add(lens);

  // Barrel
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.55, 10), trimMat(colors.trim));
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0, -0.85);
  group.add(barrel);

  // Muzzle accent
  const muzzle = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.12, 8), accentMat(colors.accent));
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0, 0, -1.18);
  group.add(muzzle);

  // Grip — angled box
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.26, 0.16), trimMat(colors.trim));
  grip.position.set(0, -0.22, 0.2);
  grip.rotation.x = 0.2;
  group.add(grip);

  // Trigger guard
  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 12, Math.PI), trimMat(colors.trim));
  guard.rotation.x = Math.PI;
  guard.position.set(0, -0.1, 0.1);
  group.add(guard);

  // Mag
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.14), accentMat(colors.accent));
  mag.position.set(0, -0.25, -0.05);
  group.add(mag);

  // Stock
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.32), bodyMat(colors.body));
  stock.position.set(0, -0.02, 0.72);
  group.add(stock);

  // Stock pad
  const stockPad = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.05), trimMat(colors.trim));
  stockPad.position.set(0, -0.02, 0.9);
  group.add(stockPad);

  // Energy core glow — side accent
  const core = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.38), glowMat(colors.glow));
  core.position.set(0.095, 0, 0.05);
  const coreR = core.clone();
  coreR.position.x = -0.095;
  group.add(core, coreR);

  group.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) mesh.castShadow = true;
  });

  return group;
}

export function createAnimePistol() {
  const colors = paletteByType.pistol;
  const group = new THREE.Group();
  group.name = "AnimePistol";

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.5), bodyMat(colors.body));
  body.position.set(0, 0, 0);
  group.add(body);

  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.48), accentMat(colors.accent));
  slide.position.set(0, 0.13, 0);
  group.add(slide);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.22, 10), trimMat(colors.trim));
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, -0.3);
  group.add(barrel);

  const muzzle = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.06, 8), glowMat(colors.glow));
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0, 0.02, -0.44);
  group.add(muzzle);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, 0.16), trimMat(colors.trim));
  grip.position.set(0, -0.25, 0.08);
  grip.rotation.x = 0.18;
  group.add(grip);

  const gripInlay = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.22, 0.04), glowMat(colors.glow));
  gripInlay.position.set(0.055, -0.25, 0.1);
  group.add(gripInlay);

  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.01, 6, 12, Math.PI), trimMat(colors.trim));
  guard.rotation.x = Math.PI;
  guard.position.set(0, -0.08, 0.1);
  group.add(guard);

  group.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) mesh.castShadow = true;
  });

  return group;
}

export function createAnimeSMG() {
  const colors = paletteByType.smg;
  const group = new THREE.Group();
  group.name = "AnimeSMG";

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.78), bodyMat(colors.body));
  body.position.set(0, 0, 0);
  group.add(body);

  // Top vents
  for (let i = 0; i < 4; i += 1) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.06), trimMat(colors.trim));
    vent.position.set(0, 0.1, -0.3 + i * 0.14);
    group.add(vent);
  }

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.35, 10), trimMat(colors.trim));
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0, -0.58);
  group.add(barrel);

  const muzzle = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.08, 8), glowMat(colors.glow));
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0, 0, -0.8);
  group.add(muzzle);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 0.14), trimMat(colors.trim));
  grip.position.set(0, -0.22, 0.12);
  grip.rotation.x = 0.15;
  group.add(grip);

  const foregrip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.18, 0.1), trimMat(colors.trim));
  foregrip.position.set(0, -0.15, -0.24);
  group.add(foregrip);

  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.34, 0.13), accentMat(colors.accent));
  mag.position.set(0, -0.3, 0.0);
  group.add(mag);

  // Energy core glow along side
  const coreL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.46), glowMat(colors.glow));
  coreL.position.set(0.085, 0.02, 0.02);
  const coreR = coreL.clone();
  coreR.position.x = -0.085;
  group.add(coreL, coreR);

  // Stock — compact SMG style
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.24), bodyMat(colors.body));
  stock.position.set(0, -0.02, 0.52);
  group.add(stock);

  group.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) mesh.castShadow = true;
  });

  return group;
}

export const animeWeaponFactories: Record<"rifle" | "pistol" | "smg", () => THREE.Group> = {
  rifle: createAnimeRifle,
  pistol: createAnimePistol,
  smg: createAnimeSMG
};
