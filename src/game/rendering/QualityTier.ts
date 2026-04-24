import * as THREE from "three";

export type QualityTier = "low" | "medium" | "high";

export type QualityProfile = {
  tier: QualityTier;
  pixelRatio: number;
  shadowEnabled: boolean;
  shadowMapSize: number;
  postProcessing: boolean;
  bloomEnabled: boolean;
  outlineEnabled: boolean;
  maxProjectiles: number;
  maxEffects: number;
  envDetail: number;
};

export function detectQualityTier(): QualityTier {
  if (typeof window === "undefined") return "medium";
  const override = new URLSearchParams(window.location.search).get("quality");
  if (override === "low" || override === "medium" || override === "high") return override;

  const ua = navigator.userAgent.toLowerCase();
  const mobile = /mobile|android|iphone|ipad/.test(ua);
  const deviceMemory = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 4;

  if (mobile || deviceMemory < 4 || cores < 4) return "low";
  if (deviceMemory >= 8 && cores >= 8) return "high";
  return "medium";
}

export function buildQualityProfile(tier: QualityTier): QualityProfile {
  switch (tier) {
    case "low":
      return {
        tier,
        pixelRatio: 1,
        shadowEnabled: false,
        shadowMapSize: 0,
        postProcessing: false,
        bloomEnabled: false,
        outlineEnabled: false,
        maxProjectiles: 40,
        maxEffects: 20,
        envDetail: 0.5
      };
    case "high":
      return {
        tier,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        shadowEnabled: true,
        shadowMapSize: 2048,
        postProcessing: true,
        bloomEnabled: true,
        outlineEnabled: true,
        maxProjectiles: 160,
        maxEffects: 80,
        envDetail: 1
      };
    case "medium":
    default:
      return {
        tier,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
        shadowEnabled: true,
        shadowMapSize: 1024,
        postProcessing: true,
        bloomEnabled: true,
        outlineEnabled: true,
        maxProjectiles: 80,
        maxEffects: 40,
        envDetail: 0.75
      };
  }
}

export function applyRendererProfile(renderer: THREE.WebGLRenderer, profile: QualityProfile) {
  renderer.setPixelRatio(profile.pixelRatio);
  renderer.shadowMap.enabled = profile.shadowEnabled;
  if (profile.shadowEnabled) {
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
}
