import * as THREE from "three";
import { Enemy, enemyArchetypes, type EnemyType } from "./Enemy";

export type WaveConfig = {
  waveNumber: number;
  spawns: Array<{ type: EnemyType; count: number }>;
  label: string;
};

export type EnemyKillInfo = {
  enemy: Enemy;
  headshot: boolean;
  scoreAwarded: number;
};

export class EnemyManager {
  private readonly enemies: Enemy[] = [];
  private waveNumber = 0;
  private betweenWaveTimer = 0;
  private currentWaveLabel = "Range calm";
  private kills = 0;
  private waveSpawnQueue: Array<{ type: EnemyType; at: number }> = [];
  private waveStartTime = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly getElapsed: () => number,
    private readonly getPlayerPosition: () => THREE.Vector3
  ) {}

  get activeEnemies(): Enemy[] {
    return this.enemies.filter((e) => e.alive);
  }

  get allEnemies(): Enemy[] {
    return this.enemies;
  }

  get currentWave(): number {
    return this.waveNumber;
  }

  get waveLabel(): string {
    return this.currentWaveLabel;
  }

  get totalKills(): number {
    return this.kills;
  }

  get isInBreak(): boolean {
    return this.betweenWaveTimer > 0 && this.activeEnemies.length === 0 && this.waveSpawnQueue.length === 0;
  }

  get nextWaveSecs(): number {
    return Math.max(0, this.betweenWaveTimer);
  }

  scheduleFirstWave(delay = 2.0) {
    this.betweenWaveTimer = delay;
  }

  update(dt: number): Array<{ enemy: Enemy; fireDirection: THREE.Vector3 }> {
    const playerPos = this.getPlayerPosition();
    const elapsed = this.getElapsed();
    const fireEvents: Array<{ enemy: Enemy; fireDirection: THREE.Vector3 }> = [];

    // Spawn queued enemies
    while (this.waveSpawnQueue.length > 0 && this.waveSpawnQueue[0].at <= elapsed) {
      const next = this.waveSpawnQueue.shift()!;
      this.spawnEnemy(next.type);
    }

    // Update active enemies
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const result = enemy.update(dt, playerPos, elapsed);
      if (result.fireDirection) {
        fireEvents.push({ enemy, fireDirection: result.fireDirection });
      }
    }

    // Check wave completion
    const active = this.activeEnemies.length;
    const queued = this.waveSpawnQueue.length;
    if (active === 0 && queued === 0) {
      if (this.betweenWaveTimer > 0) {
        this.betweenWaveTimer -= dt;
        if (this.betweenWaveTimer <= 0) {
          this.startNextWave();
        }
      } else if (this.waveNumber > 0) {
        // Wave finished — start break
        this.betweenWaveTimer = 3.5;
        this.currentWaveLabel = `Wave ${this.waveNumber} cleared — next in...`;
      }
    }

    return fireEvents;
  }

  private startNextWave() {
    this.waveNumber += 1;
    this.waveStartTime = this.getElapsed();
    const waveConfig = this.buildWave(this.waveNumber);
    this.currentWaveLabel = waveConfig.label;
    // Stagger spawns over ~4 seconds
    const total = waveConfig.spawns.reduce((sum, s) => sum + s.count, 0);
    const spread = Math.max(0.6, Math.min(4.5, total * 0.45));
    let spawnIndex = 0;
    for (const spawn of waveConfig.spawns) {
      for (let i = 0; i < spawn.count; i += 1) {
        const at = this.waveStartTime + (total > 1 ? (spawnIndex / (total - 1)) * spread : 0);
        this.waveSpawnQueue.push({ type: spawn.type, at });
        spawnIndex += 1;
      }
    }
    this.betweenWaveTimer = 0;
  }

  private buildWave(n: number): WaveConfig {
    if (n === 1) {
      return { waveNumber: n, label: "Wave 1 — recon", spawns: [{ type: "rusher", count: 3 }] };
    }
    if (n === 2) {
      return {
        waveNumber: n,
        label: "Wave 2 — probe",
        spawns: [{ type: "rusher", count: 3 }, { type: "shooter", count: 1 }]
      };
    }
    if (n === 3) {
      return {
        waveNumber: n,
        label: "Wave 3 — assault",
        spawns: [{ type: "rusher", count: 4 }, { type: "shooter", count: 2 }]
      };
    }
    if (n === 4) {
      return {
        waveNumber: n,
        label: "Wave 4 — armor",
        spawns: [{ type: "rusher", count: 3 }, { type: "shooter", count: 2 }, { type: "heavy", count: 1 }]
      };
    }
    // Scale beyond 4
    const extra = n - 4;
    return {
      waveNumber: n,
      label: `Wave ${n} — onslaught`,
      spawns: [
        { type: "rusher", count: 4 + Math.floor(extra * 1.4) },
        { type: "shooter", count: 2 + Math.floor(extra * 0.8) },
        { type: "heavy", count: 1 + Math.floor(extra * 0.5) }
      ]
    };
  }

  private spawnEnemy(type: EnemyType) {
    const playerPos = this.getPlayerPosition();
    // Spawn around a ring of radius 25-34 around player, avoiding road for variety
    const angle = Math.random() * Math.PI * 2;
    const radius = 26 + Math.random() * 8;
    const sx = playerPos.x + Math.cos(angle) * radius;
    const sz = playerPos.z + Math.sin(angle) * radius;
    const spawn = new THREE.Vector3(
      THREE.MathUtils.clamp(sx, -62, 62),
      0,
      THREE.MathUtils.clamp(sz, -62, 62)
    );
    const enemy = new Enemy(type, spawn);
    this.enemies.push(enemy);
    this.scene.add(enemy.group);
  }

  registerKill(enemy: Enemy): EnemyKillInfo {
    this.kills += 1;
    return {
      enemy,
      headshot: false,
      scoreAwarded: enemy.archetype.scoreValue
    };
  }

  raycastHit(raycaster: THREE.Raycaster): {
    enemy: Enemy;
    hitPoint: THREE.Vector3;
    headshot: boolean;
    distance: number;
  } | null {
    const meshes: THREE.Object3D[] = [];
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      enemy.group.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) meshes.push(child);
      });
    }
    if (meshes.length === 0) return null;
    const intersections = raycaster.intersectObjects(meshes, false);
    if (intersections.length === 0) return null;
    const hit = intersections[0];
    // Find which enemy owns this mesh
    let owner: Enemy | null = null;
    let hitObject: THREE.Object3D | null = hit.object;
    while (hitObject && !owner) {
      for (const enemy of this.enemies) {
        if (enemy.group === hitObject) {
          owner = enemy;
          break;
        }
      }
      hitObject = hitObject.parent;
    }
    if (!owner) return null;
    const headshot = hit.object.userData?.isHead === true;
    return { enemy: owner, hitPoint: hit.point.clone(), headshot, distance: hit.distance };
  }

  removeEnemy(enemy: Enemy) {
    const idx = this.enemies.indexOf(enemy);
    if (idx >= 0) this.enemies.splice(idx, 1);
    this.scene.remove(enemy.group);
    enemy.group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      }
    });
  }

  reset() {
    for (const enemy of [...this.enemies]) this.removeEnemy(enemy);
    this.enemies.length = 0;
    this.waveSpawnQueue.length = 0;
    this.waveNumber = 0;
    this.betweenWaveTimer = 0;
    this.kills = 0;
    this.currentWaveLabel = "Range calm";
  }
}

void enemyArchetypes;
