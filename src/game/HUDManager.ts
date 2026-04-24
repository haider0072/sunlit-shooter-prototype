function requiredElement<T extends HTMLElement>(selector: string) {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing game shell element: ${selector}`);
  return element;
}

export class HUDManager {
  private readonly loader = requiredElement<HTMLDivElement>("#loader");
  private readonly startButton = requiredElement<HTMLButtonElement>("#startButton");
  private readonly score = requiredElement<HTMLSpanElement>("#score");
  private readonly ammo = requiredElement<HTMLSpanElement>("#ammo");
  private readonly health = requiredElement<HTMLSpanElement>("#health");
  private readonly status = requiredElement<HTMLDivElement>("#status");
  private readonly objective = requiredElement<HTMLSpanElement>("#objective");
  private readonly crosshair = requiredElement<HTMLDivElement>(".crosshair");
  private readonly controlsButton = requiredElement<HTMLButtonElement>("#controlsButton");
  private readonly controlsPanel = requiredElement<HTMLElement>("#controlsPanel");
  private readonly volumeSlider = requiredElement<HTMLInputElement>("#volumeSlider");
  private readonly volumeValue = requiredElement<HTMLSpanElement>("#volumeValue");

  hideLoader() {
    this.loader.classList.add("hidden");
  }

  showLoadError(message: string) {
    this.loader.classList.add("hidden");
    this.status.textContent = message;
  }

  setStartButtonText(text: string) {
    this.startButton.textContent = text;
  }

  onStartClick(cb: () => void) {
    this.startButton.addEventListener("click", cb);
  }

  setScore(value: number) {
    this.score.textContent = `${value}`;
  }

  setAmmo(current: number, reloading: boolean, grenades: number, magSize = 12, weaponLabel?: string) {
    const label = weaponLabel ? `${weaponLabel} · ` : "";
    this.ammo.textContent = reloading ? `${label}...` : `${label}${current} / ${magSize}  G:${grenades}`;
  }

  setHealth(value: number) {
    this.health.textContent = `${value}`;
  }

  setStatus(message: string) {
    this.status.textContent = message;
  }

  getStatus(): string {
    return this.status.textContent || "";
  }

  setObjective(text: string) {
    this.objective.textContent = text;
  }

  flashCrosshairHit() {
    this.crosshair.classList.remove("hit");
    window.requestAnimationFrame(() => this.crosshair.classList.add("hit"));
  }

  flashCrosshairMiss() {
    this.crosshair.classList.remove("flash");
    window.requestAnimationFrame(() => this.crosshair.classList.add("flash"));
  }

  isControlsOpen(): boolean {
    return this.controlsPanel.classList.contains("active");
  }

  toggleControls(force?: boolean): boolean {
    const active = force ?? !this.controlsPanel.classList.contains("active");
    this.controlsPanel.classList.toggle("active", active);
    this.controlsPanel.setAttribute("aria-hidden", active ? "false" : "true");
    this.controlsButton.setAttribute("aria-expanded", active ? "true" : "false");
    this.controlsButton.setAttribute("aria-label", active ? "Hide controls (H)" : "Show controls (H)");
    this.controlsButton.setAttribute("title", active ? "Hide controls (H)" : "Controls (H)");
    return active;
  }

  onControlsClick(cb: () => void) {
    this.controlsButton.addEventListener("click", cb);
  }

  setVolumeUi(percent: number) {
    this.volumeSlider.value = `${percent}`;
    this.volumeValue.textContent = `${percent}%`;
  }

  onVolumeInput(cb: (normalized: number) => void) {
    this.volumeSlider.addEventListener("input", () => {
      cb(Number(this.volumeSlider.value) / 100);
    });
  }

  showWaveBanner(number: number, title: string, durationMs = 1800) {
    const banner = document.getElementById("waveBanner");
    const num = document.getElementById("waveBannerNumber");
    const subtitle = document.getElementById("waveBannerTitle");
    if (!banner || !num || !subtitle) return;
    num.textContent = `${number}`;
    subtitle.textContent = title;
    banner.setAttribute("aria-hidden", "false");
    window.clearTimeout((banner as HTMLElement & { _hideT?: number })._hideT);
    (banner as HTMLElement & { _hideT?: number })._hideT = window.setTimeout(() => {
      banner.setAttribute("aria-hidden", "true");
    }, durationMs);
  }

  showCombo(multiplier: number, kills: number) {
    const badge = document.getElementById("comboBadge");
    const mult = document.getElementById("comboMult");
    const count = document.getElementById("comboKills");
    if (!badge || !mult || !count) return;
    mult.textContent = `×${multiplier.toFixed(2)}`;
    count.textContent = `${kills} kill${kills === 1 ? "" : "s"}`;
    badge.setAttribute("aria-hidden", "false");
  }

  hideCombo() {
    const badge = document.getElementById("comboBadge");
    badge?.setAttribute("aria-hidden", "true");
  }

  setPause(open: boolean) {
    const menu = document.getElementById("pauseMenu");
    menu?.setAttribute("aria-hidden", open ? "false" : "true");
  }

  onPauseMenu(handlers: { resume: () => void; restart: () => void; quit: () => void }) {
    document.getElementById("pauseResume")?.addEventListener("click", handlers.resume);
    document.getElementById("pauseRestart")?.addEventListener("click", handlers.restart);
    document.getElementById("pauseQuit")?.addEventListener("click", handlers.quit);
  }
}
