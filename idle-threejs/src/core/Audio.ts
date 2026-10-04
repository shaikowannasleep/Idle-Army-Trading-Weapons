import coinUrl from '../assets/sfx/coin.mp3?url';
import deathUrl from '../assets/sfx/death.mp3?url';
import receiveUrl from '../assets/sfx/sound-receive-coin.mp3?url';
import clickUrl from '../assets/sfx/click1.mp3?url';
import tipUrl from '../assets/sfx/Coin_Tip.mp3?url';
import gunUrl from '../assets/sfx/gun1.mp3?url';
import bgmUrl from '../assets/sfx/bgM.mp3?url';
import orderUrl from '../assets/sfx/finish_order.mp3?url';

const SFX = {
  coin: coinUrl,
  death: deathUrl,
  receive: receiveUrl,
  click: clickUrl,
  tip: tipUrl,
  gun: gunUrl,
  bgm: bgmUrl,
  order: orderUrl,
};
export type SfxKey = keyof typeof SFX;

/** Minimum spacing (s) between two plays of the same sample - keeps rapid fire from stacking voices. */
const THROTTLE: Partial<Record<SfxKey, number>> = { gun: 0.07, coin: 0.05, receive: 0.06, tip: 0.08, death: 0.12 };

/** WebAudio mixer: decoded samples + a few procedural one-shots (boom, roar, whoosh). */
export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private raw = new Map<SfxKey, ArrayBuffer>();
  private buffers = new Map<SfxKey, AudioBuffer>();
  private lastPlay = new Map<string, number>();
  private noise: AudioBuffer | null = null;
  private music: AudioBufferSourceNode | null = null;
  muted = false;
  disabled = false;

  async preload(): Promise<void> {
    await Promise.all(
      (Object.keys(SFX) as SfxKey[]).map(async (k) => {
        const res = await fetch(SFX[k]);
        this.raw.set(k, await res.arrayBuffer());
      }),
    );
  }

  /** Must run inside a user gesture (autoplay policy). */
  async unlock(): Promise<void> {
    if (this.disabled) return;
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    // 24 kHz is plenty for phone speakers and halves decoded-sample memory + mixing work
    this.ctx = new Ctx({ latencyHint: 'playback', sampleRate: 24000 });
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.32;
    this.musicBus.connect(this.master);

    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    await Promise.all(
      [...this.raw.entries()].map(async ([k, ab]) => {
        try {
          this.buffers.set(k, await this.ctx!.decodeAudioData(ab.slice(0)));
        } catch {
          /* undecodable sample: stay silent */
        }
      }),
    );
    this.raw.clear();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
    // a muted context still burns an audio thread: suspend it entirely
    if (m) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  suspend(hidden: boolean): void {
    if (!this.ctx || this.muted) return;
    if (hidden) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  play(key: SfxKey, volume = 1, rate = 1): void {
    const ctx = this.ctx;
    const buf = this.buffers.get(key);
    if (!ctx || !buf || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const gap = THROTTLE[key] ?? 0.03;
    if (now - (this.lastPlay.get(key) ?? -1) < gap) return;
    this.lastPlay.set(key, now);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = volume;
    src.connect(g).connect(this.sfxBus);
    src.start();
  }

  startMusic(): void {
    const ctx = this.ctx;
    const buf = this.buffers.get('bgm');
    if (!ctx || !buf || this.music) return;
    this.music = ctx.createBufferSource();
    this.music.buffer = buf;
    this.music.loop = true;
    this.music.connect(this.musicBus);
    this.music.start();
  }

  duckMusic(level: number, time = 0.4): void {
    if (this.ctx) this.musicBus.gain.setTargetAtTime(0.32 * level, this.ctx.currentTime, time);
  }

  /** Filtered-noise explosion with a sub-bass thump. */
  boom(size = 1): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (now - (this.lastPlay.get('boom') ?? -1) < 0.05) return;
    this.lastPlay.set('boom', now);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1800 * size, now);
    lp.frequency.exponentialRampToValueAtTime(120, now + 0.6 * size);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.9 * Math.min(1.4, size), now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.7 * size);
    src.connect(lp).connect(g).connect(this.sfxBus);
    src.start(now, Math.random() * 0.5);
    src.stop(now + 0.8 * size);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.35);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.8, now);
    og.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    osc.connect(og).connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  /** Monster roar: detuned saw stack through a sweeping band-pass + growl noise. */
  roar(power = 1, duration = 1.1): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, now);
    out.gain.exponentialRampToValueAtTime(0.55 * power, now + 0.12);
    out.gain.setValueAtTime(0.55 * power, now + duration * 0.6);
    out.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(380, now);
    bp.frequency.linearRampToValueAtTime(900, now + duration * 0.35);
    bp.frequency.linearRampToValueAtTime(260, now + duration);
    bp.connect(out).connect(this.sfxBus);
    const base = 62 - power * 8;
    for (const det of [-14, 0, 9]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(base, now);
      o.frequency.linearRampToValueAtTime(base * 1.5, now + duration * 0.3);
      o.frequency.linearRampToValueAtTime(base * 0.8, now + duration);
      o.detune.value = det * 10;
      o.connect(bp);
      o.start(now);
      o.stop(now + duration);
    }
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const ng = ctx.createGain();
    ng.gain.value = 0.35;
    n.connect(ng).connect(bp);
    n.start(now);
    n.stop(now + duration);
  }

  whoosh(up = true): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2;
    bp.frequency.setValueAtTime(up ? 400 : 2400, now);
    bp.frequency.exponentialRampToValueAtTime(up ? 2400 : 300, now + 0.45);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.4, now + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    src.connect(bp).connect(g).connect(this.sfxBus);
    src.start(now);
    src.stop(now + 0.55);
  }

  /** Bright arpeggio for level-ups / unlocks. */
  chime(steps = 3): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    for (let i = 0; i < Math.min(steps, notes.length); i++) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = notes[i];
      const g = ctx.createGain();
      const t = now + i * 0.07;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(this.sfxBus);
      o.start(t);
      o.stop(t + 0.4);
    }
  }
}
