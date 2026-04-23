export class DebugOverlay {
  private readonly panel: HTMLPreElement;
  private enabled = false;
  private events: string[] = [];
  private shotLines: string[] = [];
  private shotRecords: unknown[] = [];

  constructor(panel: HTMLPreElement) {
    this.panel = panel;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(value: boolean) {
    this.enabled = value;
    this.panel.classList.toggle("active", value);
    this.panel.setAttribute("aria-hidden", value ? "false" : "true");
    if (!value) this.panel.textContent = "";
  }

  logEvent(line: string) {
    if (!this.enabled) return;
    this.events.unshift(line);
    if (this.events.length > 40) this.events.length = 40;
  }

  pushShot(summary: string, record: unknown) {
    this.shotLines.unshift(summary);
    if (this.shotLines.length > 6) this.shotLines.length = 6;
    this.shotRecords.unshift(record);
    if (this.shotRecords.length > 40) this.shotRecords.length = 40;
  }

  render(liveText: string) {
    if (!this.enabled) return;
    const eventsText = this.events.length > 0 ? `RECENT INPUT/EVENTS\n${this.events.slice(0, 8).join("\n")}` : "RECENT INPUT/EVENTS\nnone";
    const shotsText = this.shotLines.length > 0 ? `SHOT HISTORY\n${this.shotLines.join("\n\n")}` : "SHOT HISTORY\nFire a shot for telemetry.";
    this.panel.textContent = `${liveText}\n\n${eventsText}\n\n${shotsText}`;
  }

  getEvents(): string[] {
    return this.events;
  }

  getShotRecords(): unknown[] {
    return this.shotRecords;
  }
}
