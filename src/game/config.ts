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
