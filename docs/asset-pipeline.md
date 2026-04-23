# Shooter Asset Pipeline

The current prototype intentionally keeps first-person and third-person visuals separate:

- Third-person uses `public/assets/characters/Soldier_Male.gltf` and its native one-handed combat animations.
- First-person uses `public/assets/vendor/fps-rifle-hands/rifle/rifle.glb`.
- Third-person sidearm uses `public/assets/vendor/animated-guns/FPS Pack/OBJ/Pistol.obj`.

## Free Upgrade Path

For a proper rifle-ready third-person character, use a Mixamo-compatible character and animations.

Recommended intake format:

```txt
public/assets/custom/mixamo/
  character.glb
  animations.glb
```

Required animation clips should be named, or easily aliased, to:

```txt
Idle
Run
Sprint
CrouchIdle
CrouchWalk
Shoot_OneHanded or Rifle_Fire
Reload
Jump
GrenadeThrow
Hit
Death
```

After adding files, update:

```txt
src/game/config.ts
```

Specifically:

- `runtimeAssets.player.character`
- `actionClipAliases`
- `thirdPersonWeaponSocket`

## Why Separate FPS/TPS Assets?

FPS games normally use two visual rigs:

- A first-person viewmodel, only arms and weapon, tuned for camera feel.
- A third-person world model, full body, tuned for other players and shadows.

Trying to use one rig for both usually makes either the FPS weapon or third-person pose look wrong.

## Do Not Commit

Large source/reference files should stay local unless they are converted into runtime GLB files:

- raw Mixamo FBX batches
- Rokoko FBX source clips
- Blender source files
- unused Quaternius OBJ/FBX variants
