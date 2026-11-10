/**
 * Neural Node & Code - Audio engine
 *
 * Every sound is synthesized live with the Web Audio API: oscillators for
 * tones and a filtered noise buffer for static and crunches. There are no
 * audio files.
 *
 * - Created lazily and unlocked on the player's first key press or click,
 *   as browsers require.
 * - All sound passes through a master gain and a compressor to prevent
 *   clipping when many sounds overlap.
 * - Simultaneous one-shot voices are capped.
 * - Mute is remembered between sessions; storage failures are ignored.
 */
import { STORAGE_KEYS } from '../core/Config';
import { SeededRandom } from '../utils/MathUtils';

const MASTER_VOLUME = 0.55;
const MAX_VOICES = 32;
const SILENT = 0.0001;

export interface ToneOptions {
  /** Starting pitch, in hertz. */
  readonly frequency: number;
  /** Pitch at the end of the sound (slides smoothly), in hertz. */
  readonly endFrequency?: number;
  /** Length in seconds. */
  readonly duration: number;
  readonly type?: OscillatorType;
  /** Peak volume, 0..1. */
  readonly volume?: number;
  /** Fade-in time, in seconds. */
  readonly attack?: number;
  /** Seconds from now before the sound starts. */
  readonly delay?: number;
}

export interface NoiseOptions {
  readonly duration: number;
  readonly volume?: number;
  readonly filterType?: BiquadFilterType;
  readonly filterFrequency?: number;
  readonly filterEndFrequency?: number;
  readonly attack?: number;
  readonly delay?: number;
}

/** A continuous sound that plays until stopped. */
export interface LoopHandle {
  setFrequency: (frequency: number) => void;
  stop: () => void;
}

function loadMuted(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEYS.muted) === '1';
  } catch {
    return false;
  }
}

function saveMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.muted, muted ? '1' : '0');
  } catch {
    // Storage unavailable: the setting simply is not remembered.
  }
}

export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private activeVoices = 0;
  private muted: boolean;

  constructor() {
    this.muted = loadMuted();
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** True once the browser has allowed audio to play. */
  get isReady(): boolean {
    return this.context?.state === 'running';
  }

  /** Creates and resumes the audio context. Call from a key press or click. */
  unlock(): void {
    const context = this.ensureContext();
    if (context !== null && context.state === 'suspended') {
      context.resume().catch(() => {
        // The browser refused; sound stays off until the next interaction.
      });
    }
  }

  /** Toggles mute and remembers the choice. */
  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    saveMuted(muted);
    const context = this.context;
    if (context !== null && this.master !== null) {
      this.master.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME, context.currentTime, 0.02);
    }
  }

  /** Pauses all audio, for example when the tab is hidden. */
  suspend(): void {
    this.context?.suspend().catch(() => undefined);
  }

  /** Resumes audio after suspend(). */
  resume(): void {
    if (this.context?.state === 'suspended') {
      this.context.resume().catch(() => undefined);
    }
  }

  // ---------------------------------------------------------------------------
  //  Sound building blocks
  // ---------------------------------------------------------------------------

  /** Plays a single tone with an optional pitch slide. */
  tone(options: ToneOptions): void {
    const context = this.readyContext();
    if (context === null || this.master === null) {
      return;
    }
    const start = context.currentTime + (options.delay ?? 0);
    const end = start + options.duration;

    const oscillator = context.createOscillator();
    oscillator.type = options.type ?? 'square';
    oscillator.frequency.setValueAtTime(options.frequency, start);
    if (options.endFrequency !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(options.endFrequency, 1), end);
    }

    const gain = this.envelope(context, start, end, options.volume ?? 0.3, options.attack ?? 0.005);
    oscillator.connect(gain);
    this.play(oscillator, gain, start, end);
  }

  /** Plays filtered noise: static, crunches, whooshes. */
  noise(options: NoiseOptions): void {
    const context = this.readyContext();
    if (context === null || this.master === null) {
      return;
    }
    const buffer = this.getNoiseBuffer(context);
    const start = context.currentTime + (options.delay ?? 0);
    const end = start + options.duration;

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = context.createBiquadFilter();
    filter.type = options.filterType ?? 'bandpass';
    filter.frequency.setValueAtTime(options.filterFrequency ?? 2000, start);
    if (options.filterEndFrequency !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(options.filterEndFrequency, 1), end);
    }

    const gain = this.envelope(
      context,
      start,
      end,
      options.volume ?? 0.25,
      options.attack ?? 0.005,
    );
    source.connect(filter);
    filter.connect(gain);
    this.play(source, gain, start, end);
  }

  /** Starts a continuous tone, such as the frightened-mode siren. */
  loop(frequency: number, type: OscillatorType, volume: number): LoopHandle | null {
    const context = this.readyContext();
    if (context === null || this.master === null) {
      return null;
    }
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.setValueAtTime(SILENT, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + 0.08);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start();

    let stopped = false;
    return {
      setFrequency: (next: number) => {
        if (!stopped) {
          oscillator.frequency.setTargetAtTime(next, context.currentTime, 0.03);
        }
      },
      stop: () => {
        if (stopped) {
          return;
        }
        stopped = true;
        const now = context.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(Math.max(gain.gain.value, SILENT), now);
        gain.gain.exponentialRampToValueAtTime(SILENT, now + 0.1);
        oscillator.stop(now + 0.12);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
        };
      },
    };
  }

  // ---------------------------------------------------------------------------
  //  Internals
  // ---------------------------------------------------------------------------

  private ensureContext(): AudioContext | null {
    if (this.context !== null) {
      return this.context;
    }
    if (typeof window.AudioContext !== 'function') {
      return null;
    }
    const context = new AudioContext({ latencyHint: 'interactive' });

    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 12;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.15;
    compressor.connect(context.destination);

    const master = context.createGain();
    master.gain.value = this.muted ? 0 : MASTER_VOLUME;
    master.connect(compressor);

    this.context = context;
    this.master = master;
    return context;
  }

  /** The context, if audio is unlocked, unmuted, and below the voice limit. */
  private readyContext(): AudioContext | null {
    const context = this.context;
    if (context?.state !== 'running' || this.muted || this.activeVoices >= MAX_VOICES) {
      return null;
    }
    return context;
  }

  private envelope(
    context: AudioContext,
    start: number,
    end: number,
    volume: number,
    attack: number,
  ): GainNode {
    const gain = context.createGain();
    const peak = Math.max(volume, SILENT);
    const peakTime = Math.min(start + attack, end);
    gain.gain.setValueAtTime(SILENT, start);
    gain.gain.exponentialRampToValueAtTime(peak, peakTime);
    gain.gain.exponentialRampToValueAtTime(SILENT, end);
    return gain;
  }

  private play(source: AudioScheduledSourceNode, gain: GainNode, start: number, end: number): void {
    if (this.master === null) {
      return;
    }
    gain.connect(this.master);
    this.activeVoices += 1;
    source.onended = () => {
      this.activeVoices -= 1;
      source.disconnect();
      gain.disconnect();
    };
    source.start(start);
    source.stop(end + 0.02);
  }

  /** One second of repeatable white noise, created once and reused. */
  private getNoiseBuffer(context: AudioContext): AudioBuffer {
    if (this.noiseBuffer !== null) {
      return this.noiseBuffer;
    }
    const length = context.sampleRate;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    const random = new SeededRandom(0x6e6f6973);
    for (let index = 0; index < length; index += 1) {
      data[index] = random.range(-1, 1);
    }
    this.noiseBuffer = buffer;
    return buffer;
  }
}
