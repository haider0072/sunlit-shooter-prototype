import * as THREE from "three";

// Painterly stylized palette — Summer Afternoon / Messenger vibe.
// Rich colors with soft-saturated warmth, not cel-shaded pastel wash.
export const animePalette = {
  sky: new THREE.Color("#b3dcff"),
  skyHorizon: new THREE.Color("#ffd9b3"),
  skyZenith: new THREE.Color("#7fb8ee"),
  sun: new THREE.Color("#fff2c8"),
  ground: new THREE.Color("#8fc870"),
  groundDark: new THREE.Color("#4f8c55"),
  groundWarm: new THREE.Color("#b6d16a"),
  road: new THREE.Color("#c8c0b0"),
  roadLine: new THREE.Color("#fff3c7"),
  sand: new THREE.Color("#e9d088"),
  sea: new THREE.Color("#68b5d6"),
  seaDeep: new THREE.Color("#407ea4"),
  outline: new THREE.Color("#1b1629"),
  shadow: new THREE.Color("#4a5d78"),
  rim: new THREE.Color("#fff0dd"),
  sakura: new THREE.Color("#f7a8c8"),
  sakuraDark: new THREE.Color("#c06592"),
  treeGreen: new THREE.Color("#589a52"),
  treeGreenDark: new THREE.Color("#2e6838"),
  neonPink: new THREE.Color("#ff3e9a"),
  neonCyan: new THREE.Color("#39f0ff"),
  neonYellow: new THREE.Color("#ffd95c"),
  hitSpark: new THREE.Color("#ffffff"),
  critSpark: new THREE.Color("#ffe14a"),
  enemyRed: new THREE.Color("#ff5577"),
  allyBlue: new THREE.Color("#5ec8ff"),
  cream: new THREE.Color("#fff6e0"),
  ink: new THREE.Color("#2b1a4a"),
  houseWall: new THREE.Color("#f4d9b9"),
  houseRoof: new THREE.Color("#d66858"),
  houseShed: new THREE.Color("#c4a48a"),
  trunk: new THREE.Color("#6b4d32"),
  trunkDark: new THREE.Color("#3d2817")
} as const;

export type AnimePaletteKey = keyof typeof animePalette;
