import * as THREE from "three";

export type ActionName =
  | "Idle"
  | "Run"
  | "Sprint"
  | "CrouchIdle"
  | "CrouchWalk"
  | "Shoot_OneHanded"
  | "Reload"
  | "Jump"
  | "GrenadeThrow"
  | "Hit"
  | "Death";

export const runtimeAssets = {
  player: {
    character: "/assets/characters/Soldier_Male.gltf",
    rokokoRiflePrototype: "/assets/custom/mixamo/rifle_light.glb"
  },
  range: {
    blasterFallback: "/assets/blaster/blaster.glb",
    bulletFoam: "/assets/blaster/bullet-foam.glb",
    targetLarge: "/assets/blaster/target-large.glb",
    targetSmall: "/assets/blaster/target-small.glb",
    crateMedium: "/assets/blaster/crate-medium.glb",
    crateWide: "/assets/blaster/crate-wide.glb",
    grenade: "/assets/blaster/grenade-a.glb"
  },
  firstPerson: {
    rifleHands: "/assets/vendor/fps-rifle-hands/rifle/rifle.glb"
  },
  thirdPerson: {
    sidearmObj: "/assets/vendor/animated-guns/FPS Pack/OBJ/Pistol.obj",
    sidearmMtl: "/assets/vendor/animated-guns/FPS Pack/OBJ/Pistol.mtl"
  }
} as const;

export const actionClipAliases: Record<ActionName, string[]> = {
  Idle: ["CombatReadyPose", "Pistol_Aim_Neutral", "Pistol_Idle_Loop", "Idle_Loop", "Idle"],
  Run: ["Run_Carry", "Run", "Jog_Fwd_Loop", "Walk_Loop", "Walk"],
  Sprint: ["Run", "Sprint_Loop", "Run_Carry"],
  CrouchIdle: ["CombatReadyPose", "Crouch_Idle_Loop", "Idle"],
  CrouchWalk: ["Crouch_Fwd_Loop", "Walk_Carry", "Walk", "Run_Carry"],
  Shoot_OneHanded: ["Shoot_OneHanded", "Pistol_Shoot"],
  Reload: ["PickUp", "Pistol_Reload"],
  Jump: ["Jump", "Jump_Start", "Jump_Loop"],
  GrenadeThrow: ["PickUp", "Throw", "Punch"],
  Hit: ["RecieveHit", "ReceiveHit", "Hit_Front"],
  Death: ["Death", "Defeat"]
};

export const rokokoRifleActionClipAliases: Record<ActionName, string[]> = {
  Idle: ["CombatReadyPose"],
  Run: ["CombatReadyPose"],
  Sprint: ["CombatReadyPose"],
  CrouchIdle: ["CombatReadyPose"],
  CrouchWalk: ["CombatReadyPose"],
  Shoot_OneHanded: ["mixamorig:Reference|clip|Base_Layer"],
  Reload: ["mixamorig:Reference|clip|Base_Layer"],
  Jump: ["mixamorig:Reference|clip|Base_Layer"],
  GrenadeThrow: ["mixamorig:Reference|clip|Base_Layer"],
  Hit: ["mixamorig:Reference|clip|Base_Layer"],
  Death: ["mixamorig:Reference|clip|Base_Layer"]
};

export const oneShotActions = new Set<ActionName>(["Shoot_OneHanded", "Reload", "Jump", "GrenadeThrow", "Hit", "Death"]);

export const thirdPersonWeaponSocket = {
  position: new THREE.Vector3(0.02, -0.09, -0.05),
  rotation: new THREE.Euler(THREE.MathUtils.degToRad(-8), THREE.MathUtils.degToRad(-92), THREE.MathUtils.degToRad(12)),
  scale: 0.54
};

export const fallbackWeaponSocket = {
  position: new THREE.Vector3(-0.42, 0.84, 0.34),
  rotation: new THREE.Euler(0.08, -Math.PI * 0.5, -0.05),
  scale: 0.86
};

export const projectileTuning = {
  speed: 72,
  maxDistance: 92
} as const;

export const rifleTuning = {
  damage: 1,
  range: 96,
  cooldown: 0.105,
  hipSpread: 0.035,
  movingSpread: 0.12,
  recoilPitch: 0.006,
  recoilYaw: 0.004,
  visualRecoilPitch: 0.014,
  visualRecoilYaw: 0.005
} as const;

export type WeaponId = "rifle" | "pistol" | "smg";

export type WeaponTuning = {
  id: WeaponId;
  displayName: string;
  damage: number;
  range: number;
  cooldown: number;
  hipSpread: number;
  movingSpread: number;
  recoilPitch: number;
  recoilYaw: number;
  visualRecoilPitch: number;
  visualRecoilYaw: number;
  magSize: number;
  reloadTime: number;
  tint: string;
};

export const weaponLoadout: Record<WeaponId, WeaponTuning> = {
  rifle: {
    id: "rifle",
    displayName: "Sakura Rifle",
    damage: 1,
    range: 96,
    cooldown: 0.105,
    hipSpread: 0.035,
    movingSpread: 0.12,
    recoilPitch: 0.006,
    recoilYaw: 0.004,
    visualRecoilPitch: 0.014,
    visualRecoilYaw: 0.005,
    magSize: 12,
    reloadTime: 0.8,
    tint: "#3f6f55"
  },
  pistol: {
    id: "pistol",
    displayName: "Neon Sidearm",
    damage: 2,
    range: 72,
    cooldown: 0.18,
    hipSpread: 0.028,
    movingSpread: 0.08,
    recoilPitch: 0.012,
    recoilYaw: 0.008,
    visualRecoilPitch: 0.022,
    visualRecoilYaw: 0.008,
    magSize: 8,
    reloadTime: 0.65,
    tint: "#ff3e9a"
  },
  smg: {
    id: "smg",
    displayName: "Rush SMG",
    damage: 1,
    range: 52,
    cooldown: 0.065,
    hipSpread: 0.06,
    movingSpread: 0.14,
    recoilPitch: 0.004,
    recoilYaw: 0.005,
    visualRecoilPitch: 0.01,
    visualRecoilYaw: 0.006,
    magSize: 24,
    reloadTime: 0.95,
    tint: "#39f0ff"
  }
};

export const cameraTuning = {
  thirdPerson: {
    minPitch: -0.2,
    maxPitch: 0.22,
    distance: 6.35,
    height: 2.35,
    shoulderOffset: 0.82,
    targetHeight: 1.38
  },
  firstPerson: {
    minPitch: -0.5,
    maxPitch: 0.36,
    eyeHeight: 1.48,
    hipFov: 58,
    adsFov: 43
  }
} as const;
