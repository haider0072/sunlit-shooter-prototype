export type InputHandlers = {
  isReady: () => boolean;
  onAnyKeyDown: (event: KeyboardEvent) => void;
  onKeyUp: (event: KeyboardEvent) => void;
  onReload: () => void;
  onGrenade: () => void;
  onJump: () => void;
  onToggleDebug: () => void;
  onToggleCamera: () => void;
  onToggleControls: () => void;
  onMouseLook: (dx: number, dy: number, event: MouseEvent) => void;
  onFireStart: (event: MouseEvent) => void;
  onAdsStart: (event: MouseEvent) => void;
  onPointerLockChange: (locked: boolean, element: Element | null) => void;
  onResize: () => void;
  onFocusLost: (reason: "blur" | "hidden") => void;
};

export class InputManager {
  private readonly keys = new Set<string>();
  isPointerLocked = false;
  mouseAimActive = false;
  isFiring = false;
  isAimingDownSights = false;
  lastMouseDelta: { x: number; y: number; time: number } | null = null;

  private handlers: InputHandlers | null = null;
  private readonly disposers: Array<() => void> = [];

  constructor(private readonly canvas: HTMLCanvasElement) {}

  isKeyDown(code: string): boolean {
    return this.keys.has(code);
  }

  describeKeys(): string {
    return Array.from(this.keys).sort().join(",");
  }

  bind(handlers: InputHandlers) {
    this.handlers = handlers;
    this.addListener(window, "resize", () => handlers.onResize());

    this.addListener(window, "keydown", (event: Event) => {
      const ke = event as KeyboardEvent;
      this.keys.add(ke.code);
      handlers.onAnyKeyDown(ke);
      if (ke.code === "KeyR") handlers.onReload();
      if (ke.code === "KeyG" && !ke.repeat) handlers.onGrenade();
      if (ke.code === "F3") {
        ke.preventDefault();
        handlers.onToggleDebug();
      }
      if (ke.code === "KeyV" && !ke.repeat) handlers.onToggleCamera();
      if (ke.code === "KeyH" && !ke.repeat) handlers.onToggleControls();
      if (ke.code === "Space") {
        ke.preventDefault();
        handlers.onJump();
      }
    });

    this.addListener(window, "keyup", (event: Event) => {
      const ke = event as KeyboardEvent;
      this.keys.delete(ke.code);
      handlers.onKeyUp(ke);
    });

    this.addListener(document, "pointerlockchange", () => {
      this.isPointerLocked = document.pointerLockElement === this.canvas;
      if (this.isPointerLocked) this.mouseAimActive = true;
      handlers.onPointerLockChange(this.isPointerLocked, document.pointerLockElement);
    });

    this.addListener(window, "mousemove", (event: Event) => {
      const me = event as MouseEvent;
      if (!this.isPointerLocked && !this.mouseAimActive) return;
      this.lastMouseDelta = {
        x: me.movementX,
        y: me.movementY,
        time: Math.round(performance.now() * 10) / 10
      };
      handlers.onMouseLook(me.movementX, me.movementY, me);
    });

    this.addListener(this.canvas, "mousedown", (event: Event) => {
      const me = event as MouseEvent;
      if (me.button !== 0 || !handlers.isReady()) return;
      this.mouseAimActive = true;
      this.isFiring = true;
      handlers.onFireStart(me);
    });

    this.addListener(window, "mouseup", (event: Event) => {
      const me = event as MouseEvent;
      if (me.button === 0) this.isFiring = false;
      if (me.button === 2) this.isAimingDownSights = false;
    });

    this.addListener(this.canvas, "pointerup", (event: Event) => {
      const pe = event as PointerEvent;
      if (pe.button === 0) this.isFiring = false;
      if (pe.button === 2) this.isAimingDownSights = false;
    });

    this.addListener(this.canvas, "pointercancel", () => {
      this.isFiring = false;
      this.isAimingDownSights = false;
    });

    this.addListener(window, "mouseleave", () => {
      this.isFiring = false;
      this.isAimingDownSights = false;
    });

    this.addListener(this.canvas, "contextmenu", (event: Event) => event.preventDefault());

    this.addListener(this.canvas, "pointerdown", (event: Event) => {
      const pe = event as PointerEvent;
      if (pe.button !== 2 || !handlers.isReady()) return;
      pe.preventDefault();
      this.mouseAimActive = true;
      this.isAimingDownSights = true;
      handlers.onAdsStart(pe);
    });

    this.addListener(window, "blur", () => {
      this.keys.clear();
      this.isFiring = false;
      this.isAimingDownSights = false;
      handlers.onFocusLost("blur");
    });

    this.addListener(document, "visibilitychange", () => {
      if (document.hidden) {
        this.keys.clear();
        this.isFiring = false;
        this.isAimingDownSights = false;
        handlers.onFocusLost("hidden");
      }
    });
  }

  requestPointerLock() {
    try {
      const lock = this.canvas.requestPointerLock();
      if (lock instanceof Promise) lock.catch(() => undefined);
    } catch {
      // Some automated or embedded browsers reject pointer lock; keyboard controls still work.
    }
  }

  releaseAim() {
    this.isFiring = false;
    this.isAimingDownSights = false;
  }

  dispose() {
    for (const off of this.disposers) off();
    this.disposers.length = 0;
    this.handlers = null;
  }

  private addListener<T extends EventTarget>(target: T, type: string, listener: (event: Event) => void) {
    target.addEventListener(type, listener);
    this.disposers.push(() => target.removeEventListener(type, listener));
  }
}
