import * as THREE from "three";
import { palette } from "./palette";

export function setupLights(scene: THREE.Scene) {
  const hemi = new THREE.HemisphereLight("#bceeff", "#8b8f78", 2.3);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(palette.sun, 3.2);
  sun.position.set(-18, 28, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 90;
  sun.shadow.camera.left = -42;
  sun.shadow.camera.right = 42;
  sun.shadow.camera.top = 42;
  sun.shadow.camera.bottom = -42;
  scene.add(sun);
}

export function createWorld(scene: THREE.Scene) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 140, 16, 16),
    new THREE.MeshLambertMaterial({ color: palette.grass })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(13, 148),
    new THREE.MeshLambertMaterial({ color: palette.road })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.012;
  road.receiveShadow = true;
  scene.add(road);

  for (let z = -64; z <= 64; z += 12) {
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(0.34, 5.6),
      new THREE.MeshBasicMaterial({ color: palette.roadLine })
    );
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.018, z);
    scene.add(line);
  }

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(44, 140),
    new THREE.MeshLambertMaterial({ color: palette.sand })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(-48, 0.016, 0);
  scene.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 140, 1, 1),
    new THREE.MeshBasicMaterial({ color: palette.sea, transparent: true, opacity: 0.88 })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(-82, -0.02, 0);
  scene.add(sea);

  createTreeInstances(scene);
  createHouses(scene);
}

function createTreeInstances(scene: THREE.Scene) {
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.16, 1.4, 6);
  const leafGeo = new THREE.ConeGeometry(0.82, 1.8, 7);
  const trunkMat = new THREE.MeshLambertMaterial({ color: "#7b674b" });
  const leafMat = new THREE.MeshLambertMaterial({ color: palette.grassDark });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, 42);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, 42);
  trunks.castShadow = true;
  leaves.castShadow = true;

  const matrix = new THREE.Matrix4();
  const positions = [
    [-20, -38], [-24, -26], [-19, -9], [-23, 12], [-18, 32], [-27, 47],
    [17, -45], [25, -35], [20, -19], [26, 7], [21, 26], [29, 41],
    [39, -49], [44, -32], [38, -6], [45, 18], [40, 36], [47, 53],
    [-42, -44], [-54, -28], [-39, -13], [-57, 4], [-42, 23], [-55, 42],
    [59, -38], [62, -17], [58, 6], [64, 29], [56, 50], [-7, -54],
    [7, -58], [-9, 56], [8, 60], [34, -58], [-34, 58], [52, -2],
    [-62, -2], [32, 4], [-33, -4], [13, 48], [-13, -48], [4, 30]
  ];

  positions.forEach(([x, z], index) => {
    const scale = 0.78 + ((index * 19) % 9) * 0.045;
    matrix.compose(
      new THREE.Vector3(x, 0.7 * scale, z),
      new THREE.Quaternion(),
      new THREE.Vector3(scale, scale, scale)
    );
    trunks.setMatrixAt(index, matrix);
    matrix.compose(
      new THREE.Vector3(x, 1.8 * scale, z),
      new THREE.Quaternion(),
      new THREE.Vector3(scale, scale, scale)
    );
    leaves.setMatrixAt(index, matrix);
  });

  scene.add(trunks, leaves);
}

function createHouses(scene: THREE.Scene) {
  const houseMat = new THREE.MeshLambertMaterial({ color: "#f1d6bd" });
  const roofMat = new THREE.MeshLambertMaterial({ color: "#d56d62" });
  const shadowMat = new THREE.MeshLambertMaterial({ color: "#c7aa92" });

  const spots: Array<[number, number, number]> = [
    [16, -56, 0.12],
    [32, -23, -0.06],
    [22, 55, 0.16],
    [-35, -58, -0.12],
    [-33, 34, 0.08]
  ];

  spots.forEach(([x, z, rot], index) => {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(5.8, 3.1, 4.4), houseMat.clone());
    body.position.y = 1.55;
    body.castShadow = true;
    body.receiveShadow = true;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.5, 2.2, 4), roofMat.clone());
    roof.position.y = 4.2;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    const shed = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.1, 3), shadowMat);
    shed.position.set(index % 2 ? -4 : 4, 1.05, 0.5);
    shed.castShadow = true;
    group.add(body, roof, shed);
    group.position.set(x, 0, z);
    group.rotation.y = rot;
    scene.add(group);
  });
}
