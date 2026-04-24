import * as THREE from "three";

function makeCloudShadowTexture(size = 1024) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 80; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 80 + Math.random() * 220;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(20, 30, 50, 0.22)");
    g.addColorStop(0.4, "rgba(20, 30, 50, 0.12)");
    g.addColorStop(1, "rgba(20, 30, 50, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Warm dappled highlights
  for (let i = 0; i < 40; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 60 + Math.random() * 180;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(255, 230, 180, 0.14)");
    g.addColorStop(1, "rgba(255, 230, 180, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createGroundOverlay(scene: THREE.Scene) {
  const mat = new THREE.MeshBasicMaterial({
    map: makeCloudShadowTexture(),
    transparent: true,
    opacity: 0.85,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.014;
  mesh.renderOrder = 1;
  mesh.name = "GroundOverlay";
  scene.add(mesh);
  return mesh;
}

export function createContactShadow(): THREE.Sprite {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(20, 12, 40, 0.55)");
  grad.addColorStop(0.5, "rgba(20, 12, 40, 0.22)");
  grad.addColorStop(1, "rgba(20, 12, 40, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.4, 1.4, 1);
  sprite.center.set(0.5, 0.5);
  sprite.renderOrder = 2;
  return sprite;
}
