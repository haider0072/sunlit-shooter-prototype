import * as THREE from "three";

export class AudioEngine {
  private static readonly storageKey = "sunlit-volume";
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private toneBus: GainNode | null = null;
  private noiseBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private volume = this.loadVolume();

  resume() {
    const context = this.ensureContext();
    if (!context) return;
    if (context.state === "suspended") {
      void context.resume();
    }
  }

  getVolume() {
    return this.volume;
  }

  setVolume(next: number) {
    this.volume = THREE.MathUtils.clamp(next, 0, 1);
    if (this.master) {
      this.master.gain.value = this.volume;
    }
    try {
      window.localStorage.setItem(AudioEngine.storageKey, (Math.round(this.volume * 1000) / 1000).toString());
    } catch {
      // Ignore storage failures and keep runtime volume.
    }
  }

  playShot(firstPerson: boolean, aimingDownSights: boolean) {
    const context = this.ensureContext();
    if (!context || !this.toneBus) return;
    const now = context.currentTime;
    const gain = firstPerson ? 0.28 : 0.2;
    const tone = context.createOscillator();
    tone.type = aimingDownSights ? "triangle" : "square";
    tone.frequency.setValueAtTime(firstPerson ? 210 : 170, now);
    tone.frequency.exponentialRampToValueAtTime(firstPerson ? 92 : 76, now + 0.08);
    const toneGain = context.createGain();
    toneGain.gain.setValueAtTime(0.0001, now);
    toneGain.gain.exponentialRampToValueAtTime(gain, now + 0.002);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    tone.connect(toneGain);
    toneGain.connect(this.toneBus);
    tone.start(now);
    tone.stop(now + 0.1);

    this.playNoiseBurst({
      duration: firstPerson ? 0.06 : 0.08,
      gain: firstPerson ? 0.28 : 0.2,
      highpass: 520,
      lowpass: 4200
    });
  }

  playDryImpact() {
    const context = this.ensureContext();
    if (!context || !this.toneBus) return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(510, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.06);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    osc.connect(gain);
    gain.connect(this.toneBus);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  playHit(kill: boolean) {
    const context = this.ensureContext();
    if (!context || !this.toneBus) return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    osc.type = kill ? "triangle" : "sine";
    osc.frequency.setValueAtTime(kill ? 640 : 780, now);
    osc.frequency.exponentialRampToValueAtTime(kill ? 360 : 620, now + (kill ? 0.16 : 0.08));
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(kill ? 0.18 : 0.11, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (kill ? 0.18 : 0.1));
    osc.connect(gain);
    gain.connect(this.toneBus);
    osc.start(now);
    osc.stop(now + (kill ? 0.2 : 0.12));
  }

  playEmpty() {
    const context = this.ensureContext();
    if (!context || !this.toneBus) return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.04);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    osc.connect(gain);
    gain.connect(this.toneBus);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  playReloadStart() {
    const context = this.ensureContext();
    if (!context || !this.toneBus) return;
    const toneBus = this.toneBus;
    const now = context.currentTime;
    [340, 260].forEach((frequency, index) => {
      const osc = context.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(frequency, now + index * 0.07);
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, now + index * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.06, now + index * 0.07 + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.07 + 0.05);
      osc.connect(gain);
      gain.connect(toneBus);
      osc.start(now + index * 0.07);
      osc.stop(now + index * 0.07 + 0.06);
    });
  }

