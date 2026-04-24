import * as THREE from "three";

export type ToonOptions = {
  color?: THREE.ColorRepresentation;
  shadowColor?: THREE.ColorRepresentation;
  steps?: number;
  rimColor?: THREE.ColorRepresentation;
  rimStrength?: number;
  rimWidth?: number;
  map?: THREE.Texture | null;
  specular?: boolean;
};

export function createToonMaterial(options: ToonOptions = {}) {
  const {
    color = "#ffffff",
    shadowColor = "#6a7a8c",
    steps = 4,
    rimColor = "#fff1d8",
    rimStrength = 0.18,
    rimWidth = 0.38,
    map = null,
    specular = false
  } = options;

  const materialParams: THREE.MeshStandardMaterialParameters = {
    color: new THREE.Color(color),
    roughness: 1,
    metalness: 0
  };
  if (map) materialParams.map = map;
  const material = new THREE.MeshStandardMaterial(materialParams);

  const uniforms = {
    uSteps: { value: steps },
    uShadowColor: { value: new THREE.Color(shadowColor) },
    uRimColor: { value: new THREE.Color(rimColor) },
    uRimStrength: { value: rimStrength },
    uRimWidth: { value: rimWidth },
    uSpecular: { value: specular ? 1 : 0 }
  };

  material.userData.toonUniforms = uniforms;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSteps = uniforms.uSteps;
    shader.uniforms.uShadowColor = uniforms.uShadowColor;
    shader.uniforms.uRimColor = uniforms.uRimColor;
    shader.uniforms.uRimStrength = uniforms.uRimStrength;
    shader.uniforms.uRimWidth = uniforms.uRimWidth;
    shader.uniforms.uSpecular = uniforms.uSpecular;

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vToonNormal;
        varying vec3 vToonView;
        varying vec3 vToonWorldPos;`
      )
      .replace(
        "#include <fog_vertex>",
        `#include <fog_vertex>
        vToonNormal = normalize(normalMatrix * objectNormal);
        vec4 toonWorld = modelMatrix * vec4(transformed, 1.0);
        vToonWorldPos = toonWorld.xyz;
        vToonView = normalize(cameraPosition - toonWorld.xyz);`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uSteps;
        uniform vec3 uShadowColor;
        uniform vec3 uRimColor;
        uniform float uRimStrength;
        uniform float uRimWidth;
        uniform float uSpecular;
        varying vec3 vToonNormal;
        varying vec3 vToonView;
        varying vec3 vToonWorldPos;`
      )
      .replace(
        "#include <tonemapping_fragment>",
        `
        // Cel band: quantize light intensity BEFORE tonemapping so pipeline handles sRGB conversion.
        vec3 toonNormal = normalize(vToonNormal);
        vec3 toonView = normalize(vToonView);

        #if NUM_DIR_LIGHTS > 0
          vec3 toonLightDir = normalize(directionalLights[0].direction);
        #else
          vec3 toonLightDir = normalize(vec3(-0.4, 1.0, 0.5));
        #endif

        float ndl = clamp(dot(toonNormal, toonLightDir), 0.0, 1.0);
        float wrap = ndl * 0.65 + 0.35;
        float stepsSafe = max(uSteps, 2.0);
        float band = floor(wrap * stepsSafe) / (stepsSafe - 1.0);
        // Soften band edges so colors stay vibrant (painterly, not hard cel)
        float stepped = mix(wrap, band, 0.55);
        stepped = clamp(stepped, 0.35, 1.0);

        vec3 baseAlbedo = diffuseColor.rgb;
        vec3 shadowBlend = mix(uShadowColor, baseAlbedo, 0.55);
        vec3 toonLit = mix(shadowBlend * baseAlbedo, baseAlbedo, stepped);

        float rim = 1.0 - max(dot(toonView, toonNormal), 0.0);
        rim = smoothstep(1.0 - uRimWidth, 1.0, rim);
        float rimGate = smoothstep(0.25, 0.85, stepped);
        vec3 rimGlow = uRimColor * rim * uRimStrength * rimGate;

        vec3 spec = vec3(0.0);
        if (uSpecular > 0.5) {
          vec3 halfDir = normalize(toonLightDir + toonView);
          float specAngle = max(dot(toonNormal, halfDir), 0.0);
          float specStep = step(0.85, pow(specAngle, 32.0));
          spec = vec3(specStep * 0.35) * rimGate;
        }

        gl_FragColor = vec4(toonLit + rimGlow + spec, diffuseColor.a);
        #include <tonemapping_fragment>
        `
      );
  };

  return material;
}

export function applyToonToObject(root: THREE.Object3D, options: ToonOptions = {}) {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const existing = mesh.material;
    const getMap = (mat: THREE.Material): THREE.Texture | null => {
      if ("map" in mat && (mat as THREE.MeshStandardMaterial).map) {
        return (mat as THREE.MeshStandardMaterial).map ?? null;
      }
      return null;
    };
    const getColor = (mat: THREE.Material): THREE.ColorRepresentation => {
      if ("color" in mat) {
        return (mat as THREE.MeshStandardMaterial).color.clone();
      }
      return options.color ?? "#ffffff";
    };
    if (Array.isArray(existing)) {
      mesh.material = existing.map((mat) =>
        createToonMaterial({ ...options, map: getMap(mat), color: getColor(mat) })
      );
    } else if (existing) {
      mesh.material = createToonMaterial({
        ...options,
        map: getMap(existing),
        color: getColor(existing)
      });
    }
  });
}
