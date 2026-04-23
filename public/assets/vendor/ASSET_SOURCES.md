# Third-party asset sources

These assets are kept as prototype/vendor assets so they can be replaced without touching the core runtime.

## FPS rifle and hands

- Source: OpenGameArt, "Low Poly FPS Rifle and Hands"
- URL: https://opengameart.org/content/low-poly-fps-rifle-and-hands
- License listed by source: CC0
- Runtime file tracked in repo: `public/assets/vendor/fps-rifle-hands/rifle/rifle.glb`
- Runtime use: first-person weapon/arms placeholder with a `fire` animation.

## Animated guns pack

- Source: Quaternius "Animated Guns Pack" distributed as a CC0 source pack
- URL: https://quaternius.com/packs/animatedguns.html
- License listed by source: CC0
- Runtime files tracked in repo: `public/assets/vendor/animated-guns/FPS Pack/OBJ/Pistol.obj` and `Pistol.mtl`
- Runtime use: third-person pistol source via OBJ/MTL. This should be converted to GLB later for the final web asset pipeline.

## Universal base character

- Source: Quaternius "Universal Base Characters"
- URL: https://quaternius.itch.io/universal-base-characters
- License listed by source: CC0
- Status: downloaded locally as a backup source, but not tracked in repo.
- Runtime use: none. The current playable build uses the existing `public/assets/characters/Soldier_Male.gltf` because it has native game animations and a better shooter silhouette.

## Universal animation library

- Source: Quaternius "Universal Animation Library"
- URL: https://quaternius.com/packs/universalanimationlibrary.html
- License listed by source: CC0
- Status: downloaded locally as a backup source, but not tracked in repo.
- Runtime use: none right now because `Soldier_Male.gltf` already includes native animations.

## Rokoko gun mocap source

- Source: Rokoko "11 Free Gun Animations"
- URL: https://www.rokoko.com/resources/rokoko-mocap-11-free-gun-animations
- Status: downloaded locally as a reference source, but not tracked in repo because the raw FBX set is large.
- Runtime file tracked in repo: `public/assets/custom/mixamo/rifle_light.glb`
- Runtime use: optional experimental rig at `?rig=rokoko`. These are Mixamo-skeleton FBX files, so they still need retarget cleanup before becoming the default third-person player.
