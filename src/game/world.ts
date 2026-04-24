import * as THREE from "three";
import { animePalette } from "./anime/palette";
import { createToonMaterial } from "./rendering/ToonMaterial";

export function setupLights(scene: THREE.Scene) {
  const hemi = new THREE.HemisphereLight("#cfe8ff", "#6b7a5a", 0.9);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(animePalette.sun, 2.0);
  sun.position.set(-18, 28, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 90;
  sun.shadow.camera.left = -42;
  sun.shadow.camera.right = 42;
  sun.shadow.camera.top = 42;
  sun.shadow.camera.bottom = -42;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.05;
  scene.add(sun);

  const fill = new THREE.DirectionalLight("#ffb894", 0.35);
  fill.position.set(14, 10, -20);
  scene.add(fill);
}

export function createWorld(scene: THREE.Scene) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160, 32, 32),
    createToonMaterial({
      color: animePalette.ground,
      shadowColor: animePalette.groundDark,
      steps: 4,
      rimStrength: 0.1
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Warm dirt patches near road for variety
  for (let i = 0; i < 8; i += 1) {
    const patch = new THREE.Mesh(
      new THREE.CircleGeometry(3 + Math.random() * 2, 10),
      createToonMaterial({
        color: animePalette.groundWarm,
        shadowColor: animePalette.groundDark,
        steps: 3,
        rimStrength: 0
      })
    );
    patch.rotation.x = -Math.PI / 2;
    patch.position.set((Math.random() - 0.5) * 90, 0.008, (Math.random() - 0.5) * 100);
    patch.receiveShadow = true;
    scene.add(patch);
  }

  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(13, 160),
    createToonMaterial({
      color: animePalette.road,
      shadowColor: "#8a7d72",
      steps: 3,
      rimStrength: 0
    })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.012;
  road.receiveShadow = true;
  scene.add(road);

  for (let z = -72; z <= 72; z += 10) {
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(0.34, 5.6),
      new THREE.MeshBasicMaterial({ color: animePalette.roadLine })
    );
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.018, z);
    scene.add(line);
  }

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(44, 160),
    createToonMaterial({
      color: animePalette.sand,
      shadowColor: "#b3924e",
      steps: 3,
      rimStrength: 0
    })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(-48, 0.016, 0);
  scene.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 160, 1, 1),
    createToonMaterial({
      color: animePalette.sea,
      shadowColor: animePalette.seaDeep,
      steps: 3,
      rimColor: "#ffffff",
      rimStrength: 0.5,
      rimWidth: 0.6
    })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(-82, -0.02, 0);
  scene.add(sea);

  createTreeInstances(scene);
  createHouses(scene);
  createBushes(scene);
  createSakuraDrifts(scene);
  createGrassTufts(scene);
}

