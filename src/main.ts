import "./style.css";
import * as THREE from "three";
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import {
  actionClipAliases,
  cameraTuning,
  fallbackWeaponSocket,
  oneShotActions,
  runtimeAssets,
  thirdPersonWeaponSocket,
  type ActionName
} from "./game/config";

type CameraMode = "third" | "first";

type Target = {
  root: THREE.Group;
  meshes: THREE.Object3D[];
  hp: number;
  maxHp: number;
  wobble: number;
  active: boolean;
};

type Projectile = {
  root: THREE.Group;
  velocity: THREE.Vector3;
  previous: THREE.Vector3;
  life: number;
  distance: number;
  maxDistance: number;
};

type Grenade = {
  root: THREE.Group;
  velocity: THREE.Vector3;
  life: number;
  fuse: number;
  bounces: number;
  exploded: boolean;
};

type AimTrace = {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  point: THREE.Vector3;
  hitObjectName: string | null;
  hitDistance: number | null;
  result: "target" | "ground" | "range";
};

type ShotResult = {
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

type PreShotState = {
  frame: number;
  time: number;
  ammoBefore: number;
  cooldownBefore: number;
  reloadBefore: number;
  statusBefore: string;
};

const projectileTuning = {
  speed: 72,
  maxDistance: 92
};

const rifleTuning = {
  damage: 1,
  range: 96,
  cooldown: 0.105,
  hipSpread: 0.035,
  movingSpread: 0.12,
  recoilPitch: 0.006,
  recoilYaw: 0.004,
  visualRecoilPitch: 0.014,
  visualRecoilYaw: 0.005
};

function requiredElement<T extends HTMLElement>(selector: string) {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing game shell element: ${selector}`);
  return element;
}

const canvas = requiredElement<HTMLCanvasElement>("#game");
const loaderEl = requiredElement<HTMLDivElement>("#loader");
const startButton = requiredElement<HTMLButtonElement>("#startButton");
const scoreEl = requiredElement<HTMLSpanElement>("#score");
const ammoEl = requiredElement<HTMLSpanElement>("#ammo");
const healthEl = requiredElement<HTMLSpanElement>("#health");
const statusEl = requiredElement<HTMLDivElement>("#status");
const objectiveEl = requiredElement<HTMLSpanElement>("#objective");
const crosshairEl = requiredElement<HTMLDivElement>(".crosshair");
const debugPanelEl = requiredElement<HTMLPreElement>("#debugPanel");

const palette = {
  sky: new THREE.Color("#a9def2"),
  sun: new THREE.Color("#fff0c2"),
  grass: new THREE.Color("#8fc999"),
  grassDark: new THREE.Color("#5d9a78"),
  road: new THREE.Color("#b8c5c2"),
  roadLine: new THREE.Color("#fff0c9"),
  sand: new THREE.Color("#ecd59a"),
  sea: new THREE.Color("#5aa7c7"),
  ink: new THREE.Color("#314048"),
  coral: new THREE.Color("#ff705c"),
  teal: new THREE.Color("#2f9c95"),
  cream: new THREE.Color("#fff4dc")
};

function lerpAngle(from: number, to: number, alpha: number) {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * alpha;
}

function rounded(value: number, digits = 3) {
  return Number(value.toFixed(digits));
}

function sampleTrack(track: THREE.KeyframeTrack, time: number) {
  const valueSize = track.getValueSize();
  const times = track.times;
  const values = track.values;
  if (times.length === 0) return new Array(valueSize).fill(0);
  let index = 0;
  while (index < times.length - 1 && times[index + 1] < time) index += 1;
  const nextIndex = Math.min(index + 1, times.length - 1);
  const startTime = times[index];
  const endTime = times[nextIndex];
  const alpha = endTime === startTime ? 0 : THREE.MathUtils.clamp((time - startTime) / (endTime - startTime), 0, 1);
  const startOffset = index * valueSize;
  const endOffset = nextIndex * valueSize;
  if (track instanceof THREE.QuaternionKeyframeTrack && valueSize === 4) {
    const start = new THREE.Quaternion(values[startOffset], values[startOffset + 1], values[startOffset + 2], values[startOffset + 3]);
    const end = new THREE.Quaternion(values[endOffset], values[endOffset + 1], values[endOffset + 2], values[endOffset + 3]);
    start.slerp(end, alpha);
    return [start.x, start.y, start.z, start.w];
  }
  return Array.from({ length: valueSize }, (_, valueIndex) => THREE.MathUtils.lerp(values[startOffset + valueIndex], values[endOffset + valueIndex], alpha));
}

function createStaticPoseClip(name: string, source: THREE.AnimationClip, normalizedTime: number) {
  const poseTime = THREE.MathUtils.clamp(normalizedTime, 0, 1) * source.duration;
  const tracks = source.tracks.map((track) => {
    const poseValues = sampleTrack(track, poseTime);
    const values = [...poseValues, ...poseValues];
    if (track instanceof THREE.QuaternionKeyframeTrack) return new THREE.QuaternionKeyframeTrack(track.name, [0, 1], values);
    if (track instanceof THREE.VectorKeyframeTrack) return new THREE.VectorKeyframeTrack(track.name, [0, 1], values);
    if (track instanceof THREE.ColorKeyframeTrack) return new THREE.ColorKeyframeTrack(track.name, [0, 1], values);
    if (track instanceof THREE.BooleanKeyframeTrack) return new THREE.BooleanKeyframeTrack(track.name, [0, 1], values);
    if (track instanceof THREE.StringKeyframeTrack) return new THREE.StringKeyframeTrack(track.name, [0, 1], values);
    return new THREE.NumberKeyframeTrack(track.name, [0, 1], values);
  });
  return new THREE.AnimationClip(name, 1, tracks);
}

class SunlitPatrol {
  private readonly renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance"
  });

  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(48, 1, 0.1, 220);
  private readonly clock = new THREE.Clock();
  private readonly gltfLoader = new GLTFLoader();
  private readonly mtlLoader = new MTLLoader();
  private readonly objLoader = new OBJLoader();
  private readonly raycaster = new THREE.Raycaster();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.08);
  private readonly keys = new Set<string>();
  private readonly targetByMesh = new Map<THREE.Object3D, Target>();
  private readonly targets: Target[] = [];
  private readonly projectiles: Projectile[] = [];
  private readonly grenades: Grenade[] = [];
  private readonly effects: THREE.Object3D[] = [];
  private readonly tmpVec = new THREE.Vector3();
  private readonly tmpVec2 = new THREE.Vector3();
  private readonly tmpQuat = new THREE.Quaternion();
  private readonly muzzleFlashTexture = this.createMuzzleFlashTexture();
  private readonly smokeTexture = this.createSmokeTexture();
  private readonly player = new THREE.Group();
  private readonly weaponSocket = new THREE.Group();
  private readonly cameraTarget = new THREE.Vector3(0, 1.15, 0);
  private readonly playerVelocity = new THREE.Vector3();

  private mixer: THREE.AnimationMixer | null = null;
  private firstPersonMixer: THREE.AnimationMixer | null = null;
  private firstPersonFireAction: THREE.AnimationAction | null = null;
  private actions = new Map<ActionName, THREE.AnimationAction>();
  private activeAction: ActionName = "Idle";
  private weapon: THREE.Group | null = null;
  private firstPersonRig: THREE.Group | null = null;
  private bulletTemplate: THREE.Group | null = null;
  private grenadeTemplate: THREE.Group | null = null;
  private rightHandBone: THREE.Object3D | null = null;
  private isReady = false;
  private isPointerLocked = false;
  private mouseAimActive = false;
  private isFiring = false;
  private isAimingDownSights = false;
  private jumpAnimTimer = 0;
  private yaw = 0;
  private pitch = -0.08;
  private score = 0;
  private ammo = 12;
  private health = 100;
  private shotCooldown = 0;
  private reloadTimer = 0;
  private nextTargetWave = 0;
  private impactPulse = 0;
  private cameraRecoilPitch = 0;
  private cameraRecoilYaw = 0;
  private weaponKick = 0;
  private weaponKickSide = 0;
  private reloadAnimTimer = 0;
  private grenadeCooldown = 0;
  private grenadeAmmo = 3;
  private crouchBlend = 0;
  private debugEnabled = new URLSearchParams(window.location.search).has("debug");
  private shotSequence = 0;
  private frameSequence = 0;
  private debugLiveTimer = 0;
  private debugHistory: string[] = [];
  private debugEvents: string[] = [];
  private debugShotRecords: unknown[] = [];
  private lastMouseDelta = { x: 0, y: 0, time: 0 };
  private cameraMode: CameraMode = "third";

  constructor() {
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

    this.scene.background = palette.sky;
    this.scene.fog = new THREE.Fog(palette.sky, 46, 142);
    this.camera.position.set(0, 4, 8);

    this.player.name = "Player";
    this.weaponSocket.name = "WeaponSocket";
    this.scene.add(this.player);

    this.setupLights();
    this.createWorld();
    this.bindEvents();
    this.installDebugBridge();
  }

  private createMuzzleFlashTexture() {
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = 128;
    textureCanvas.height = 128;
    const ctx = textureCanvas.getContext("2d");
    if (!ctx) throw new Error("Unable to create muzzle flash texture");

    const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
    gradient.addColorStop(0, "rgba(255,255,245,1)");
    gradient.addColorStop(0.18, "rgba(255,244,190,0.95)");
    gradient.addColorStop(0.42, "rgba(255,142,45,0.55)");
    gradient.addColorStop(0.72, "rgba(255,86,28,0.18)");
    gradient.addColorStop(1, "rgba(255,86,28,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    const streak = ctx.createLinearGradient(0, 64, 128, 64);
    streak.addColorStop(0, "rgba(255,120,35,0)");
    streak.addColorStop(0.32, "rgba(255,188,80,0.55)");
    streak.addColorStop(0.5, "rgba(255,255,230,0.96)");
    streak.addColorStop(0.68, "rgba(255,188,80,0.48)");
    streak.addColorStop(1, "rgba(255,120,35,0)");
    ctx.fillStyle = streak;
    ctx.fillRect(0, 54, 128, 20);

    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private createSmokeTexture() {
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = 96;
    textureCanvas.height = 96;
    const ctx = textureCanvas.getContext("2d");
    if (!ctx) throw new Error("Unable to create smoke texture");
    const gradient = ctx.createRadialGradient(48, 48, 3, 48, 48, 46);
    gradient.addColorStop(0, "rgba(210,205,185,0.34)");
    gradient.addColorStop(0.45, "rgba(150,145,125,0.16)");
    gradient.addColorStop(1, "rgba(100,100,90,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 96, 96);

    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  async init() {
    await this.loadPlayer();
    await this.loadWeaponAndTargets();
    this.isReady = true;
    loaderEl.classList.add("hidden");
    this.setStatus("Range online");
    this.setDebugEnabled(this.debugEnabled);
    this.updateHud();
    this.renderer.setAnimationLoop(() => this.update());
  }

  private setupLights() {
    const hemi = new THREE.HemisphereLight("#bceeff", "#8b8f78", 2.3);
    this.scene.add(hemi);

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
    this.scene.add(sun);
  }

  private createWorld() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 140, 16, 16),
      new THREE.MeshLambertMaterial({ color: palette.grass })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(13, 148),
      new THREE.MeshLambertMaterial({ color: palette.road })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.012;
    road.receiveShadow = true;
    this.scene.add(road);

    for (let z = -64; z <= 64; z += 12) {
      const line = new THREE.Mesh(
        new THREE.PlaneGeometry(0.34, 5.6),
        new THREE.MeshBasicMaterial({ color: palette.roadLine })
      );
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, 0.018, z);
      this.scene.add(line);
    }

    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(44, 140),
      new THREE.MeshLambertMaterial({ color: palette.sand })
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(-48, 0.016, 0);
    this.scene.add(sand);

    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 140, 1, 1),
      new THREE.MeshBasicMaterial({ color: palette.sea, transparent: true, opacity: 0.88 })
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(-82, -0.02, 0);
    this.scene.add(sea);

    this.createTreeInstances();
    this.createHouses();
  }

  private createTreeInstances() {
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

    this.scene.add(trunks, leaves);
  }

  private createHouses() {
    const houseMat = new THREE.MeshLambertMaterial({ color: "#f1d6bd" });
    const roofMat = new THREE.MeshLambertMaterial({ color: "#d56d62" });
    const shadowMat = new THREE.MeshLambertMaterial({ color: "#c7aa92" });

    const spots = [
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
      this.scene.add(group);
    });
  }

  private async loadPlayer() {
    const characterGltf = await this.loadGLTF(runtimeAssets.player.character);
    const animationGltf = characterGltf.animations.length > 0 ? characterGltf : await this.loadGLTF("/assets/vendor/animations/ual1-standard.glb");
    const model = characterGltf.scene;
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const material = mesh.material;
        if (Array.isArray(material)) {
          material.forEach((m) => this.tuneMaterial(m));
        } else {
          this.tuneMaterial(material);
        }
      }
      if (child.name === "Fist.R" || child.name === "FistR" || child.name === "hand_r" || child.name === "RightHand" || child.name === "mixamorigRightHand") {
        this.rightHandBone = child;
      }
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
        const skinned = child as THREE.SkinnedMesh;
        this.rightHandBone =
          skinned.skeleton.bones.find((bone) =>
            ["Fist.R", "FistR", "hand_r", "RightHand", "mixamorigRightHand"].includes(bone.name)
          ) ?? this.rightHandBone;
      }
    });

    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const height = Math.max(size.y, 0.001);
    const scale = 1.86 / height;
    model.scale.setScalar(scale);
    bounds.setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    model.position.sub(center);
    model.position.y -= bounds.min.y - center.y;
    this.player.add(model);
    this.player.position.set(0, 0, -50);

    this.mixer = new THREE.AnimationMixer(model);
    const availableAnimations = [...animationGltf.animations];
    const shootSource = THREE.AnimationClip.findByName(availableAnimations, "Shoot_OneHanded") ?? THREE.AnimationClip.findByName(availableAnimations, "Pistol_Aim_Neutral");
    if (shootSource) {
      availableAnimations.push(createStaticPoseClip("CombatReadyPose", shootSource, 0.42));
    }
    Object.entries(actionClipAliases).forEach(([name, aliases]) => {
      const clip = aliases.map((alias) => THREE.AnimationClip.findByName(availableAnimations, alias)).find(Boolean);
      if (!clip || !this.mixer) return;
      const action = this.mixer.clipAction(clip);
      action.enabled = true;
      action.clampWhenFinished = oneShotActions.has(name as ActionName);
      if (oneShotActions.has(name as ActionName)) action.setLoop(THREE.LoopOnce, 1);
      this.actions.set(name as ActionName, action);
    });
    this.actions.get("Idle")?.play();
  }

  private async loadWeaponAndTargets() {
    const [weaponGltf, bulletGltf, targetLarge, targetSmall, crateMedium, crateWide, grenadeGltf, firstPersonRifle, tacticalRifle] = await Promise.all([
      this.loadGLTF(runtimeAssets.range.blasterFallback),
      this.loadGLTF(runtimeAssets.range.bulletFoam),
      this.loadGLTF(runtimeAssets.range.targetLarge),
      this.loadGLTF(runtimeAssets.range.targetSmall),
      this.loadGLTF(runtimeAssets.range.crateMedium),
      this.loadGLTF(runtimeAssets.range.crateWide),
      this.loadGLTF(runtimeAssets.range.grenade),
      this.loadGLTF(runtimeAssets.firstPerson.rifleHands),
      this.loadOBJWithMtl(
        runtimeAssets.thirdPerson.sidearmObj,
        runtimeAssets.thirdPerson.sidearmMtl
      )
    ]);

    this.weapon = this.prepareThirdPersonWeapon(tacticalRifle, weaponGltf.scene);
    this.weapon.scale.multiplyScalar(this.rightHandBone ? thirdPersonWeaponSocket.scale : fallbackWeaponSocket.scale);
    this.weapon.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        this.tuneMaterial(mesh.material);
      }
    });
    if (this.rightHandBone) {
      this.weaponSocket.position.copy(thirdPersonWeaponSocket.position);
      this.weaponSocket.rotation.copy(thirdPersonWeaponSocket.rotation);
      this.rightHandBone.add(this.weaponSocket);
    } else {
      this.weaponSocket.position.copy(fallbackWeaponSocket.position);
      this.weaponSocket.rotation.copy(fallbackWeaponSocket.rotation);
      this.player.add(this.weaponSocket);
    }
    this.weaponSocket.add(this.weapon);
    this.setupFirstPersonRig(firstPersonRifle);

    this.bulletTemplate = bulletGltf.scene;
    this.bulletTemplate.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = false;
        this.tuneMaterial(mesh.material);
      }
    });

    this.grenadeTemplate = grenadeGltf.scene;
    this.grenadeTemplate.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.tuneMaterial(mesh.material);
      }
    });

    const targetSpawns = [
      [-6, -24, targetLarge, 3],
      [6, -16, targetSmall, 2],
      [-4, 6, targetSmall, 2],
      [5, 20, targetLarge, 3],
      [-7, 38, targetSmall, 2],
      [7, 50, targetLarge, 3]
    ] as const;

    targetSpawns.forEach(([x, z, asset, hp], index) => {
      const root = asset.scene.clone(true);
      root.position.set(x, 0, z);
      root.rotation.y = index % 2 ? -0.25 : 0.25;
      root.scale.setScalar(hp === 3 ? 1.25 : 1);
      const meshes: THREE.Object3D[] = [];
      root.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          this.tuneMaterial(mesh.material);
          meshes.push(mesh);
        }
      });
      const target: Target = { root, meshes, hp, maxHp: hp, wobble: index * 0.7, active: true };
      meshes.forEach((mesh) => this.targetByMesh.set(mesh, target));
      this.targets.push(target);
      this.scene.add(root);
    });

    [
      [-10, -9, crateMedium],
      [10, -2, crateWide],
      [-11, 26, crateWide],
      [11, 34, crateMedium]
    ].forEach(([x, z, asset]) => {
      const crate = (asset as GLTF).scene.clone(true);
      crate.position.set(x as number, 0, z as number);
      crate.rotation.y = Math.random() * Math.PI;
      crate.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          this.tuneMaterial(mesh.material);
        }
      });
      this.scene.add(crate);
    });
  }

  private tuneMaterial(material: THREE.Material | THREE.Material[]) {
    if (Array.isArray(material)) {
      material.forEach((m) => this.tuneMaterial(m));
      return;
    }
    if ("roughness" in material) {
      (material as THREE.MeshStandardMaterial).roughness = 0.78;
    }
    if ("metalness" in material) {
      (material as THREE.MeshStandardMaterial).metalness = 0.04;
    }
  }

  private setupFirstPersonRig(gltf: GLTF) {
    this.firstPersonRig = gltf.scene;
    this.firstPersonRig.name = "FirstPersonRifleHands";
    this.firstPersonRig.position.set(0.72, -0.95, -2.2);
    this.firstPersonRig.rotation.set(THREE.MathUtils.degToRad(1), THREE.MathUtils.degToRad(-6), THREE.MathUtils.degToRad(0));
    this.firstPersonRig.scale.setScalar(0.1);
    this.firstPersonRig.visible = false;
    this.firstPersonRig.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      this.tuneMaterial(mesh.material);
    });
    this.camera.add(this.firstPersonRig);
    this.scene.add(this.camera);

    if (gltf.animations.length > 0) {
      this.firstPersonMixer = new THREE.AnimationMixer(this.firstPersonRig);
      const fireClip = THREE.AnimationClip.findByName(gltf.animations, "fire") ?? gltf.animations[0];
      this.firstPersonFireAction = this.firstPersonMixer.clipAction(fireClip);
      this.firstPersonFireAction.setLoop(THREE.LoopOnce, 1);
      this.firstPersonFireAction.clampWhenFinished = false;
    }
  }

  private prepareThirdPersonWeapon(primary: THREE.Group | null, fallback: THREE.Group) {
    const weapon = (primary ?? fallback).clone(true);
    weapon.name = primary ? "QuaterniusRifle" : "FallbackBlaster";
    const bounds = new THREE.Box3().setFromObject(weapon);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const maxSide = Math.max(size.x, size.y, size.z, 0.001);
    weapon.position.sub(center);
    weapon.scale.setScalar(1 / maxSide);
    weapon.rotation.set(0, 0, 0);
    weapon.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      mesh.castShadow = true;
      this.applyWeaponMaterialPalette(mesh);
      this.tuneMaterial(mesh.material);
    });
    return weapon;
  }

  private applyWeaponMaterialPalette(mesh: THREE.Mesh) {
    const apply = (material: THREE.Material) => {
      if (!("color" in material)) return;
      const named = material as THREE.MeshStandardMaterial | THREE.MeshLambertMaterial | THREE.MeshPhongMaterial;
      const materialName = material.name.toLowerCase();
      if (materialName.includes("wood")) named.color.set(materialName.includes("dark") ? "#5f4030" : "#8e6b4d");
      else if (materialName.includes("metal") || materialName.includes("barrel")) named.color.set("#687076");
      else if (materialName.includes("black") || materialName.includes("trigger")) named.color.set("#182025");
      else if (materialName.includes("bullet")) named.color.set("#d9a646");
      else named.color.set("#3f6f55");
    };
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach(apply);
    else apply(material);
  }

  private loadGLTF(path: string): Promise<GLTF> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(path, resolve, undefined, reject);
    });
  }

  private async loadOBJWithMtl(objPath: string, mtlPath: string): Promise<THREE.Group | null> {
    try {
      const basePath = mtlPath.slice(0, mtlPath.lastIndexOf("/") + 1);
      const mtlFile = mtlPath.slice(mtlPath.lastIndexOf("/") + 1);
      this.mtlLoader.setPath(basePath);
      const materials = await new Promise<MTLLoader.MaterialCreator>((resolve, reject) => {
        this.mtlLoader.load(mtlFile, resolve, undefined, reject);
      });
      materials.preload();
      this.objLoader.setMaterials(materials);
      return await new Promise<THREE.Group>((resolve, reject) => {
        this.objLoader.load(objPath, resolve, undefined, reject);
      });
    } catch (error) {
      console.warn("Falling back to bundled blaster; OBJ weapon failed to load.", error);
      return null;
    }
  }

  private bindEvents() {
    window.addEventListener("resize", () => this.resize());
    this.resize();

    window.addEventListener("keydown", (event) => {
      this.keys.add(event.code);
      if (!event.repeat) this.logDebugEvent("key-down", { code: event.code, keys: this.describeKeys() });
      if (event.code === "KeyR") this.reload();
      if (event.code === "KeyG" && !event.repeat) this.throwGrenade();
      if (event.code === "F3") {
        event.preventDefault();
        this.setDebugEnabled(!this.debugEnabled);
      }
      if (event.code === "KeyV" && !event.repeat) {
        this.toggleCameraMode();
      }
      if (event.code === "Space") {
        event.preventDefault();
        this.jump();
      }
    });
    window.addEventListener("keyup", (event) => {
      this.keys.delete(event.code);
      this.logDebugEvent("key-up", { code: event.code, keys: this.describeKeys() });
    });

    document.addEventListener("pointerlockchange", () => {
      this.isPointerLocked = document.pointerLockElement === canvas;
      startButton.textContent = this.isPointerLocked ? "Live" : "Start";
      if (this.isPointerLocked) this.mouseAimActive = true;
      this.logDebugEvent("pointer-lock", {
        locked: this.isPointerLocked,
        pointerLockElement: document.pointerLockElement === canvas ? "canvas" : document.pointerLockElement?.nodeName ?? null
      });
    });

    window.addEventListener("mousemove", (event) => {
      if (!this.isPointerLocked && !this.mouseAimActive) return;
      this.lastMouseDelta = { x: event.movementX, y: event.movementY, time: rounded(performance.now(), 1) };
      if (this.debugEnabled && (Math.abs(event.movementX) > 8 || Math.abs(event.movementY) > 8)) {
        this.logDebugEvent("mouse-look", {
          dx: event.movementX,
          dy: event.movementY,
          yawDeg: rounded(THREE.MathUtils.radToDeg(this.yaw), 2),
          pitchDeg: rounded(THREE.MathUtils.radToDeg(this.pitch), 2)
        });
      }
      this.applyMouseLook(event.movementX, event.movementY);
    });

    canvas.addEventListener("mousedown", (event) => {
      if (event.button !== 0 || !this.isReady) return;
      this.mouseAimActive = true;
      this.isFiring = true;
      this.logDebugEvent("canvas-fire", { button: event.button, pointerLocked: this.isPointerLocked });
      if (!this.isPointerLocked) {
        this.requestPointerLock();
      }
      this.shoot();
    });
    window.addEventListener("mouseup", (event) => {
      if (event.button === 0) this.isFiring = false;
      if (event.button === 2) this.isAimingDownSights = false;
    });
    canvas.addEventListener("pointerup", (event) => {
      if (event.button === 0) this.isFiring = false;
      if (event.button === 2) this.isAimingDownSights = false;
    });
    canvas.addEventListener("pointercancel", () => {
      this.isFiring = false;
      this.isAimingDownSights = false;
    });
    window.addEventListener("mouseleave", () => {
      this.isFiring = false;
      this.isAimingDownSights = false;
    });

    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== 2 || !this.isReady) return;
      event.preventDefault();
      this.mouseAimActive = true;
      this.isAimingDownSights = true;
      if (!this.isPointerLocked) this.requestPointerLock();
      this.logDebugEvent("ads-start", { pointerLocked: this.isPointerLocked, cameraMode: this.cameraMode });
    });

    startButton.addEventListener("click", () => {
      if (!this.isReady) return;
      this.mouseAimActive = true;
      this.logDebugEvent("start-click", { pointerLocked: this.isPointerLocked });
      this.requestPointerLock();
      this.setStatus("Mouse aim active");
    });

    window.addEventListener("blur", () => {
      this.keys.clear();
      this.isFiring = false;
      this.isAimingDownSights = false;
      this.logDebugEvent("window-blur", { keys: this.describeKeys() });
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.keys.clear();
        this.isFiring = false;
        this.isAimingDownSights = false;
        this.logDebugEvent("document-hidden", { keys: this.describeKeys() });
      }
    });
  }

  private resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private requestPointerLock() {
    try {
      const lock = canvas.requestPointerLock();
      if (lock instanceof Promise) {
        lock.catch(() => undefined);
      }
    } catch {
      // Some automated or embedded browsers reject pointer lock; keyboard controls still work.
    }
  }

  private applyMouseLook(deltaX: number, deltaY: number) {
    this.yaw -= deltaX * 0.0025;
    const minPitch = this.cameraMode === "third" ? cameraTuning.thirdPerson.minPitch : cameraTuning.firstPerson.minPitch;
    const maxPitch = this.cameraMode === "third" ? cameraTuning.thirdPerson.maxPitch : cameraTuning.firstPerson.maxPitch;
    this.pitch = THREE.MathUtils.clamp(this.pitch - deltaY * 0.0017, minPitch, maxPitch);
  }

  private update() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.frameSequence += 1;
    this.debugLiveTimer += dt;
    this.shotCooldown = Math.max(0, this.shotCooldown - dt);
    this.reloadTimer = Math.max(0, this.reloadTimer - dt);
    this.reloadAnimTimer = Math.max(0, this.reloadAnimTimer - dt);
    this.jumpAnimTimer = Math.max(0, this.jumpAnimTimer - dt);
    this.grenadeCooldown = Math.max(0, this.grenadeCooldown - dt);
    this.nextTargetWave = Math.max(0, this.nextTargetWave - dt);
    this.impactPulse = Math.max(0, this.impactPulse - dt * 4);
    this.cameraRecoilPitch = THREE.MathUtils.damp(this.cameraRecoilPitch, 0, 13, dt);
    this.cameraRecoilYaw = THREE.MathUtils.damp(this.cameraRecoilYaw, 0, 16, dt);
    this.weaponKick = THREE.MathUtils.damp(this.weaponKick, 0, 18, dt);
    this.weaponKickSide = THREE.MathUtils.damp(this.weaponKickSide, 0, 14, dt);
    if (this.isFiring) this.shoot();

    this.updatePlayer(dt);
    this.updateWeaponPose(dt);
    this.updateCamera(dt);
    this.updateTargets(dt);
    this.updateProjectiles(dt);
    this.updateGrenades(dt);
    this.updateEffects(dt);
    this.mixer?.update(dt);
    this.firstPersonMixer?.update(dt);
    this.renderer.render(this.scene, this.camera);
    if (this.debugEnabled && this.debugLiveTimer >= 0.25) {
      this.debugLiveTimer = 0;
      this.renderDebugPanel();
    }
  }

  private updatePlayer(dt: number) {
    const forward = Number(this.keys.has("KeyW") || this.keys.has("ArrowUp")) - Number(this.keys.has("KeyS") || this.keys.has("ArrowDown"));
    const strafe = Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) - Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft"));

    if (forward !== 0 || strafe !== 0) {
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      this.tmpVec.set(sin * forward - cos * strafe, 0, cos * forward + sin * strafe).normalize();
      const movingBackward = forward < 0 && strafe === 0;
      const crouching = this.keys.has("KeyC") || this.keys.has("ControlLeft") || this.keys.has("ControlRight");
      const sprinting = !crouching && this.keys.has("ShiftLeft") && forward > 0;
      this.playerVelocity.copy(this.tmpVec).multiplyScalar(crouching ? 2.7 : sprinting ? 9.2 : movingBackward ? 4.6 : 7.4);
    } else {
      this.playerVelocity.multiplyScalar(Math.pow(0.002, dt));
      if (this.playerVelocity.lengthSq() < 0.0001) this.playerVelocity.setScalar(0);
    }

    this.player.position.addScaledVector(this.playerVelocity, dt);
    this.player.position.x = THREE.MathUtils.clamp(this.player.position.x, -14, 14);
    this.player.position.z = THREE.MathUtils.clamp(this.player.position.z, -58, 60);
    this.player.rotation.y = lerpAngle(this.player.rotation.y, this.yaw, 1 - Math.pow(0.001, dt));

    const moving = this.playerVelocity.lengthSq() > 0.4;
    const crouching = this.keys.has("KeyC") || this.keys.has("ControlLeft") || this.keys.has("ControlRight");
    const sprinting = !crouching && this.keys.has("ShiftLeft") && this.keys.has("KeyW");
    this.crouchBlend = THREE.MathUtils.damp(this.crouchBlend, crouching ? 1 : 0, 12, dt);
    this.player.scale.set(1, THREE.MathUtils.lerp(1, 0.82, this.crouchBlend), 1);
    if (this.jumpAnimTimer > 0) return;
    this.fadeTo(crouching ? (moving ? "CrouchWalk" : "CrouchIdle") : sprinting && moving ? "Sprint" : moving ? "Run" : "Idle");
  }

  private updateWeaponPose(dt: number) {
    if (!this.weapon) return;
    const sway = Math.sin(performance.now() * 0.006) * (this.playerVelocity.lengthSq() > 0.4 ? 0.018 : 0.006);
    this.weapon.position.set(-this.weaponKick * 0.08, -0.006 + Math.abs(sway) * 0.28, this.weaponKickSide * 0.05 + sway);
    this.weapon.rotation.set(-this.weaponKick * 0.12, this.weaponKickSide * 0.045, sway * 0.65);
    if (this.firstPersonRig) {
      const moveSway = this.playerVelocity.lengthSq() > 0.4 ? 0.018 : 0.006;
      const fpSwayX = Math.sin(performance.now() * 0.004) * moveSway;
      const fpSwayY = Math.cos(performance.now() * 0.005) * moveSway;
      const ads = this.cameraMode === "first" && this.isAimingDownSights ? 1 : 0;
      const reloadT = this.reloadAnimTimer > 0 ? 1 - Math.abs(this.reloadAnimTimer / 0.8 - 0.5) * 2 : 0;
      const baseX = THREE.MathUtils.lerp(0.72, 0.05, ads);
      const baseY = THREE.MathUtils.lerp(-0.95, -0.66, ads);
      const baseZ = THREE.MathUtils.lerp(-2.2, -1.58, ads);
      this.firstPersonRig.position.set(
        baseX + this.weaponKickSide * 0.03 + fpSwayX * (1 - ads * 0.7) + reloadT * 0.18,
        baseY - this.weaponKick * 0.03 + Math.abs(fpSwayY) - reloadT * 0.28,
        baseZ + this.weaponKick * 0.045 + reloadT * 0.22
      );
      this.firstPersonRig.rotation.set(
        THREE.MathUtils.degToRad(1 - reloadT * 16) - this.weaponKick * 0.03,
        THREE.MathUtils.degToRad(THREE.MathUtils.lerp(-5, -1, ads)) + this.weaponKickSide * 0.035,
        fpSwayX * 1.2 + reloadT * 0.18
      );
    }
    if (dt > 0.045 && this.debugEnabled) {
      this.logDebugEvent("long-frame", { dt: rounded(dt, 4), effects: this.effects.length, projectiles: this.projectiles.length });
    }
  }

  private updateCamera(dt: number) {
    const forward = this.getAimDirection(this.cameraRecoilPitch, this.cameraRecoilYaw);
    const stanceDrop = this.crouchBlend * 0.28;
    if (this.cameraMode === "first") {
      const desired = this.tmpVec.copy(this.player.position).add(new THREE.Vector3(0, cameraTuning.firstPerson.eyeHeight - stanceDrop, 0));
      this.camera.position.lerp(desired, 1 - Math.pow(0.000001, dt));
      this.camera.lookAt(
        this.camera.position.x + forward.x * 10,
        this.camera.position.y + forward.y * 10,
        this.camera.position.z + forward.z * 10
      );
      const targetFov = this.isAimingDownSights ? cameraTuning.firstPerson.adsFov : cameraTuning.firstPerson.hipFov;
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 10, dt);
      this.camera.updateProjectionMatrix();
      return;
    }

    this.cameraTarget.copy(this.player.position).add(new THREE.Vector3(0, cameraTuning.thirdPerson.targetHeight - stanceDrop, 0));
    const distance = cameraTuning.thirdPerson.distance;
    const height = cameraTuning.thirdPerson.height;
    const flatForward = this.tmpVec2.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)).normalize();
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
    const desired = this.tmpVec.set(
      this.cameraTarget.x - flatForward.x * distance,
      this.cameraTarget.y + height,
      this.cameraTarget.z - flatForward.z * distance
    ).addScaledVector(right, cameraTuning.thirdPerson.shoulderOffset);
    this.camera.position.lerp(desired, 1 - Math.pow(0.00002, dt));
    this.camera.lookAt(this.camera.position.clone().addScaledVector(forward, 10));
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 48, 8, dt);
    this.camera.updateProjectionMatrix();
  }

  private updateTargets(dt: number) {
    let activeCount = 0;
    this.targets.forEach((target) => {
      if (!target.active) return;
      activeCount += 1;
      target.wobble += dt;
      target.root.position.y = Math.sin(target.wobble * 2.4) * 0.06;
      target.root.rotation.y += Math.sin(target.wobble) * 0.002;
    });

    if (activeCount === 0 && this.nextTargetWave === 0) {
      this.nextTargetWave = 2.2;
      this.setStatus("Targets reset");
    }

    if (activeCount === 0 && this.nextTargetWave < 0.02) {
      this.targets.forEach((target) => {
        target.active = true;
        target.hp = target.maxHp;
        target.root.visible = true;
        target.root.scale.setScalar(target.maxHp === 3 ? 1.25 : 1);
      });
      this.setStatus("New wave");
    }

    objectiveEl.textContent = `${activeCount} targets`;
  }

  private updateEffects(dt: number) {
    for (let i = this.effects.length - 1; i >= 0; i -= 1) {
      const effect = this.effects[i];
      effect.userData.life -= dt;
      effect.position.addScaledVector(effect.userData.velocity, dt);
      if (effect.userData.spin) {
        effect.rotation.x += effect.userData.spin.x * dt;
        effect.rotation.y += effect.userData.spin.y * dt;
        effect.rotation.z += effect.userData.spin.z * dt;
      }
      if (!effect.userData.noScale) effect.scale.multiplyScalar(1 + dt * 2.5);
      const opacity = Math.max(0, effect.userData.life / effect.userData.maxLife);
      if ((effect as THREE.Sprite).isSprite) {
        const mat = (effect as THREE.Sprite).material as THREE.SpriteMaterial;
        mat.opacity = opacity * (effect.userData.baseOpacity ?? 1);
      } else if ((effect as THREE.Mesh).isMesh) {
        const mat = (effect as THREE.Mesh).material as THREE.MeshBasicMaterial;
        mat.opacity = opacity;
      } else if ((effect as THREE.Light).isLight) {
        (effect as THREE.Light).intensity *= opacity;
      } else {
        effect.traverse((child) => {
          if (!(child as THREE.Mesh).isMesh) return;
          const material = (child as THREE.Mesh).material;
          if (Array.isArray(material)) {
            material.forEach((mat) => {
              if ("opacity" in mat) mat.opacity = opacity;
            });
          } else if ("opacity" in material) {
            material.opacity = opacity;
          }
        });
      }
      if (effect.userData.life <= 0) {
        this.scene.remove(effect);
        if ((effect as THREE.Sprite).isSprite) {
          ((effect as THREE.Sprite).material as THREE.SpriteMaterial).dispose();
          this.effects.splice(i, 1);
          continue;
        }
        effect.traverse((child) => {
          if (!(child as THREE.Mesh).isMesh) return;
          const mesh = child as THREE.Mesh;
          const material = mesh.material;
          if (Array.isArray(material)) {
            material.forEach((mat) => mat.dispose());
          } else {
            material.dispose();
          }
          mesh.geometry.dispose();
        });
        this.effects.splice(i, 1);
      }
    }
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      const projectile = this.projectiles[i];
      projectile.life -= dt;
      projectile.previous.copy(projectile.root.position);
      projectile.root.position.addScaledVector(projectile.velocity, dt);

      const travel = projectile.root.position.distanceTo(projectile.previous);
      projectile.distance += travel;
      if (travel > 0.001) {
        projectile.root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), projectile.velocity.clone().normalize());
      }

      if (projectile.life <= 0 || projectile.distance >= projectile.maxDistance) {
        this.removeProjectile(i);
      }
    }
  }

  private updateGrenades(dt: number) {
    const gravity = new THREE.Vector3(0, -13.5, 0);
    for (let i = this.grenades.length - 1; i >= 0; i -= 1) {
      const grenade = this.grenades[i];
      grenade.life -= dt;
      grenade.fuse -= dt;
      grenade.velocity.addScaledVector(gravity, dt);
      grenade.root.position.addScaledVector(grenade.velocity, dt);
      grenade.root.rotation.x += dt * 9.5;
      grenade.root.rotation.z += dt * 6.2;

      if (grenade.root.position.y <= 0.16) {
        grenade.root.position.y = 0.16;
        if (grenade.velocity.y < 0) {
          grenade.velocity.y *= -0.34;
          grenade.velocity.x *= 0.72;
          grenade.velocity.z *= 0.72;
          grenade.bounces += 1;
          this.spawnGroundDust(grenade.root.position);
          this.logDebugEvent("grenade-bounce", {
            bounces: grenade.bounces,
            position: this.describeVector(grenade.root.position),
            velocity: this.describeVector(grenade.velocity)
          });
        }
      }

      if (!grenade.exploded && (grenade.fuse <= 0 || grenade.life <= 0)) {
        grenade.exploded = true;
        this.explodeGrenade(grenade.root.position.clone());
      }

      if (grenade.exploded || grenade.life <= -0.15) {
        this.scene.remove(grenade.root);
        grenade.root.traverse((child) => {
          if (!(child as THREE.Mesh).isMesh || !child.userData.transientGrenade) return;
          const mesh = child as THREE.Mesh;
          mesh.geometry.dispose();
          const material = mesh.material;
          if (Array.isArray(material)) material.forEach((m) => m.dispose());
          else material.dispose();
        });
        this.grenades.splice(i, 1);
      }
    }
  }

  private throwGrenade() {
    if (this.reloadTimer > 0 || this.grenadeCooldown > 0 || this.grenadeAmmo <= 0 || !this.grenadeTemplate) return;
    this.grenadeAmmo -= 1;
    this.grenadeCooldown = 0.85;
    this.fadeTo("GrenadeThrow", true);
    this.isFiring = false;

    const aim = this.getAimDirection(0.035, 0);
    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).normalize();
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
    const start = this.player.position
      .clone()
      .add(new THREE.Vector3(0, 1.12 - this.crouchBlend * 0.2, 0))
      .addScaledVector(right, 0.38)
      .addScaledVector(forward, 0.56);

    const root = new THREE.Group();
    root.position.copy(start);
    const model = this.grenadeTemplate.clone(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const maxSide = Math.max(size.x, size.y, size.z, 0.001);
    model.position.sub(center);
    model.scale.setScalar(0.22 / maxSide);
    model.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      mesh.geometry = mesh.geometry.clone();
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map((mat) => mat.clone()) : mesh.material.clone();
      mesh.userData.transientGrenade = true;
    });
    root.add(model);

    const velocity = aim.multiplyScalar(14.2).add(new THREE.Vector3(0, 3.4, 0));
    this.grenades.push({ root, velocity, life: 3.2, fuse: 1.45, bounces: 0, exploded: false });
    this.scene.add(root);
    this.setStatus(`Grenade out (${this.grenadeAmmo} left)`);
    this.logDebugEvent("grenade-throw", {
      start: this.describeVector(start),
      velocity: this.describeVector(velocity),
      ammo: this.grenadeAmmo
    });
    this.updateHud();
  }

  private explodeGrenade(position: THREE.Vector3) {
    this.setStatus("Grenade blast");
    this.spawnExplosion(position);
    const blastRadius = 4.4;
    this.targets.forEach((target) => {
      if (!target.active) return;
      const targetPosition = new THREE.Vector3();
      target.root.getWorldPosition(targetPosition);
      const distance = targetPosition.distanceTo(position);
      if (distance > blastRadius) return;
      const damage = distance < 2.1 ? target.maxHp : 1;
      target.hp -= damage;
      this.score += damage * 10;
      target.root.scale.multiplyScalar(0.9);
      this.spawnImpact(targetPosition.add(new THREE.Vector3(0, 0.65, 0)), palette.coral);
      if (target.hp <= 0) {
        target.active = false;
        target.root.visible = false;
        this.score += 40;
      }
    });
    this.cameraRecoilPitch += 0.018;
    this.cameraRecoilYaw += (Math.random() - 0.5) * 0.018;
    this.updateHud();
    this.logDebugEvent("grenade-explode", {
      position: this.describeVector(position),
      activeTargets: this.targets.filter((target) => target.active).length
    });
  }

  private shoot() {
    if (this.reloadTimer > 0 || this.shotCooldown > 0) return;
    if (this.ammo <= 0) {
      this.reload();
      return;
    }

    const preShot = this.capturePreShotState();
    this.ammo -= 1;
    this.shotCooldown = rifleTuning.cooldown;
    this.impactPulse = 1;
    this.fadeTo("Shoot_OneHanded", true);
    this.playFirstPersonFireAnimation();
    this.flashCrosshair();

    const muzzle = this.getMuzzleWorldPosition();
    const shot = this.resolveRifleShot(muzzle);
    const visualMuzzle = this.getVisualMuzzleWorldPosition(shot.direction);
    this.spawnMuzzleBurst(visualMuzzle, shot.direction);
    this.spawnTracer(visualMuzzle, shot.point);
    this.spawnShellEjection(visualMuzzle, shot.direction);
    this.logShotTelemetry(muzzle, visualMuzzle, shot, preShot);
    this.spawnDebugShotMarkers(muzzle, visualMuzzle, shot.point);
    if (shot.target) {
      this.damageTarget(shot.target, shot.point);
    } else {
      this.spawnImpact(shot.point, palette.cream);
      this.setStatus("Range impact");
    }
    this.applyShotRecoil();

    if (this.ammo === 0) this.reload();
    this.updateHud();
  }

  private getMuzzleWorldPosition() {
    if (this.cameraMode === "first") {
      const cameraRay = this.getCameraCenterRay();
      return cameraRay.origin.clone().addScaledVector(cameraRay.direction, 0.82);
    }
    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).normalize();
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
    return this.player.position
      .clone()
      .add(new THREE.Vector3(0, 1.06, 0))
      .addScaledVector(right, 0.62)
      .addScaledVector(forward, 0.48);
  }

  private getVisualMuzzleWorldPosition(direction: THREE.Vector3) {
    if (this.cameraMode === "first") {
      const right = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0));
      if (right.lengthSq() < 0.001) right.set(1, 0, 0);
      right.normalize();
      const up = new THREE.Vector3().crossVectors(right, direction).normalize();
      return this.camera.position
        .clone()
        .addScaledVector(right, 0.46)
        .addScaledVector(up, -0.34)
        .addScaledVector(direction, 1.06);
    }
    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).normalize();
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
    return this.player.position
      .clone()
      .add(new THREE.Vector3(0, 0.98, 0))
      .addScaledVector(right, 0.82)
      .addScaledVector(forward, 0.34)
      .addScaledVector(direction, 0.12);
  }

  private resolveRifleShot(muzzle: THREE.Vector3) {
    const aimTrace = this.getAimTrace(muzzle);
    const aimPoint = aimTrace.point.clone();
    const baseDirection = aimPoint.clone().sub(muzzle);
    if (baseDirection.lengthSq() < 0.01) {
      baseDirection.copy(aimTrace.direction);
    }
    baseDirection.normalize();

    const moving = this.playerVelocity.lengthSq() > 0.35;
    const spread = moving ? rifleTuning.movingSpread : rifleTuning.hipSpread;
    const direction = this.applySpread(baseDirection, spread);
    const origin = muzzle.clone().addScaledVector(direction, 0.2);
    this.raycaster.set(origin, direction);
    this.raycaster.near = 0;
    this.raycaster.far = rifleTuning.range;

    const hit = this.raycaster.intersectObjects(this.getActiveTargetMeshes(), true)[0];
    if (hit) {
      return {
        direction,
        point: hit.point.clone(),
        target: this.findTargetFromObject(hit.object),
        aimPoint: aimPoint.clone(),
        baseDirection: baseDirection.clone(),
        spread,
        moving,
        origin,
        hitObjectName: hit.object.name || hit.object.parent?.name || "unnamed",
        hitDistance: hit.distance,
        groundDistance: null,
        rangeDistance: origin.distanceTo(hit.point),
        result: "target",
        aimTrace
      };
    }

    const groundPoint = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.groundPlane, groundPoint)) {
      const distance = groundPoint.distanceTo(origin);
      if (distance > 0.45 && distance <= rifleTuning.range) {
        return {
          direction,
          point: groundPoint,
          target: undefined,
          aimPoint: aimPoint.clone(),
          baseDirection: baseDirection.clone(),
          spread,
          moving,
          origin,
          hitObjectName: null,
          hitDistance: null,
          groundDistance: distance,
          rangeDistance: distance,
          result: "ground",
          aimTrace
        };
      }
    }

    return {
      direction,
      point: origin.clone().addScaledVector(direction, rifleTuning.range),
      target: undefined,
      aimPoint: aimPoint.clone(),
      baseDirection: baseDirection.clone(),
      spread,
      moving,
      origin,
      hitObjectName: null,
      hitDistance: null,
      groundDistance: null,
      rangeDistance: rifleTuning.range,
      result: "range",
      aimTrace
    };
  }

  private getAimTrace(muzzle: THREE.Vector3): AimTrace {
    const cameraRay = this.getCameraCenterRay();
    const origin = cameraRay.origin;
    const aimDirection = cameraRay.direction;
    this.raycaster.set(origin, aimDirection);
    this.raycaster.near = 0;
    this.raycaster.far = rifleTuning.range;

    const targetHit = this.raycaster.intersectObjects(this.getActiveTargetMeshes(), true)[0];
    if (targetHit) {
      return {
        origin,
        direction: aimDirection,
        point: targetHit.point.clone(),
        hitObjectName: targetHit.object.name || targetHit.object.parent?.name || "unnamed",
        hitDistance: targetHit.distance,
        result: "target"
      };
    }

    const groundPoint = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.groundPlane, groundPoint)) {
      const distance = groundPoint.distanceTo(origin);
      if (distance > 0.45 && distance <= rifleTuning.range) {
        return {
          origin,
          direction: aimDirection,
          point: groundPoint,
          hitObjectName: null,
          hitDistance: distance,
          result: "ground"
        };
      }
    }

    return {
      origin,
      direction: aimDirection,
      point: origin.clone().addScaledVector(aimDirection, rifleTuning.range),
      hitObjectName: null,
      hitDistance: null,
      result: "range"
    };
  }

  private getAimDirection(pitchOffset = 0, yawOffset = 0) {
    const pitchAngle = THREE.MathUtils.clamp((this.pitch + pitchOffset) * 1.65 + 0.06, -0.62, 0.62);
    const yawAngle = this.yaw + yawOffset;
    const horizontal = Math.cos(pitchAngle);
    return new THREE.Vector3(
      Math.sin(yawAngle) * horizontal,
      Math.sin(pitchAngle),
      Math.cos(yawAngle) * horizontal
    ).normalize();
  }

  private applySpread(direction: THREE.Vector3, degrees: number) {
    if (degrees <= 0) return direction.clone();
    const angle = THREE.MathUtils.degToRad(degrees);
    const radius = Math.tan(angle) * Math.sqrt(Math.random());
    const theta = Math.random() * Math.PI * 2;
    const worldUp = Math.abs(direction.y) > 0.96 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(direction, worldUp).normalize();
    const up = new THREE.Vector3().crossVectors(right, direction).normalize();
    return direction
      .clone()
      .addScaledVector(right, Math.cos(theta) * radius)
      .addScaledVector(up, Math.sin(theta) * radius)
      .normalize();
  }

  private applyShotRecoil() {
    this.pitch = THREE.MathUtils.clamp(this.pitch + rifleTuning.recoilPitch * 0.12, -0.48, 0.34);
    this.yaw += (Math.random() - 0.5) * rifleTuning.recoilYaw * 0.2;
    this.cameraRecoilPitch += rifleTuning.visualRecoilPitch;
    this.cameraRecoilYaw += (Math.random() - 0.5) * rifleTuning.visualRecoilYaw;
    this.weaponKick = Math.min(0.42, this.weaponKick + 0.34);
    this.weaponKickSide = THREE.MathUtils.clamp(this.weaponKickSide + (Math.random() - 0.5) * 0.22, -0.28, 0.28);
  }

  private capturePreShotState(): PreShotState {
    return {
      frame: this.frameSequence,
      time: rounded(performance.now(), 1),
      ammoBefore: this.ammo,
      cooldownBefore: rounded(this.shotCooldown, 4),
      reloadBefore: rounded(this.reloadTimer, 4),
      statusBefore: statusEl.textContent || ""
    };
  }

  private installDebugBridge() {
    (globalThis as typeof globalThis & {
      __sunlitDebug?: {
        dump: () => unknown;
        shots: () => unknown[];
        state: () => unknown;
        events: () => string[];
        setDebug: (enabled: boolean) => void;
        fire: () => void;
      };
    }).__sunlitDebug = {
      dump: () => ({
        live: this.getDebugLiveState(),
        shots: this.debugShotRecords,
        events: this.debugEvents
      }),
      shots: () => this.debugShotRecords,
      state: () => this.getDebugLiveState(),
      events: () => this.debugEvents,
      setDebug: (enabled: boolean) => this.setDebugEnabled(enabled),
      fire: () => this.shoot()
    };
  }

  private setDebugEnabled(enabled: boolean) {
    this.debugEnabled = enabled;
    debugPanelEl.classList.toggle("active", enabled);
    debugPanelEl.setAttribute("aria-hidden", enabled ? "false" : "true");
    if (!enabled) {
      debugPanelEl.textContent = "";
      return;
    }
    this.logDebugEvent("debug-enabled", { via: "setDebugEnabled" });
    this.renderDebugPanel();
  }

  private logShotTelemetry(
    muzzle: THREE.Vector3,
    visualMuzzle: THREE.Vector3,
    shot: ShotResult,
    preShot: PreShotState
  ) {
    if (!this.debugEnabled) return;

    this.shotSequence += 1;
    const cameraCenter = this.getCameraCenterRay();
    const aimDirection = shot.aimTrace.direction.clone();
    const centerGround = this.rayGroundPoint(cameraCenter.origin, cameraCenter.direction);
    const centerRange = cameraCenter.origin.clone().addScaledVector(cameraCenter.direction, rifleTuning.range);
    const shotRayMissFromCrosshair = this.distancePointToRay(shot.point, cameraCenter.origin, cameraCenter.direction);
    const muzzleRayMissFromCrosshair = this.distancePointToRay(muzzle, cameraCenter.origin, cameraCenter.direction);
    const frame = {
      shot: this.shotSequence,
      frame: this.frameSequence,
      time: rounded(performance.now(), 1),
      preShot,
      result: shot.result,
      targetActive: Boolean(shot.target?.active),
      targetName: shot.target?.root.name || null,
      hitObjectName: shot.hitObjectName,
      aimTrace: {
        result: shot.aimTrace.result,
        hitObjectName: shot.aimTrace.hitObjectName,
        hitDistance: shot.aimTrace.hitDistance == null ? null : rounded(shot.aimTrace.hitDistance, 3),
        origin: this.describePoint(shot.aimTrace.origin),
        point: this.describePoint(shot.aimTrace.point),
        direction: this.describeVector(shot.aimTrace.direction)
      },
      ammoBeforeShot: preShot.ammoBefore,
      ammoAfterShot: this.ammo,
      score: this.score,
      yawDeg: rounded(THREE.MathUtils.radToDeg(this.yaw), 2),
      pitchDeg: rounded(THREE.MathUtils.radToDeg(this.pitch), 2),
      cameraRecoilPitchDeg: rounded(THREE.MathUtils.radToDeg(this.cameraRecoilPitch), 2),
      cameraRecoilYawDeg: rounded(THREE.MathUtils.radToDeg(this.cameraRecoilYaw), 2),
      pointerLocked: this.isPointerLocked,
      mouseAimActive: this.mouseAimActive,
      ads: this.isAimingDownSights,
      cameraMode: this.cameraMode,
      keys: Array.from(this.keys).sort().join(","),
      moving: shot.moving,
      spreadDeg: rounded(shot.spread, 3),
      velocity: this.describeVector(this.playerVelocity),
      player: this.describeObject(this.player),
      camera: this.describeCamera(),
      cameraCenterRay: {
        origin: this.describePoint(cameraCenter.origin),
        direction: this.describeVector(cameraCenter.direction),
        groundPoint: centerGround,
        rangePoint: this.describePoint(centerRange)
      },
      viewport: this.describeViewport(),
      weaponSocket: this.describeObject(this.weaponSocket),
      rightHand: this.describeObject(this.rightHandBone),
      muzzle: this.describePoint(muzzle),
      visualMuzzle: this.describePoint(visualMuzzle),
      shotOrigin: this.describePoint(shot.origin),
      aimPoint: this.describePoint(shot.aimPoint),
      impactPoint: this.describePoint(shot.point),
      aimDirection: this.describeVector(aimDirection),
      baseDirection: this.describeVector(shot.baseDirection),
      finalDirection: this.describeVector(shot.direction),
      aimVsCameraAngleDeg: rounded(this.angleBetweenDegrees(aimDirection, cameraCenter.direction), 3),
      finalVsCameraAngleDeg: rounded(this.angleBetweenDegrees(shot.direction, cameraCenter.direction), 3),
      finalVsAimAngleDeg: rounded(this.angleBetweenDegrees(shot.direction, aimDirection), 3),
      muzzleToImpact: rounded(muzzle.distanceTo(shot.point), 3),
      visualToImpact: rounded(visualMuzzle.distanceTo(shot.point), 3),
      originToImpact: rounded(shot.origin.distanceTo(shot.point), 3),
      shotPointDistanceFromCrosshairRay: rounded(shotRayMissFromCrosshair, 3),
      muzzleDistanceFromCrosshairRay: rounded(muzzleRayMissFromCrosshair, 3),
      hitDistance: shot.hitDistance == null ? null : rounded(shot.hitDistance, 3),
      groundDistance: shot.groundDistance == null ? null : rounded(shot.groundDistance, 3),
      rangeDistance: rounded(shot.rangeDistance, 3),
      crosshairErrorPx: this.crosshairError(shot.point),
      activeTargets: this.describeActiveTargets(),
      recentEvents: this.debugEvents.slice(0, 8),
      tuning: {
        range: rifleTuning.range,
        cooldown: rifleTuning.cooldown,
        hipSpread: rifleTuning.hipSpread,
        movingSpread: rifleTuning.movingSpread,
        recoilPitch: rifleTuning.recoilPitch,
        recoilYaw: rifleTuning.recoilYaw
      }
    };

    this.debugShotRecords.unshift(frame);
    this.debugShotRecords = this.debugShotRecords.slice(0, 20);
    const title = `[shot ${frame.shot}] ${frame.result} dist=${frame.rangeDistance} spread=${frame.spreadDeg}`;
    console.groupCollapsed(title);
    console.table({
      shot: frame.shot,
      frame: frame.frame,
      result: frame.result,
      ammoBefore: frame.ammoBeforeShot,
      ammoAfterShot: frame.ammoAfterShot,
      yawDeg: frame.yawDeg,
      pitchDeg: frame.pitchDeg,
      moving: String(frame.moving),
      spreadDeg: frame.spreadDeg,
      aimVsCameraAngleDeg: frame.aimVsCameraAngleDeg,
      finalVsCameraAngleDeg: frame.finalVsCameraAngleDeg,
      muzzleWorld: JSON.stringify(frame.muzzle.world),
      muzzleScreen: JSON.stringify(frame.muzzle.screen),
      visualMuzzleWorld: JSON.stringify(frame.visualMuzzle.world),
      visualMuzzleScreen: JSON.stringify(frame.visualMuzzle.screen),
      impactWorld: JSON.stringify(frame.impactPoint.world),
      impactScreen: JSON.stringify(frame.impactPoint.screen),
      crosshairErrorPx: frame.crosshairErrorPx,
      shotPointDistanceFromCrosshairRay: frame.shotPointDistanceFromCrosshairRay,
      finalDirection: JSON.stringify(frame.finalDirection),
      cameraCenterDirection: JSON.stringify(frame.cameraCenterRay.direction),
      cameraPos: JSON.stringify(frame.camera.position),
      cameraForward: JSON.stringify(frame.camera.forward)
    });
    console.log(frame);
    console.log("[shot-debug-json]", JSON.stringify(frame));
    console.groupEnd();

    const line = `${title}
result=${frame.result} hit=${frame.hitObjectName ?? "none"} target=${frame.targetName ?? "none"} ammo=${frame.ammoBeforeShot}->${frame.ammoAfterShot}
yaw=${frame.yawDeg} pitch=${frame.pitchDeg} recoil=(${frame.cameraRecoilPitchDeg}, ${frame.cameraRecoilYawDeg}) keys=${frame.keys || "none"} pointer=${frame.pointerLocked ? "locked" : "free"}
muzzle world=${JSON.stringify(frame.muzzle.world)} screen=${JSON.stringify(frame.muzzle.screen)}
visual world=${JSON.stringify(frame.visualMuzzle.world)} screen=${JSON.stringify(frame.visualMuzzle.screen)}
origin world=${JSON.stringify(frame.shotOrigin.world)} screen=${JSON.stringify(frame.shotOrigin.screen)}
impact world=${JSON.stringify(frame.impactPoint.world)} screen=${JSON.stringify(frame.impactPoint.screen)}
cameraRay=${JSON.stringify(frame.cameraCenterRay.direction)} aimDir=${JSON.stringify(frame.aimDirection)} finalDir=${JSON.stringify(frame.finalDirection)}
angle aim/cam=${frame.aimVsCameraAngleDeg} final/cam=${frame.finalVsCameraAngleDeg} final/aim=${frame.finalVsAimAngleDeg}
dist muzzle=${frame.muzzleToImpact} visual=${frame.visualToImpact} origin=${frame.originToImpact} crosshairErrPx=${frame.crosshairErrorPx} rayMiss=${frame.shotPointDistanceFromCrosshairRay}
camera pos=${JSON.stringify(frame.camera.position)} fwd=${JSON.stringify(frame.camera.forward)}
socket world=${JSON.stringify(frame.weaponSocket?.world ?? null)} hand world=${JSON.stringify(frame.rightHand?.world ?? null)}`;

    this.debugHistory.unshift(line);
    this.debugHistory = this.debugHistory.slice(0, 6);
    this.renderDebugPanel();
  }

  private logDebugEvent(name: string, data: Record<string, unknown> = {}) {
    if (!this.debugEnabled) return;
    const line = `[${rounded(performance.now(), 1)} f${this.frameSequence}] ${name} ${JSON.stringify(data)}`;
    this.debugEvents.unshift(line);
    this.debugEvents = this.debugEvents.slice(0, 40);
    console.debug(`[sunlit-debug:${name}]`, data);
    this.renderDebugPanel();
  }

  private renderDebugPanel() {
    if (!this.debugEnabled) return;
    const live = this.getDebugLiveState();
    const liveText = [
      "LIVE DEBUG (F3 toggle, console: window.__sunlitDebug.dump())",
      `frame=${live.frame} time=${live.time} ready=${live.ready} pointer=${live.pointerLocked ? "locked" : "free"} mouseAim=${live.mouseAimActive}`,
      `cameraMode=${live.cameraMode} activeAction=${live.activeAction}`,
      `keys=${live.keys || "none"} lastMouse=${JSON.stringify(live.lastMouseDelta)} viewport=${JSON.stringify(live.viewport)}`,
      `yaw=${live.yawDeg} pitch=${live.pitchDeg} recoil=(${live.cameraRecoilPitchDeg}, ${live.cameraRecoilYawDeg}) ammo=${live.ammo} cooldown=${live.shotCooldown} reload=${live.reloadTimer}`,
      `player=${JSON.stringify(live.player?.world ?? null)} velocity=${JSON.stringify(live.velocity)} camera=${JSON.stringify(live.camera.position)} fwd=${JSON.stringify(live.camera.forward)}`,
      `cameraRay=${JSON.stringify(live.cameraCenterRay.direction)} shotAim=${JSON.stringify(live.aimDirection)} controlAim=${JSON.stringify(live.cameraControlDirection)} control/cam=${live.controlVsCameraAngleDeg}deg`,
      `muzzle=${JSON.stringify(live.muzzle.world)} screen=${JSON.stringify(live.muzzle.screen)} visual=${JSON.stringify(live.visualMuzzle.world)} screen=${JSON.stringify(live.visualMuzzle.screen)}`,
      `socket=${JSON.stringify(live.weaponSocket?.world ?? null)} hand=${JSON.stringify(live.rightHand?.world ?? null)} targets=${live.activeTargetCount} effects=${live.effects} projectiles=${live.projectiles} grenades=${live.grenades}`
    ].join("\n");
    const eventsText = this.debugEvents.length > 0 ? `RECENT INPUT/EVENTS\n${this.debugEvents.slice(0, 8).join("\n")}` : "RECENT INPUT/EVENTS\nnone";
    const shotsText = this.debugHistory.length > 0 ? `SHOT HISTORY\n${this.debugHistory.join("\n\n")}` : "SHOT HISTORY\nFire a shot for telemetry.";
    debugPanelEl.textContent = `${liveText}\n\n${eventsText}\n\n${shotsText}`;
  }

  private getDebugLiveState() {
    const cameraControlDirection = this.getAimDirection();
    const muzzle = this.getMuzzleWorldPosition();
    const cameraCenterRay = this.getCameraCenterRay();
    const aimDirection = cameraCenterRay.direction.clone();
    const visualMuzzle = this.getVisualMuzzleWorldPosition(aimDirection);
    return {
      frame: this.frameSequence,
      time: rounded(performance.now(), 1),
      ready: this.isReady,
      pointerLocked: this.isPointerLocked,
      mouseAimActive: this.mouseAimActive,
      ads: this.isAimingDownSights,
      cameraMode: this.cameraMode,
      keys: this.describeKeys(),
      lastMouseDelta: this.lastMouseDelta,
      viewport: this.describeViewport(),
      yawDeg: rounded(THREE.MathUtils.radToDeg(this.yaw), 2),
      pitchDeg: rounded(THREE.MathUtils.radToDeg(this.pitch), 2),
      cameraRecoilPitchDeg: rounded(THREE.MathUtils.radToDeg(this.cameraRecoilPitch), 2),
      cameraRecoilYawDeg: rounded(THREE.MathUtils.radToDeg(this.cameraRecoilYaw), 2),
      ammo: this.ammo,
      score: this.score,
      health: this.health,
      shotCooldown: rounded(this.shotCooldown, 4),
      reloadTimer: rounded(this.reloadTimer, 4),
      reloadAnimTimer: rounded(this.reloadAnimTimer, 4),
      grenadeAmmo: this.grenadeAmmo,
      grenadeCooldown: rounded(this.grenadeCooldown, 4),
      status: statusEl.textContent || "",
      activeAction: this.activeAction,
      velocity: this.describeVector(this.playerVelocity),
      player: this.describeObject(this.player),
      camera: this.describeCamera(),
      cameraCenterRay: {
        origin: this.describePoint(cameraCenterRay.origin),
        direction: this.describeVector(cameraCenterRay.direction),
        groundPoint: this.rayGroundPoint(cameraCenterRay.origin, cameraCenterRay.direction)
      },
      aimDirection: this.describeVector(aimDirection),
      cameraControlDirection: this.describeVector(cameraControlDirection),
      aimVsCameraAngleDeg: rounded(this.angleBetweenDegrees(aimDirection, cameraCenterRay.direction), 3),
      controlVsCameraAngleDeg: rounded(this.angleBetweenDegrees(cameraControlDirection, cameraCenterRay.direction), 3),
      muzzle: this.describePoint(muzzle),
      visualMuzzle: this.describePoint(visualMuzzle),
      weaponSocket: this.describeObject(this.weaponSocket),
      rightHand: this.describeObject(this.rightHandBone),
      activeTargetCount: this.targets.filter((target) => target.active).length,
      targets: this.describeActiveTargets(),
      effects: this.effects.length,
      projectiles: this.projectiles.length,
      grenades: this.grenades.length,
      renderer: {
        pixelRatio: rounded(this.renderer.getPixelRatio(), 2),
        calls: this.renderer.info.render.calls,
        triangles: this.renderer.info.render.triangles
      }
    };
  }

  private describeKeys() {
    return Array.from(this.keys).sort().join(",");
  }

  private describeViewport() {
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    return {
      window: [window.innerWidth, window.innerHeight],
      canvas: [canvas.clientWidth, canvas.clientHeight],
      renderer: [rounded(size.x), rounded(size.y)],
      dpr: rounded(window.devicePixelRatio || 1, 2),
      cameraAspect: rounded(this.camera.aspect, 3),
      fov: rounded(this.camera.fov, 2)
    };
  }

  private describeActiveTargets() {
    return this.targets
      .filter((target) => target.active)
      .slice(0, 8)
      .map((target, index) => {
        const world = new THREE.Vector3();
        target.root.getWorldPosition(world);
        return {
          index,
          name: target.root.name || `target-${index}`,
          hp: target.hp,
          maxHp: target.maxHp,
          world: this.describeVector(world),
          screen: this.worldToScreen(world),
          crosshairErrorPx: this.crosshairError(world),
          visible: target.root.visible
        };
      });
  }

  private getCameraCenterRay() {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    return {
      origin: raycaster.ray.origin.clone(),
      direction: raycaster.ray.direction.clone().normalize()
    };
  }

  private rayGroundPoint(origin: THREE.Vector3, direction: THREE.Vector3) {
    const ray = new THREE.Ray(origin, direction);
    const point = new THREE.Vector3();
    return ray.intersectPlane(this.groundPlane, point) ? this.describePoint(point) : null;
  }

  private distancePointToRay(point: THREE.Vector3, origin: THREE.Vector3, direction: THREE.Vector3) {
    const toPoint = point.clone().sub(origin);
    const along = Math.max(0, toPoint.dot(direction));
    const closest = origin.clone().addScaledVector(direction, along);
    return point.distanceTo(closest);
  }

  private angleBetweenDegrees(a: THREE.Vector3, b: THREE.Vector3) {
    const dot = THREE.MathUtils.clamp(a.clone().normalize().dot(b.clone().normalize()), -1, 1);
    return THREE.MathUtils.radToDeg(Math.acos(dot));
  }

  private describeVector(vector: THREE.Vector3) {
    return [rounded(vector.x), rounded(vector.y), rounded(vector.z)];
  }

  private describePoint(point: THREE.Vector3) {
    return {
      world: this.describeVector(point),
      screen: this.worldToScreen(point)
    };
  }

  private describeObject(object: THREE.Object3D | null) {
    if (!object) return null;
    const world = new THREE.Vector3();
    const rotation = new THREE.Euler();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    object.updateWorldMatrix(true, false);
    object.matrixWorld.decompose(world, quaternion, scale);
    rotation.setFromQuaternion(quaternion);
    return {
      name: object.name || "unnamed",
      parent: object.parent?.name || null,
      world: this.describeVector(world),
      rotationDeg: [rounded(THREE.MathUtils.radToDeg(rotation.x), 2), rounded(THREE.MathUtils.radToDeg(rotation.y), 2), rounded(THREE.MathUtils.radToDeg(rotation.z), 2)],
      scale: this.describeVector(scale)
    };
  }

  private describeCamera() {
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    return {
      position: this.describeVector(this.camera.position),
      rotationDeg: [
        rounded(THREE.MathUtils.radToDeg(this.camera.rotation.x), 2),
        rounded(THREE.MathUtils.radToDeg(this.camera.rotation.y), 2),
        rounded(THREE.MathUtils.radToDeg(this.camera.rotation.z), 2)
      ],
      forward: this.describeVector(forward),
      fov: rounded(this.camera.fov, 2)
    };
  }

  private worldToScreen(point: THREE.Vector3) {
    const projected = point.clone().project(this.camera);
    return {
      x: rounded((projected.x * 0.5 + 0.5) * window.innerWidth, 1),
      y: rounded((-projected.y * 0.5 + 0.5) * window.innerHeight, 1),
      ndc: [rounded(projected.x), rounded(projected.y), rounded(projected.z)]
    };
  }

  private crosshairError(point: THREE.Vector3) {
    const screen = this.worldToScreen(point);
    const dx = screen.x - window.innerWidth / 2;
    const dy = screen.y - window.innerHeight / 2;
    return rounded(Math.hypot(dx, dy), 2);
  }

  private spawnDebugShotMarkers(muzzle: THREE.Vector3, visualMuzzle: THREE.Vector3, impact: THREE.Vector3) {
    if (!this.debugEnabled) return;
    [
      { point: muzzle, color: "#2f9c95", size: 0.045 },
      { point: visualMuzzle, color: "#fff4dc", size: 0.055 },
      { point: impact, color: "#ff705c", size: 0.06 }
    ].forEach(({ point, color, size }) => {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(size, 12, 12),
        new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false, transparent: true, opacity: 0.76 })
      );
      marker.renderOrder = 150;
      marker.position.copy(point);
      marker.userData.life = 0.7;
      marker.userData.maxLife = 0.7;
      marker.userData.velocity = new THREE.Vector3(0, 0.025, 0);
      marker.userData.noScale = true;
      this.effects.push(marker);
      this.scene.add(marker);
    });
  }

  private spawnProjectile(position: THREE.Vector3, impact: THREE.Vector3) {
    const shotLine = impact.clone().sub(position);
    const fullDistance = shotLine.length();
    if (fullDistance < 0.05) return;
    const distance = Math.min(fullDistance, projectileTuning.maxDistance);
    const direction = shotLine.normalize();
    const root = new THREE.Group();
    root.position.copy(position);
    root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);

    if (this.bulletTemplate) {
      const bullet = this.bulletTemplate.clone(true);
      const bounds = new THREE.Box3().setFromObject(bullet);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const maxSide = Math.max(size.x, size.y, size.z, 0.001);
      bullet.position.sub(center);
      bullet.scale.setScalar(0.24 / maxSide);
      root.add(bullet);
    }

    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 10, 10),
      new THREE.MeshBasicMaterial({ color: "#fff8d7", transparent: true, opacity: 0.98, depthTest: false })
    );
    body.renderOrder = 104;
    body.userData.transient = true;
    root.add(body);

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 10, 10),
      new THREE.MeshBasicMaterial({ color: palette.coral, transparent: true, opacity: 0.34, depthTest: false, depthWrite: false })
    );
    glow.renderOrder = 103;
    glow.userData.transient = true;
    root.add(glow);

    const trail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.004, 0.82, 6),
      new THREE.MeshBasicMaterial({ color: palette.cream, transparent: true, opacity: 0.48, depthTest: false, depthWrite: false })
    );
    trail.renderOrder = 102;
    trail.position.z = -0.44;
    trail.rotation.x = Math.PI / 2;
    trail.userData.transient = true;
    root.add(trail);

    this.projectiles.push({
      root,
      velocity: direction.clone().multiplyScalar(projectileTuning.speed),
      previous: position.clone(),
      life: distance / projectileTuning.speed,
      distance: 0,
      maxDistance: distance
    });
    this.scene.add(root);
  }

  private removeProjectile(index: number) {
    const [projectile] = this.projectiles.splice(index, 1);
    if (!projectile) return;
    this.scene.remove(projectile.root);
    projectile.root.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh || !child.userData.transient) return;
      const mesh = child as THREE.Mesh;
      mesh.geometry.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) {
        material.forEach((m) => m.dispose());
      } else {
        material.dispose();
      }
    });
  }

  private getActiveTargetMeshes() {
    return Array.from(this.targetByMesh.entries())
      .filter(([, target]) => target.active)
      .map(([mesh]) => mesh);
  }

  private findTargetFromObject(object: THREE.Object3D) {
    let current: THREE.Object3D | null = object;
    while (current) {
      const target = this.targetByMesh.get(current);
      if (target) return target;
      current = current.parent;
    }
    return undefined;
  }

  private damageTarget(target: Target, point: THREE.Vector3) {
    if (!target.active) return;
    target.hp -= rifleTuning.damage;
    this.score += 10;
    target.root.scale.multiplyScalar(0.92);
    this.spawnImpact(point, target.hp <= 0 ? palette.coral : palette.teal);

    if (target.hp <= 0) {
      target.active = false;
      target.root.visible = false;
      this.score += 40;
      this.setStatus("Target down");
    } else {
      this.setStatus("Hit confirmed");
    }
    crosshairEl.classList.remove("hit");
    window.requestAnimationFrame(() => crosshairEl.classList.add("hit"));
    this.updateHud();
  }

  private spawnImpact(position: THREE.Vector3, color: THREE.Color) {
    this.spawnBulletMark(position, color);
    for (let i = 0; i < 7; i += 1) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.026 + i * 0.003, 8, 8),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72 })
      );
      mesh.position.copy(position);
      mesh.userData.life = 0.24 + i * 0.012;
      mesh.userData.maxLife = mesh.userData.life;
      mesh.userData.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 1.8,
        Math.random() * 1.45,
        (Math.random() - 0.5) * 1.8
      );
      this.effects.push(mesh);
      this.scene.add(mesh);
    }
  }

  private spawnGroundDust(position: THREE.Vector3) {
    const dust = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.smokeTexture,
        color: "#9e947d",
        transparent: true,
        opacity: 0.26,
        depthWrite: false
      })
    );
    dust.position.copy(position).add(new THREE.Vector3(0, 0.08, 0));
    dust.scale.setScalar(0.34);
    dust.userData.life = 0.22;
    dust.userData.maxLife = 0.22;
    dust.userData.velocity = new THREE.Vector3(0, 0.18, 0);
    dust.userData.baseOpacity = 0.26;
    this.effects.push(dust);
    this.scene.add(dust);
  }

  private spawnExplosion(position: THREE.Vector3) {
    const flash = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.muzzleFlashTexture,
        color: "#fff2c0",
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 1,
        depthTest: false,
        depthWrite: false
      })
    );
    flash.position.copy(position).add(new THREE.Vector3(0, 0.55, 0));
    flash.scale.set(2.2, 1.5, 1);
    flash.renderOrder = 130;
    flash.userData.life = 0.18;
    flash.userData.maxLife = 0.18;
    flash.userData.velocity = new THREE.Vector3(0, 0.45, 0);
    flash.userData.baseOpacity = 1;
    this.effects.push(flash);
    this.scene.add(flash);

    const light = new THREE.PointLight("#ff8c3a", 8.5, 9);
    light.position.copy(position).add(new THREE.Vector3(0, 0.8, 0));
    light.userData.life = 0.18;
    light.userData.maxLife = 0.18;
    light.userData.velocity = new THREE.Vector3();
    this.effects.push(light);
    this.scene.add(light);

    for (let i = 0; i < 18; i += 1) {
      const angle = (i / 18) * Math.PI * 2;
      const outward = new THREE.Vector3(Math.cos(angle), 0.2 + Math.random() * 0.6, Math.sin(angle)).normalize();
      const ember = new THREE.Mesh(
        new THREE.SphereGeometry(0.035 + Math.random() * 0.025, 8, 8),
        new THREE.MeshBasicMaterial({
          color: i % 3 === 0 ? "#fff2b2" : "#ff7a2e",
          transparent: true,
          opacity: 0.86
        })
      );
      ember.position.copy(position).add(new THREE.Vector3(0, 0.35, 0));
      ember.userData.life = 0.42 + Math.random() * 0.22;
      ember.userData.maxLife = ember.userData.life;
      ember.userData.velocity = outward.multiplyScalar(2.4 + Math.random() * 2.2);
      this.effects.push(ember);
      this.scene.add(ember);
    }

    for (let i = 0; i < 5; i += 1) {
      const smoke = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.smokeTexture,
          color: "#80796b",
          transparent: true,
          opacity: 0.32,
          depthWrite: false
        })
      );
      smoke.position.copy(position).add(new THREE.Vector3((Math.random() - 0.5) * 0.55, 0.35 + Math.random() * 0.35, (Math.random() - 0.5) * 0.55));
      smoke.scale.setScalar(0.62 + Math.random() * 0.42);
      smoke.userData.life = 0.78 + Math.random() * 0.35;
      smoke.userData.maxLife = smoke.userData.life;
      smoke.userData.velocity = new THREE.Vector3((Math.random() - 0.5) * 0.42, 0.62 + Math.random() * 0.42, (Math.random() - 0.5) * 0.42);
      smoke.userData.baseOpacity = 0.32;
      this.effects.push(smoke);
      this.scene.add(smoke);
    }
  }

  private spawnBulletMark(position: THREE.Vector3, color: THREE.Color) {
    const onGround = position.y <= 0.13;
    const normal = onGround ? new THREE.Vector3(0, 1, 0) : this.camera.position.clone().sub(position).normalize();
    const markColor = color.equals(palette.coral) ? "#8d332d" : "#263239";
    const mark = new THREE.Mesh(
      new THREE.CircleGeometry(onGround ? 0.075 : 0.06, 14),
      new THREE.MeshBasicMaterial({
        color: markColor,
        transparent: true,
        opacity: 0.54,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    mark.position.copy(position).addScaledVector(normal, 0.012);
    mark.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    mark.renderOrder = 40;
    mark.userData.life = 4.5;
    mark.userData.maxLife = 4.5;
    mark.userData.velocity = new THREE.Vector3();
    mark.userData.noScale = true;
    this.effects.push(mark);
    this.scene.add(mark);
  }

  private spawnTracer(start: THREE.Vector3, end: THREE.Vector3) {
    const direction = end.clone().sub(start);
    direction.normalize();

    const flash = new THREE.PointLight(palette.coral, 2.8, 4.2);
    flash.position.copy(start);
    flash.userData.life = 0.055;
    flash.userData.maxLife = 0.055;
    flash.userData.velocity = new THREE.Vector3();
    this.effects.push(flash);
    this.scene.add(flash);
  }

  private spawnMuzzleBurst(position: THREE.Vector3, direction: THREE.Vector3) {
    const firstPerson = this.cameraMode === "first";
    const flashPosition = position.clone().addScaledVector(direction, 0.08);
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(firstPerson ? 0.09 : 0.18, firstPerson ? 0.28 : 0.52, 8, 1, true),
      new THREE.MeshBasicMaterial({
        color: "#ff9b3d",
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.86,
        side: THREE.DoubleSide
      })
    );
    flame.renderOrder = 126;
    flame.position.copy(flashPosition).addScaledVector(direction, 0.24);
    flame.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    flame.userData.life = 0.065;
    flame.userData.maxLife = 0.065;
    flame.userData.velocity = direction.clone().multiplyScalar(0.16);
    flame.userData.noScale = true;
    this.effects.push(flame);
    this.scene.add(flame);

    const burst = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.muzzleFlashTexture,
        color: "#fff4dc",
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 1
      })
    );
    burst.renderOrder = 128;
    burst.position.copy(flashPosition);
    burst.scale.set(firstPerson ? 0.22 : 0.54, firstPerson ? 0.12 : 0.28, 1);
    burst.userData.life = 0.075;
    burst.userData.maxLife = 0.075;
    burst.userData.velocity = direction.clone().multiplyScalar(0.12);
    burst.userData.noScale = true;
    this.effects.push(burst);
    this.scene.add(burst);

    const streak = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.muzzleFlashTexture,
        color: "#ff9b3d",
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.62
      })
    );
    streak.renderOrder = 127;
    streak.position.copy(flashPosition).addScaledVector(direction, firstPerson ? 0.18 : 0.32);
    streak.scale.set(firstPerson ? 0.28 : 0.72, firstPerson ? 0.045 : 0.09, 1);
    streak.userData.life = 0.055;
    streak.userData.maxLife = 0.055;
    streak.userData.velocity = direction.clone().multiplyScalar(0.38);
    streak.userData.noScale = true;
    streak.userData.baseOpacity = 0.62;
    this.effects.push(streak);
    this.scene.add(streak);

    for (let i = 0; i < 2; i += 1) {
      const smoke = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.smokeTexture,
          color: "#b8b096",
          depthTest: true,
          depthWrite: false,
          transparent: true,
          opacity: 0.22
        })
      );
      smoke.renderOrder = 25;
      smoke.position.copy(flashPosition).addScaledVector(direction, 0.15 + i * 0.12);
      smoke.scale.setScalar((firstPerson ? 0.12 : 0.22) + i * (firstPerson ? 0.04 : 0.08));
      smoke.userData.life = 0.22 + i * 0.05;
      smoke.userData.maxLife = smoke.userData.life;
      smoke.userData.velocity = direction.clone().multiplyScalar(0.32 + i * 0.18).add(new THREE.Vector3(0, 0.05, 0));
      smoke.userData.baseOpacity = 0.22;
      this.effects.push(smoke);
      this.scene.add(smoke);
    }

    const light = new THREE.PointLight(palette.coral, 3.8, 3.6);
    light.position.copy(flashPosition);
    light.userData.life = 0.065;
    light.userData.maxLife = 0.065;
    light.userData.velocity = new THREE.Vector3();
    this.effects.push(light);
    this.scene.add(light);
  }

  private spawnShellEjection(muzzlePosition: THREE.Vector3, shotDirection: THREE.Vector3) {
    const forward = shotDirection.clone().normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
    if (right.lengthSq() < 0.001) right.set(1, 0, 0);
    right.normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();

    const shell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.08, 8),
      new THREE.MeshStandardMaterial({ color: "#f6d38d", metalness: 0.7, roughness: 0.3 })
    );
    shell.renderOrder = 112;
    shell.position.copy(muzzlePosition).addScaledVector(right, 0.09).addScaledVector(up, -0.02);
    shell.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), right.clone().addScaledVector(up, 0.4).normalize());
    shell.userData.life = 0.58;
    shell.userData.maxLife = 0.58;
    shell.userData.noScale = true;
    shell.userData.velocity = right
      .clone()
      .multiplyScalar(1.8 + Math.random() * 0.6)
      .addScaledVector(up, 1.3 + Math.random() * 0.7)
      .addScaledVector(forward, -0.28);
    shell.userData.spin = new THREE.Vector3(
      14 + Math.random() * 8,
      18 + Math.random() * 8,
      10 + Math.random() * 8
    );
    this.effects.push(shell);
    this.scene.add(shell);
  }

  private reload() {
    if (this.ammo === 12 || this.reloadTimer > 0) return;
    this.reloadTimer = 0.8;
    this.reloadAnimTimer = 0.8;
    this.isFiring = false;
    this.isAimingDownSights = false;
    this.fadeTo("Reload", true);
    window.setTimeout(() => {
      this.ammo = 12;
      this.updateHud();
      this.setStatus("Reloaded");
    }, 800);
    this.setStatus("Reloading");
    this.updateHud();
  }

  private jump() {
    if (this.jumpAnimTimer > 0 || this.reloadTimer > 0) return;
    this.jumpAnimTimer = 0.58;
    this.fadeTo("Jump", true);
    this.setStatus("Jump");
  }

  private toggleCameraMode() {
    this.cameraMode = this.cameraMode === "third" ? "first" : "third";
    if (this.cameraMode === "third") {
      this.pitch = THREE.MathUtils.clamp(this.pitch, cameraTuning.thirdPerson.minPitch, cameraTuning.thirdPerson.maxPitch);
    }
    this.player.visible = this.cameraMode === "third";
    if (this.firstPersonRig) this.firstPersonRig.visible = this.cameraMode === "first";
    this.setStatus(this.cameraMode === "first" ? "First person" : "Third person");
    this.logDebugEvent("camera-mode", { mode: this.cameraMode });
  }

  private playFirstPersonFireAnimation() {
    if (this.cameraMode !== "first" || !this.firstPersonFireAction) return;
    this.firstPersonFireAction.stop();
    this.firstPersonFireAction.reset();
    this.firstPersonFireAction.setEffectiveWeight(1);
    this.firstPersonFireAction.play();
  }

  private flashCrosshair() {
    crosshairEl.classList.remove("flash");
    window.requestAnimationFrame(() => {
      crosshairEl.classList.add("flash");
    });
  }

  private fadeTo(name: ActionName, force = false) {
    const next = this.actions.get(name);
    if (!next || (!force && this.activeAction === name)) return;
    if (force) {
      next.reset().setEffectiveWeight(1).fadeIn(0.04).play();
      window.setTimeout(() => next.fadeOut(0.12), 260);
      return;
    }
    const prev = this.actions.get(this.activeAction);
    next.reset().fadeIn(0.18).play();
    prev?.fadeOut(0.18);
    this.activeAction = name;
  }

  private setStatus(message: string) {
    statusEl.textContent = message;
  }

  private updateHud() {
    scoreEl.textContent = `${this.score}`;
    ammoEl.textContent = this.reloadTimer > 0 ? "..." : `${this.ammo} / 12  G:${this.grenadeAmmo}`;
    healthEl.textContent = `${this.health}`;
  }
}

const game = new SunlitPatrol();
game.init().catch((error) => {
  console.error(error);
  loaderEl.classList.add("hidden");
  statusEl.textContent = "Load failed";
});
