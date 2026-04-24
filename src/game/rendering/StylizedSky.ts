import * as THREE from "three";
import { animePalette } from "../anime/palette";

export function createStylizedSky() {
  const geo = new THREE.SphereGeometry(260, 32, 18);
  geo.scale(-1, 1, 1);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uZenith: { value: animePalette.skyZenith.clone() },
      uMid: { value: animePalette.sky.clone() },
      uHorizon: { value: animePalette.skyHorizon.clone() },
      uGround: { value: animePalette.shadow.clone().multiplyScalar(0.4) }
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith;
      uniform vec3 uMid;
      uniform vec3 uHorizon;
      uniform vec3 uGround;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y;
        vec3 upper = mix(uMid, uZenith, smoothstep(0.15, 0.7, h));
        vec3 color = mix(uHorizon, upper, smoothstep(-0.02, 0.18, h));
        color = mix(uGround, color, smoothstep(-0.35, -0.02, h));
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.name = "StylizedSky";
  sky.renderOrder = -1000;
  return sky;
}
