import * as THREE from "three";
import type { ActionName } from "./config";

export class AnimationController {
  private mixer: THREE.AnimationMixer | null = null;
  private readonly actions = new Map<ActionName, THREE.AnimationAction>();
  private activeAction: ActionName = "Idle";
  private readonly pendingFadeOuts = new Map<ActionName, number>();

  setMixer(mixer: THREE.AnimationMixer) {
    this.mixer = mixer;
  }

  setAction(name: ActionName, action: THREE.AnimationAction) {
    this.actions.set(name, action);
  }

  getAction(name: ActionName): THREE.AnimationAction | undefined {
    return this.actions.get(name);
  }

  get active(): ActionName {
    return this.activeAction;
  }

  update(dt: number) {
    this.mixer?.update(dt);
  }

  fadeTo(name: ActionName, force = false) {
    const next = this.actions.get(name);
    if (!next || (!force && this.activeAction === name)) return;
    if (force) {
      const pending = this.pendingFadeOuts.get(name);
      if (pending !== undefined) {
        window.clearTimeout(pending);
        this.pendingFadeOuts.delete(name);
      }
      next.reset().setEffectiveWeight(1).fadeIn(0.04).play();
      const timerId = window.setTimeout(() => {
        next.fadeOut(0.12);
        this.pendingFadeOuts.delete(name);
      }, 260);
      this.pendingFadeOuts.set(name, timerId);
      return;
    }
    const prev = this.actions.get(this.activeAction);
    next.reset().fadeIn(0.18).play();
    prev?.fadeOut(0.18);
    this.activeAction = name;
  }

  dispose() {
    for (const id of this.pendingFadeOuts.values()) window.clearTimeout(id);
    this.pendingFadeOuts.clear();
    this.actions.clear();
    this.mixer = null;
  }
}
