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

## Local Rokoko Rifle Prototype

This repo also supports an experimental converted Rokoko/Mixamo rifle mocap character:

```txt
public/assets/custom/mixamo/rifle_light.glb
```

Run it with:

```txt
http://localhost:5173/?debug=1&rig=rokoko
```

This is not the default player yet. It is a reference/prototype rig for testing whether Mixamo-style full-body rifle mocap is worth promoting into the main character controller.

The conversion script is:

```txt
tools/convert_fbx_to_glb.py
```

Example:

```txt
"/Applications/Blender.app/Contents/MacOS/Blender" --background --python tools/convert_fbx_to_glb.py -- --input "public/assets/vendor/rokoko-gun-animations/Guns/Rifle_Light_mixamo.fbx" --output "public/assets/custom/mixamo/rifle_light.glb"
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
