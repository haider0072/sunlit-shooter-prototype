import * as THREE from "three";

export type OutlineOptions = {
  color?: THREE.ColorRepresentation;
  thickness?: number;
};

export function createOutlineMaterial(options: OutlineOptions = {}) {
  const { color = "#11131c", thickness = 0.018 } = options;
  return new THREE.ShaderMaterial({
    uniforms: {
      uOutlineColor: { value: new THREE.Color(color) },
      uThickness: { value: thickness }
    },
    vertexShader: /* glsl */ `
      uniform float uThickness;
      void main() {
        vec3 inflated = position + normal * uThickness;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(inflated, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uOutlineColor;
      void main() {
        gl_FragColor = vec4(uOutlineColor, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: true,
    depthTest: true
  });
}

export function addOutlinePass(root: THREE.Object3D, options: OutlineOptions = {}) {
  const outlineMat = createOutlineMaterial(options);
  const outlineRoot = new THREE.Group();
  outlineRoot.name = "__OutlineRoot";
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (mesh.userData.skipOutline) return;
    const shell = new THREE.Mesh(mesh.geometry, outlineMat);
    shell.castShadow = false;
    shell.receiveShadow = false;
    shell.renderOrder = (mesh.renderOrder ?? 0) - 1;
    mesh.add(shell);
  });
  return outlineRoot;
}
