import * as THREE from "three";
import { createToonMaterial } from "../rendering/ToonMaterial";
import { animePalette } from "./palette";

function barrierMat() {
  return createToonMaterial({
    color: "#c2b7a3",
    shadowColor: "#6d5f4a",
    steps: 3,
    rimColor: "#fff0cf",
    rimStrength: 0.14
  });
}

function neonAccent(color: THREE.ColorRepresentation) {
  return new THREE.MeshBasicMaterial({ color, toneMapped: false });
}

export function createToriiGate(position: THREE.Vector3, rotationY = 0) {
  const group = new THREE.Group();
  group.name = "ToriiGate";
  const pillarMat = createToonMaterial({
    color: "#d64a3a",
    shadowColor: "#7a1a10",
    steps: 3,
    rimColor: "#ffccbb",
    rimStrength: 0.25
  });
  const crossMat = createToonMaterial({
    color: "#1a1520",
    shadowColor: "#05050a",
    steps: 3,
    rimStrength: 0.1
  });
  const pillarL = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 5.5, 10), pillarMat);
  pillarL.position.set(-2.2, 2.75, 0);
  pillarL.castShadow = true;
  const pillarR = pillarL.clone();
  pillarR.position.x = 2.2;
  const topBeam = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.42, 0.6), crossMat);
  topBeam.position.y = 5.6;
  topBeam.castShadow = true;
  const topCap = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.2, 0.8), crossMat);
  topCap.position.y = 5.92;
  const midBeam = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.28, 0.45), pillarMat);
  midBeam.position.y = 4.8;
  midBeam.castShadow = true;
  group.add(pillarL, pillarR, topBeam, topCap, midBeam);
  group.position.copy(position);
  group.rotation.y = rotationY;
  return group;
}

export function createStoneLantern(position: THREE.Vector3) {
  const group = new THREE.Group();
  group.name = "StoneLantern";
  const stoneMat = createToonMaterial({
    color: "#a9a49a",
    shadowColor: "#504c46",
    steps: 3,
    rimStrength: 0.1
  });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 0.28, 8), stoneMat);
  base.position.y = 0.14;
  base.castShadow = true;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.6, 8), stoneMat);
  shaft.position.y = 0.6;
  shaft.castShadow = true;
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.48, 0.44), stoneMat);
  lamp.position.y = 1.14;
  lamp.castShadow = true;
  const glowMat = new THREE.MeshBasicMaterial({ color: "#ffce75", toneMapped: false });
  const glow = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.28), glowMat);
  glow.position.y = 1.14;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.3, 4), stoneMat);
  cap.position.y = 1.52;
  cap.rotation.y = Math.PI / 4;
  cap.castShadow = true;
  group.add(base, shaft, lamp, glow, cap);
  group.position.copy(position);
  return group;
}

export function createBarrier(position: THREE.Vector3, rotationY = 0, width = 3.2) {
  const group = new THREE.Group();
  group.name = "Barrier";
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, 1.2, 0.5), barrierMat());
  body.position.y = 0.6;
  body.castShadow = true;
  body.receiveShadow = true;
  const strip = new THREE.Mesh(new THREE.BoxGeometry(width, 0.1, 0.54), neonAccent(animePalette.neonPink));
  strip.position.y = 1.1;
  const postL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.45, 0.55), createToonMaterial({
    color: "#4a423a",
    shadowColor: "#1e1a15",
    steps: 3,
    rimStrength: 0.08
  }));
  postL.position.set(-width / 2, 0.72, 0);
  postL.castShadow = true;
  const postR = postL.clone();
  postR.position.x = width / 2;
  group.add(body, strip, postL, postR);
  group.position.copy(position);
  group.rotation.y = rotationY;
  return group;
}

export function createCrystalPillar(position: THREE.Vector3, color: THREE.ColorRepresentation = "#39f0ff") {
  const group = new THREE.Group();
  group.name = "CrystalPillar";
  const baseMat = createToonMaterial({
    color: "#22344a",
    shadowColor: "#0d1724",
    steps: 3,
    rimStrength: 0.12
  });
  const coreMat = new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: 0.92 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.9), baseMat);
  base.position.y = 0.15;
  base.castShadow = true;
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), coreMat);
  core.position.y = 1.2;
  core.userData.spin = true;
  core.userData.floatBase = 1.2;
  const capMat = createToonMaterial({
    color: "#3b5b78",
    shadowColor: "#172535",
    steps: 3,
    rimStrength: 0.14
  });
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.4, 6), capMat);
  cap.position.y = 1.9;
  cap.rotation.y = Math.PI / 6;
  cap.castShadow = true;
  group.add(base, core, cap);
  group.position.copy(position);
  return group;
}

export function populateArena(scene: THREE.Scene) {
  const arenaRoot = new THREE.Group();
  arenaRoot.name = "AnimeArena";

  // Entry torii gates — north and south
  arenaRoot.add(createToriiGate(new THREE.Vector3(0, 0, -60), 0));
  arenaRoot.add(createToriiGate(new THREE.Vector3(0, 0, 60), Math.PI));

  // Stone lanterns along road
  const lanternSpots: Array<[number, number]> = [
    [-7, -24], [7, -20], [-7, -4], [7, 0], [-7, 16], [7, 20], [-7, 36], [7, 40],
    [-22, -10], [22, -10], [-22, 24], [22, 24]
  ];
  for (const [x, z] of lanternSpots) {
    arenaRoot.add(createStoneLantern(new THREE.Vector3(x, 0, z)));
  }

  // Cover barriers — scattered near target area for tactical play
  const barrierSpots: Array<[number, number, number, number]> = [
    [-12, -14, 0, 3.2],
    [12, -6, 0.4, 3.2],
    [-14, 10, -0.3, 2.6],
    [14, 14, 0.2, 3.2],
    [-10, 32, 0.5, 2.8],
    [10, 28, -0.2, 3.0]
  ];
  for (const [x, z, rot, w] of barrierSpots) {
    arenaRoot.add(createBarrier(new THREE.Vector3(x, 0, z), rot, w));
  }

  // Crystal pillars (animated, floating) for magical arena accents
  const crystalSpots: Array<[number, number, string]> = [
    [-18, -34, "#ff3e9a"],
    [18, -30, "#39f0ff"],
    [-20, 48, "#ffd95c"],
    [22, 46, "#ff7ed6"]
  ];
  for (const [x, z, color] of crystalSpots) {
    arenaRoot.add(createCrystalPillar(new THREE.Vector3(x, 0, z), color));
  }

  scene.add(arenaRoot);
  return arenaRoot;
}

export function updateArenaProps(scene: THREE.Scene, dt: number, elapsed: number) {
  const root = scene.getObjectByName("AnimeArena");
  if (!root) return;
  root.traverse((child) => {
    if (child.userData?.spin) {
      child.rotation.y += dt * 0.8;
      child.rotation.x = Math.sin(elapsed * 1.4) * 0.12;
      const base = child.userData.floatBase ?? child.position.y;
      child.position.y = base + Math.sin(elapsed * 1.8) * 0.12;
    }
  });
}
