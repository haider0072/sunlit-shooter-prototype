import Peer, { type DataConnection } from "peerjs";
import type { WeaponId } from "../config";

export type PeerStatePayload = {
  type: "state";
  t: number;
  pos: [number, number, number];
  yaw: number;
  pitch: number;
  weaponId: WeaponId;
  health: number;
  sprinting: boolean;
  sliding: boolean;
  crouch: number;
};

export type PeerFirePayload = {
  type: "fire";
  t: number;
  origin: [number, number, number];
  direction: [number, number, number];
  weaponId: WeaponId;
};

export type PeerHitPayload = {
  type: "hit";
  t: number;
  targetId: string;
  damage: number;
  headshot: boolean;
};

export type PeerChatPayload = {
  type: "chat";
  t: number;
  text: string;
};

export type PeerMessage = PeerStatePayload | PeerFirePayload | PeerHitPayload | PeerChatPayload;

export type NetRole = "offline" | "hosting" | "host-ready" | "joining" | "connected";

type Listeners = {
  onRoleChange?: (role: NetRole, info?: { myId?: string; peerId?: string; error?: string }) => void;
  onState?: (peerId: string, state: PeerStatePayload) => void;
  onFire?: (peerId: string, fire: PeerFirePayload) => void;
  onHit?: (peerId: string, hit: PeerHitPayload) => void;
  onChat?: (peerId: string, chat: PeerChatPayload) => void;
  onPeerDisconnect?: (peerId: string) => void;
};

export class NetworkManager {
  private peer: Peer | null = null;
  private connections = new Map<string, DataConnection>();
  private listeners: Listeners = {};
  role: NetRole = "offline";
  myId: string | null = null;

  on(listeners: Listeners) {
    this.listeners = { ...this.listeners, ...listeners };
  }

  async host(): Promise<string> {
    this.dispose();
    return new Promise((resolve, reject) => {
      const peer = new Peer();
      this.peer = peer;
      this.role = "hosting";
      this.listeners.onRoleChange?.("hosting");
      peer.on("open", (id: string) => {
        this.myId = id;
        this.role = "host-ready";
        this.listeners.onRoleChange?.("host-ready", { myId: id });
        resolve(id);
      });
      peer.on("connection", (conn: DataConnection) => this.bindConnection(conn));
      peer.on("error", (err: Error) => {
        this.listeners.onRoleChange?.("offline", { error: err.message });
        reject(err);
      });
    });
  }

  async join(hostId: string): Promise<void> {
    this.dispose();
    return new Promise((resolve, reject) => {
      const peer = new Peer();
      this.peer = peer;
      this.role = "joining";
      this.listeners.onRoleChange?.("joining", { peerId: hostId });
      peer.on("open", (id: string) => {
        this.myId = id;
        const conn = peer.connect(hostId, { reliable: false, serialization: "json" });
        conn.on("open", () => {
          this.bindConnection(conn);
          this.role = "connected";
          this.listeners.onRoleChange?.("connected", { myId: id, peerId: hostId });
          resolve();
        });
        conn.on("error", (err: Error) => reject(err));
      });
      peer.on("error", (err: Error) => {
        this.listeners.onRoleChange?.("offline", { error: err.message });
        reject(err);
      });
    });
  }

  private bindConnection(conn: DataConnection) {
    this.connections.set(conn.peer, conn);
    if (this.role === "host-ready") {
      this.role = "connected";
      this.listeners.onRoleChange?.("connected", { myId: this.myId ?? undefined, peerId: conn.peer });
    }
    conn.on("data", (data: unknown) => {
      const message = data as PeerMessage;
      if (!message || typeof message !== "object") return;
      switch (message.type) {
        case "state":
          this.listeners.onState?.(conn.peer, message);
          break;
        case "fire":
          this.listeners.onFire?.(conn.peer, message);
          break;
        case "hit":
          this.listeners.onHit?.(conn.peer, message);
          break;
        case "chat":
          this.listeners.onChat?.(conn.peer, message);
          break;
      }
    });
    conn.on("close", () => {
      this.connections.delete(conn.peer);
      this.listeners.onPeerDisconnect?.(conn.peer);
    });
  }

  broadcast(message: PeerMessage) {
    for (const conn of this.connections.values()) {
      if (conn.open) {
        try {
          conn.send(message);
        } catch {
          // Ignore transient send failures.
        }
      }
    }
  }

  peerIds(): string[] {
    return Array.from(this.connections.keys());
  }

  dispose() {
    for (const conn of this.connections.values()) {
      try {
        conn.close();
      } catch {
        // Ignore close errors.
      }
    }
    this.connections.clear();
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        // Ignore destroy errors.
      }
    }
    this.peer = null;
    this.myId = null;
    this.role = "offline";
  }
}
