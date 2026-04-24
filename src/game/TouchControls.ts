export type TouchState = {
  moveX: number;
  moveY: number;
  lookDx: number;
  lookDy: number;
  firing: boolean;
};

export type TouchHandlers = {
  onFirePress: () => void;
  onJump: () => void;
  onReload: () => void;
  onGrenade: () => void;
  onToggleCamera: () => void;
};

const JOY_RADIUS = 60;

export class TouchControls {
  state: TouchState = { moveX: 0, moveY: 0, lookDx: 0, lookDy: 0, firing: false };
  enabled = false;

  private root: HTMLElement;
  private moveStick: HTMLElement;
  private moveKnob: HTMLElement;
  private fireBtn: HTMLElement;
  private reloadBtn: HTMLElement;
  private grenadeBtn: HTMLElement;
  private jumpBtn: HTMLElement;
  private viewBtn: HTMLElement;

  private moveId = -1;
  private moveStart = { x: 0, y: 0 };
  private lookId = -1;
  private lookLast = { x: 0, y: 0 };
  private handlers: TouchHandlers | null = null;

  constructor() {
    this.root = this.create();
    document.body.appendChild(this.root);
    this.moveStick = this.root.querySelector<HTMLElement>("#touchStick")!;
    this.moveKnob = this.root.querySelector<HTMLElement>("#touchKnob")!;
    this.fireBtn = this.root.querySelector<HTMLElement>("#touchFire")!;
    this.reloadBtn = this.root.querySelector<HTMLElement>("#touchReload")!;
    this.grenadeBtn = this.root.querySelector<HTMLElement>("#touchGrenade")!;
    this.jumpBtn = this.root.querySelector<HTMLElement>("#touchJump")!;
    this.viewBtn = this.root.querySelector<HTMLElement>("#touchView")!;
    this.bind();
    if (this.isTouchDevice()) {
      this.enabled = true;
      this.root.classList.add("active");
    }
  }

  setHandlers(handlers: TouchHandlers) {
    this.handlers = handlers;
  }

  private isTouchDevice() {
    return ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
  }

  private create() {
    const el = document.createElement("div");
    el.id = "touchLayer";
    el.className = "touch-layer";
    el.innerHTML = `
      <div id="touchStick" class="touch-stick"><div id="touchKnob" class="touch-knob"></div></div>
      <div class="touch-right-cluster">
        <button id="touchView" class="touch-btn" aria-label="Toggle view">V</button>
        <button id="touchJump" class="touch-btn" aria-label="Jump">↑</button>
        <button id="touchGrenade" class="touch-btn" aria-label="Grenade">G</button>
        <button id="touchReload" class="touch-btn" aria-label="Reload">R</button>
        <button id="touchFire" class="touch-btn touch-fire" aria-label="Fire">FIRE</button>
      </div>
    `;
    return el;
  }

  private bind() {
    // Movement joystick
    this.moveStick.addEventListener("pointerdown", (e) => {
      this.moveId = e.pointerId;
      const rect = this.moveStick.getBoundingClientRect();
      this.moveStart = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      this.moveStick.setPointerCapture(e.pointerId);
    });
    this.moveStick.addEventListener("pointermove", (e) => {
      if (e.pointerId !== this.moveId) return;
      const dx = e.clientX - this.moveStart.x;
      const dy = e.clientY - this.moveStart.y;
      const len = Math.min(Math.hypot(dx, dy), JOY_RADIUS);
      const ang = Math.atan2(dy, dx);
      const kx = Math.cos(ang) * len;
      const ky = Math.sin(ang) * len;
      this.moveKnob.style.transform = `translate(${kx}px, ${ky}px)`;
      this.state.moveX = kx / JOY_RADIUS;
      this.state.moveY = ky / JOY_RADIUS;
    });
    const endMove = (e: PointerEvent) => {
      if (e.pointerId !== this.moveId) return;
      this.moveId = -1;
      this.moveKnob.style.transform = "translate(0,0)";
      this.state.moveX = 0;
      this.state.moveY = 0;
    };
    this.moveStick.addEventListener("pointerup", endMove);
    this.moveStick.addEventListener("pointercancel", endMove);

    // Look drag on the right side (outside button cluster)
    document.addEventListener("pointerdown", (e) => {
      if (!this.enabled) return;
      const target = e.target as HTMLElement;
      if (target.closest(".touch-layer button") || target.closest("#touchStick")) return;
      if (e.clientX < window.innerWidth * 0.35) return; // reserved for stick
      this.lookId = e.pointerId;
      this.lookLast = { x: e.clientX, y: e.clientY };
    });
    document.addEventListener("pointermove", (e) => {
      if (e.pointerId !== this.lookId) return;
      this.state.lookDx += e.clientX - this.lookLast.x;
      this.state.lookDy += e.clientY - this.lookLast.y;
      this.lookLast = { x: e.clientX, y: e.clientY };
    });
    const endLook = (e: PointerEvent) => {
      if (e.pointerId !== this.lookId) return;
      this.lookId = -1;
    };
    document.addEventListener("pointerup", endLook);
    document.addEventListener("pointercancel", endLook);

    // Buttons
    this.fireBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.state.firing = true;
      this.handlers?.onFirePress();
    });
    this.fireBtn.addEventListener("pointerup", () => (this.state.firing = false));
    this.fireBtn.addEventListener("pointercancel", () => (this.state.firing = false));

    this.reloadBtn.addEventListener("click", () => this.handlers?.onReload());
    this.grenadeBtn.addEventListener("click", () => this.handlers?.onGrenade());
    this.jumpBtn.addEventListener("click", () => this.handlers?.onJump());
    this.viewBtn.addEventListener("click", () => this.handlers?.onToggleCamera());
  }

  consumeLook(): { dx: number; dy: number } {
    const result = { dx: this.state.lookDx, dy: this.state.lookDy };
    this.state.lookDx = 0;
    this.state.lookDy = 0;
    return result;
  }
}
