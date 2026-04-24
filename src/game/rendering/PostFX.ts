import * as THREE from "three";
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  VignetteEffect,
  KernelSize
} from "postprocessing";
import type { QualityProfile } from "./QualityTier";

export class PostFX {
  private composer: EffectComposer | null = null;
  private enabled: boolean;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    profile: QualityProfile
  ) {
    this.enabled = profile.postProcessing;
    if (!this.enabled) return;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    const bloom = new BloomEffect({
      intensity: 0.22,
      luminanceThreshold: 0.88,
      luminanceSmoothing: 0.1,
      kernelSize: KernelSize.MEDIUM,
      mipmapBlur: true
    });
    const vignette = new VignetteEffect({
      darkness: 0.28,
      offset: 0.38
    });
    this.composer.addPass(new EffectPass(camera, bloom, vignette));
  }

  setSize(width: number, height: number) {
    this.composer?.setSize(width, height);
  }

  render(dt: number) {
    if (!this.composer) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.composer.render(dt);
  }

  isEnabled() {
    return this.enabled && this.composer !== null;
  }

  dispose() {
    this.composer?.dispose();
    this.composer = null;
  }
}