  playReloadEnd() {
    const context = this.ensureContext();
    if (!context || !this.toneBus) return;
    const toneBus = this.toneBus;
    const now = context.currentTime;
    [250, 320, 410].forEach((frequency, index) => {
      const osc = context.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(frequency, now + index * 0.03);
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, now + index * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.07, now + index * 0.03 + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.03 + 0.08);
      osc.connect(gain);
      gain.connect(toneBus);
      osc.start(now + index * 0.03);
      osc.stop(now + index * 0.03 + 0.09);
    });
  }

  playGrenadeThrow() {
    const context = this.ensureContext();
    if (!context || !this.toneBus) return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.07, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    osc.connect(gain);
    gain.connect(this.toneBus);
    osc.start(now);
    osc.stop(now + 0.16);
    this.playNoiseBurst({ duration: 0.09, gain: 0.08, highpass: 260, lowpass: 2200 });
  }

  playExplosion() {
    const context = this.ensureContext();
    if (!context || !this.toneBus) return;
    const now = context.currentTime;
    const boom = context.createOscillator();
    boom.type = "sine";
    boom.frequency.setValueAtTime(90, now);
    boom.frequency.exponentialRampToValueAtTime(34, now + 0.45);
    const boomGain = context.createGain();
    boomGain.gain.setValueAtTime(0.0001, now);
    boomGain.gain.exponentialRampToValueAtTime(0.4, now + 0.01);
    boomGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    boom.connect(boomGain);
    boomGain.connect(this.toneBus);
    boom.start(now);
    boom.stop(now + 0.55);

    this.playNoiseBurst({ duration: 0.42, gain: 0.36, highpass: 40, lowpass: 1600 });
  }

  playJump() {
    const context = this.ensureContext();
    if (!context || !this.toneBus) return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(290, now + 0.08);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.045, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    osc.connect(gain);
    gain.connect(this.toneBus);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playFootstep(sprinting: boolean, stepSide: number) {
    const context = this.ensureContext();
    if (!context || !this.toneBus) return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    osc.type = "triangle";
    const baseFrequency = sprinting ? 150 : 118;
    osc.frequency.setValueAtTime(baseFrequency + stepSide * 12, now);
    osc.frequency.exponentialRampToValueAtTime(sprinting ? 76 : 68, now + 0.07);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(sprinting ? 0.09 : 0.06, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);
    osc.connect(gain);
    gain.connect(this.toneBus);
    osc.start(now);
    osc.stop(now + 0.09);

    this.playNoiseBurst({
      duration: sprinting ? 0.08 : 0.065,
      gain: sprinting ? 0.09 : 0.06,
      highpass: 90,
      lowpass: sprinting ? 760 : 620
    });
  }

  private ensureContext() {
    if (this.context) return this.context;
    const AudioContextCtor = window.AudioContext;
    if (!AudioContextCtor) return null;
    this.context = new AudioContextCtor();
    this.master = this.context.createGain();
    this.master.gain.value = this.volume;
    this.compressor = this.context.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 24;
    this.compressor.ratio.value = 3;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.18;
    this.toneBus = this.context.createGain();
    this.toneBus.gain.value = 1.05;
    this.noiseBus = this.context.createGain();
    this.noiseBus.gain.value = 1.18;
    this.toneBus.connect(this.compressor);
    this.noiseBus.connect(this.compressor);
    this.compressor.connect(this.master);
    this.master.connect(this.context.destination);
    this.noiseBuffer = this.createNoiseBuffer(this.context);
    return this.context;
  }

  private loadVolume() {
    try {
      const raw = window.localStorage.getItem(AudioEngine.storageKey);
      if (!raw) return 0.85;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) return 0.85;
      return THREE.MathUtils.clamp(parsed, 0, 1);
    } catch {
      return 0.85;
    }
  }

  private createNoiseBuffer(context: AudioContext) {
    const buffer = context.createBuffer(1, context.sampleRate * 0.5, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) {
      channel[index] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private playNoiseBurst(options: { duration: number; gain: number; highpass: number; lowpass: number }) {
    const context = this.ensureContext();
    if (!context || !this.noiseBus || !this.noiseBuffer) return;
    const now = context.currentTime;
    const source = context.createBufferSource();
    source.buffer = this.noiseBuffer;
    const highpass = context.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = options.highpass;
    const lowpass = context.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = options.lowpass;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(options.gain, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + options.duration);
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(this.noiseBus);
    source.start(now);
    source.stop(now + options.duration + 0.02);
  }
}
