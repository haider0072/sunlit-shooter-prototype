import Peer, { type DataConnection } from "peerjs";
import type { WeaponId } from "../config";

// PeerJS config: private Railway signaling server by default.
// Override via URL params: ?peer=host-without-scheme&peerPath=/peerjs&peerSecure=1
const DEFAULT_PEER_HOST = "sunlit-shooter-prototype-production.up.railway.app";
const DEFAULT_PEER_PATH = "/peerjs";

function resolvePeerOptions() {
  const base: Record<string, unknown> = {
    debug: 1,
    host: DEFAULT_PEER_HOST,
    path: DEFAULT_PEER_PATH,
    secure: true,
    config: {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:global.stun.twilio.com:3478" }
      ]
    }
  };
  if (typeof window === "undefined") return base;
  const params = new URLSearchParams(window.location.search);
  const host = params.get("peer");
  if (host) {
    base.host = host;
    base.path = params.get("peerPath") ?? "/peerjs";
    const secureParam = params.get("peerSecure");
    const port = params.get("peerPort");
    if (port) base.port = Number(port);
    if (secureParam === "0") base.secure = false;
    else base.secure = true;
  }
  return base;
}
const PEER_OPTIONS = resolvePeerOptions();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

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

function friendlyError(err: Error): string {
  const m = err.message || `${err}`;
  if (/network|websocket|unavailable|disconnected/i.test(m)) {
    return "Matchmaking server is unreachable. Try again, switch Wi-Fi, or ask your friend to host instead.";
  }
  if (/peer-unavailable|could not connect/i.test(m)) {
    return "That room code is invalid or the host left. Ask for a fresh code.";
  }
  if (/not respond/i.test(m)) {
    return "Connection timed out. Check the code and that the host hasn't closed their tab.";
  }
  return m;
}

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
    return this.withRetry(
      () =>
        new Promise<string>((resolve, reject) => {
          const peer = new Peer(PEER_OPTIONS);
          this.peer = peer;
          this.role = "hosting";
          this.listeners.onRoleChange?.("hosting");
          let settled = false;
          peer.on("open", (id: string) => {
            settled = true;
            this.myId = id;
            this.role = "host-ready";
            this.listeners.onRoleChange?.("host-ready", { myId: id });
            resolve(id);
          });
          peer.on("connection", (conn: DataConnection) => this.bindConnection(conn));
          peer.on("error", (err: Error) => {
            if (settled) return;
            reject(err);
          });
          peer.on("disconnected", () => {
            if (!settled) reject(new Error("Broker disconnected before open"));
          });
        }),
      "host"
    );
  }

  async join(hostId: string): Promise<void> {
    this.dispose();
    return this.withRetry(
      () =>
        new Promise<void>((resolve, reject) => {
          const peer = new Peer(PEER_OPTIONS);
          this.peer = peer;
          this.role = "joining";
          this.listeners.onRoleChange?.("joining", { peerId: hostId });
          let settled = false;
          peer.on("open", (id: string) => {
            this.myId = id;
            const conn = peer.connect(hostId, { reliable: false, serialization: "json" });
            const connTimeout = window.setTimeout(() => {
              if (!settled) {
                settled = true;
                reject(new Error("Peer did not respond — check the room code"));
              }
            }, 12000);
            conn.on("open", () => {
              if (settled) return;
              settled = true;
              window.clearTimeout(connTimeout);
              this.bindConnection(conn);
              this.role = "connected";
              this.listeners.onRoleChange?.("connected", { myId: id, peerId: hostId });
              resolve();
            });
            conn.on("error", (err: Error) => {
              if (settled) return;
              settled = true;
              window.clearTimeout(connTimeout);
              reject(err);
            });
          });
          peer.on("error", (err: Error) => {
            if (!settled) {
              settled = true;
              reject(err);
            }
          });
        }),
      "join"
    );
  }

  private async withRetry<T>(attempt: () => Promise<T>, label: string, maxAttempts = 3): Promise<T> {
    let lastErr: Error | null = null;
    for (let i = 0; i < maxAttempts; i += 1) {
      try {
        const value = await attempt();
        return value;
      } catch (err) {
        lastErr = err as Error;
        this.dispose();
        if (i < maxAttempts - 1) {
          this.listeners.onRoleChange?.("offline", {
            error: `${label} attempt ${i + 1}/${maxAttempts} failed (${lastErr.message}). Retrying...`
          });
          await sleep(900 * (i + 1));
        }
      }
    }
    const finalErr = lastErr ?? new Error("Unknown network error");
    this.listeners.onRoleChange?.("offline", { error: friendlyError(finalErr) });
    throw new Error(friendlyError(finalErr));
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