function createTreeInstances(scene: THREE.Scene) {
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.2, 1.4, 6);
  const leafGeoBig = new THREE.ConeGeometry(0.95, 2.0, 7);
  const leafGeoSmall = new THREE.ConeGeometry(0.7, 1.5, 6);

  const trunkMat = createToonMaterial({
    color: animePalette.trunk,
    shadowColor: animePalette.trunkDark,
    steps: 3,
    rimStrength: 0.08
  });
  const greenMat = createToonMaterial({
    color: animePalette.treeGreen,
    shadowColor: animePalette.treeGreenDark,
    steps: 4,
    rimColor: "#d9f4a5",
    rimStrength: 0.15
  });
  const sakuraMat = createToonMaterial({
    color: animePalette.sakura,
    shadowColor: animePalette.sakuraDark,
    steps: 4,
    rimColor: "#ffe8f4",
    rimStrength: 0.2
  });

  const positions: Array<[number, number]> = [
    [-20, -38], [-24, -26], [-19, -9], [-23, 12], [-18, 32], [-27, 47],
    [17, -45], [25, -35], [20, -19], [26, 7], [21, 26], [29, 41],
    [39, -49], [44, -32], [38, -6], [45, 18], [40, 36], [47, 53],
    [-42, -44], [-54, -28], [-39, -13], [-57, 4], [-42, 23], [-55, 42],
    [59, -38], [62, -17], [58, 6], [64, 29], [56, 50], [-7, -54],
    [7, -58], [-9, 56], [8, 60], [34, -58], [-34, 58], [52, -2],
    [-62, -2], [32, 4], [-33, -4], [13, 48], [-13, -48], [4, 30]
  ];

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, positions.length);
  const greenLeaves = new THREE.InstancedMesh(leafGeoBig, greenMat, positions.length);
  const sakuraLeaves = new THREE.InstancedMesh(leafGeoSmall, sakuraMat, positions.length);
  trunks.castShadow = true;
  greenLeaves.castShadow = true;
  sakuraLeaves.castShadow = true;

  const matrix = new THREE.Matrix4();
  const zero = new THREE.Quaternion();
  let greenCount = 0;
  let sakuraCount = 0;

  positions.forEach(([x, z], index) => {
    const scale = 0.78 + ((index * 19) % 9) * 0.06;
    const isSakura = index % 5 === 0; // ~20% sakura for accent
    matrix.compose(
      new THREE.Vector3(x, 0.7 * scale, z),
      zero,
      new THREE.Vector3(scale, scale, scale)
    );
    trunks.setMatrixAt(index, matrix);

    const leafHeight = isSakura ? 1.6 * scale : 1.95 * scale;
    matrix.compose(
      new THREE.Vector3(x, leafHeight, z),
      zero,
      new THREE.Vector3(scale, scale, scale)
    );
    if (isSakura) {
      sakuraLeaves.setMatrixAt(sakuraCount, matrix);
      sakuraCount += 1;
    } else {
      greenLeaves.setMatrixAt(greenCount, matrix);
      greenCount += 1;
    }
  });

  greenLeaves.count = greenCount;
  sakuraLeaves.count = sakuraCount;
  trunks.instanceMatrix.needsUpdate = true;
  greenLeaves.instanceMatrix.needsUpdate = true;
  sakuraLeaves.instanceMatrix.needsUpdate = true;

  scene.add(trunks, greenLeaves, sakuraLeaves);
}

function createHouses(scene: THREE.Scene) {
  const houseMat = createToonMaterial({
    color: animePalette.houseWall,
    shadowColor: "#b89779",
    steps: 4,
    rimStrength: 0.12
  });
  const roofMat = createToonMaterial({
    color: animePalette.houseRoof,
    shadowColor: "#9b3e34",
    steps: 4,
    rimStrength: 0.15
  });
  const shedMat = createToonMaterial({
    color: animePalette.houseShed,
    shadowColor: "#8a6d53",
    steps: 3,
    rimStrength: 0.08
  });

  const spots: Array<[number, number, number]> = [
    [16, -56, 0.12],
    [32, -23, -0.06],
    [22, 55, 0.16],
    [-35, -58, -0.12],
    [-33, 34, 0.08]
  ];

  spots.forEach(([x, z, rot], index) => {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(5.8, 3.1, 4.4), houseMat);
    body.position.y = 1.55;
    body.castShadow = true;
    body.receiveShadow = true;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.5, 2.2, 4), roofMat);
    roof.position.y = 4.2;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    roof.receiveShadow = true;
    const shed = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.1, 3), shedMat);
    shed.position.set(index % 2 ? -4 : 4, 1.05, 0.5);
    shed.castShadow = true;
    shed.receiveShadow = true;
    group.add(body, roof, shed);
    group.position.set(x, 0, z);
    group.rotation.y = rot;
    scene.add(group);
  });
}

function createBushes(scene: THREE.Scene) {
  const bushGeo = new THREE.IcosahedronGeometry(0.5, 0);
  const bushMat = createToonMaterial({
    color: animePalette.treeGreen,
    shadowColor: animePalette.treeGreenDark,
    steps: 3,
    rimColor: "#e8fab8",
    rimStrength: 0.15
  });
  const spots: Array<[number, number, number]> = [
    [-9, -40, 0.9], [9, -32, 0.7], [-11, -10, 1.1], [12, 5, 0.8],
    [-8, 18, 0.9], [10, 28, 1.0], [-12, 44, 0.7], [14, 52, 1.2],
    [18, -10, 0.8], [-16, 22, 0.9], [28, -40, 1.0], [-28, 16, 1.1],
    [36, 12, 0.85], [-38, -20, 0.95]
  ];
  spots.forEach(([x, z, scale]) => {
    const bush = new THREE.Mesh(bushGeo, bushMat);
    bush.position.set(x, scale * 0.45, z);
    bush.scale.setScalar(scale);
    bush.rotation.y = Math.random() * Math.PI;
    bush.castShadow = true;
    bush.receiveShadow = true;
    scene.add(bush);
  });
}

function createGrassTufts(scene: THREE.Scene) {
  const tuftGeo = new THREE.ConeGeometry(0.08, 0.3, 4);
  const tuftMat = createToonMaterial({
    color: animePalette.treeGreen,
    shadowColor: animePalette.treeGreenDark,
    steps: 3,
    rimStrength: 0.1
  });
  const count = 220;
  const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, count);
  const matrix = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let i = 0; i < count; i += 1) {
    const x = (Math.random() - 0.5) * 140;
    const z = (Math.random() - 0.5) * 140;
    if (Math.abs(x) < 8) continue; // skip road
    const s = 0.7 + Math.random() * 0.8;
    q.setFromEuler(new THREE.Euler(0, Math.random() * Math.PI, 0));
    matrix.compose(new THREE.Vector3(x, 0.14 * s, z), q, new THREE.Vector3(s, s, s));
    tufts.setMatrixAt(i, matrix);
  }
  tufts.instanceMatrix.needsUpdate = true;
  scene.add(tufts);
}

function createSakuraDrifts(scene: THREE.Scene) {
  const petalGeo = new THREE.PlaneGeometry(0.14, 0.14);
  const petalMat = new THREE.MeshBasicMaterial({
    color: animePalette.sakura,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const count = 90;
  const petals = new THREE.InstancedMesh(petalGeo, petalMat, count);
  petals.name = "SakuraDrift";
  petals.userData.driftSeeds = [] as Array<{ x: number; z: number; phase: number; speed: number; height: number }>;
  const matrix = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < count; i += 1) {
    const seed = {
      x: (Math.random() - 0.5) * 100,
      z: (Math.random() - 0.5) * 100,
      phase: Math.random() * Math.PI * 2,
      speed: 0.6 + Math.random() * 1.0,
      height: 2 + Math.random() * 8
    };
    petals.userData.driftSeeds.push(seed);
    pos.set(seed.x, seed.height, seed.z);
    q.setFromEuler(new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI));
    matrix.compose(pos, q, scale);
    petals.setMatrixAt(i, matrix);
  }
  petals.instanceMatrix.needsUpdate = true;
  scene.add(petals);
}

export function updateSakuraDrifts(scene: THREE.Scene, dt: number, elapsed: number) {
  const petals = scene.getObjectByName("SakuraDrift") as THREE.InstancedMesh | undefined;
  if (!petals) return;
  const seeds = petals.userData.driftSeeds as Array<{ x: number; z: number; phase: number; speed: number; height: number }>;
  const matrix = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < seeds.length; i += 1) {
    const s = seeds[i];
    s.phase += dt * s.speed;
    s.height -= dt * 0.65;
    if (s.height < 0.2) {
      s.height = 8 + Math.random() * 4;
      s.x = (Math.random() - 0.5) * 100;
      s.z = (Math.random() - 0.5) * 100;
    }
    pos.set(s.x + Math.sin(s.phase) * 1.1, s.height, s.z + Math.cos(s.phase * 0.8) * 1.0);
    q.setFromEuler(new THREE.Euler(s.phase, elapsed + i, s.phase * 0.4));
    matrix.compose(pos, q, scale);
    petals.setMatrixAt(i, matrix);
  }
  petals.instanceMatrix.needsUpdate = true;
}
