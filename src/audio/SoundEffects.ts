/**
 * Neural Node & Code - Sound effects
 *
 * Every game sound, composed from AudioEngine tones and noise. Most sounds
 * play automatically in response to game events, so gameplay code never
 * touches audio directly. A few (footsteps, menu blips, cutscene theme, the
 * gore splat) are called explicitly.
 */
import type { EventBus } from '../core/EventBus';
import type { AudioEngine, LoopHandle } from './AudioEngine';

/** Musical note frequencies used in jingles, in hertz. */
const NOTE = {
  C4: 261.63,
  E4: 329.63,
  G4: 392.0,
  A4: 440.0,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  G5: 783.99,
  A5: 880.0,
  C6: 1046.5,
} as const;

/** Siren pitch range while monitors are frightened. */
const SIREN_LOW = 180;
const SIREN_HIGH = 320;

export class SoundEffects {
  private readonly audio: AudioEngine;
  private readonly unsubscribers: (() => void)[] = [];
  private siren: LoopHandle | null = null;
  private stepToggle = false;

  constructor(audio: AudioEngine, events: EventBus) {
    this.audio = audio;
    this.unsubscribers.push(
      events.on('nodeCollected', ({ chain }) => {
        this.nodeChime(chain);
      }),
      events.on('powerOrbCollected', () => {
        this.powerSurge();
        this.startSiren();
      }),
      events.on('powerModeEnded', () => {
        this.stopSiren();
      }),
      events.on('monitorCaught', ({ points }) => {
        this.monitorCrunch(points);
      }),
      events.on('scientistCaught', () => {
        this.stopSiren();
        this.systemCrash();
      }),
      events.on('extraLife', () => {
        this.extraLifeJingle();
      }),
      events.on('levelStarted', () => {
        this.bootJingle();
      }),
      events.on('levelCompleted', () => {
        this.stopSiren();
        this.clearFanfare();
      }),
      events.on('gameOver', () => {
        this.stopSiren();
        this.gameOverTune();
      }),
    );
  }

  /** Wobbles the frightened siren. Call every frame while it may be playing. */
  update(time: number): void {
    if (this.siren !== null) {
      const wobble = 0.5 + 0.5 * Math.sin(time * Math.PI * 2 * 3);
      this.siren.setFrequency(SIREN_LOW + (SIREN_HIGH - SIREN_LOW) * wobble);
    }
  }

  /** Stops every continuous sound, for pausing or leaving a level. */
  stopAll(): void {
    this.stopSiren();
  }

  dispose(): void {
    this.stopAll();
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers.length = 0;
  }

  // ---------------------------------------------------------------------------
  //  Called directly by the game and UI
  // ---------------------------------------------------------------------------

  /** A soft footstep; alternates slightly in pitch like left and right feet. */
  footstep(): void {
    this.stepToggle = !this.stepToggle;
    this.audio.noise({
      duration: 0.045,
      volume: 0.06,
      filterType: 'lowpass',
      filterFrequency: this.stepToggle ? 900 : 750,
    });
  }

  /** Menu navigation blip. */
  menuBlip(): void {
    this.audio.tone({ frequency: NOTE.A5, duration: 0.05, type: 'square', volume: 0.12 });
  }

  /** Menu confirm sound. */
  menuConfirm(): void {
    this.arpeggio([NOTE.C5, NOTE.G5, NOTE.C6], 0.05, 'square', 0.14);
  }

  /** Pause and unpause toggle. */
  pauseToggle(paused: boolean): void {
    this.audio.tone({
      frequency: paused ? NOTE.E5 : NOTE.A4,
      endFrequency: paused ? NOTE.A4 : NOTE.E5,
      duration: 0.12,
      type: 'triangle',
      volume: 0.18,
    });
  }

  /** GORE on: a wet, squelchy burst with a deep thump, then drips as the pieces land. */
  splat(): void {
    // The squelch: noise swept from bright to muffled.
    this.audio.noise({
      duration: 0.38,
      volume: 0.42,
      filterType: 'lowpass',
      filterFrequency: 1800,
      filterEndFrequency: 140,
      attack: 0.004,
    });
    // The thump underneath.
    this.audio.tone({
      frequency: 150,
      endFrequency: 38,
      duration: 0.3,
      type: 'sine',
      volume: 0.38,
    });
    // Small splats as the pieces hit the floor.
    const drips = [0.42, 0.58, 0.71, 0.93];
    drips.forEach((delay, index) => {
      this.audio.noise({
        duration: 0.07,
        volume: 0.12 - index * 0.02,
        filterType: 'lowpass',
        filterFrequency: 700 - index * 90,
        filterEndFrequency: 180,
        delay,
      });
    });
  }

  /** A short chiptune melody for the cutscenes. */
  cutsceneTheme(): void {
    const melody = [
      NOTE.E5,
      NOTE.G5,
      NOTE.A5,
      NOTE.G5,
      NOTE.E5,
      NOTE.D5,
      NOTE.C5,
      NOTE.D5,
      NOTE.E5,
      NOTE.E5,
      NOTE.G5,
      NOTE.A5,
      NOTE.C6,
      NOTE.A5,
      NOTE.G5,
      NOTE.E5,
    ];
    melody.forEach((frequency, index) => {
      this.audio.tone({
        frequency,
        duration: 0.16,
        type: 'square',
        volume: 0.12,
        delay: index * 0.18,
      });
      if (index % 2 === 0) {
        this.audio.tone({
          frequency: frequency / 4,
          duration: 0.3,
          type: 'triangle',
          volume: 0.14,
          delay: index * 0.18,
        });
      }
    });
  }

  // ---------------------------------------------------------------------------
  //  Event sounds
  // ---------------------------------------------------------------------------

  /** Chime that climbs a semitone with each node in a quick chain. */
  private nodeChime(chain: number): void {
    const step = Math.min(chain, 12);
    const frequency = 620 * 2 ** (step / 12);
    this.audio.tone({ frequency, duration: 0.07, type: 'triangle', volume: 0.16 });
    this.audio.tone({
      frequency: frequency * 2,
      duration: 0.04,
      type: 'sine',
      volume: 0.07,
      delay: 0.02,
    });
  }

  private powerSurge(): void {
    this.audio.tone({
      frequency: 110,
      endFrequency: 880,
      duration: 0.45,
      type: 'sawtooth',
      volume: 0.2,
      attack: 0.02,
    });
    this.audio.noise({
      duration: 0.5,
      volume: 0.12,
      filterType: 'bandpass',
      filterFrequency: 400,
      filterEndFrequency: 6000,
    });
  }

  private monitorCrunch(points: number): void {
    // Higher catches in the chain sound higher.
    const lift = Math.log2(Math.max(points, 200) / 200);
    this.audio.noise({
      duration: 0.22,
      volume: 0.25,
      filterType: 'bandpass',
      filterFrequency: 4000,
      filterEndFrequency: 300,
    });
    this.arpeggio(
      [NOTE.C6 * 2 ** (lift / 4), NOTE.G5 * 2 ** (lift / 4), NOTE.C5 * 2 ** (lift / 4)],
      0.05,
      'square',
      0.16,
      0.05,
    );
  }

  private systemCrash(): void {
    this.audio.tone({
      frequency: 700,
      endFrequency: 45,
      duration: 1.3,
      type: 'sawtooth',
      volume: 0.24,
      attack: 0.01,
    });
    for (let index = 0; index < 6; index += 1) {
      this.audio.noise({
        duration: 0.08,
        volume: 0.14,
        filterType: 'highpass',
        filterFrequency: 2500,
        delay: 0.15 + index * 0.17,
      });
    }
  }

  private bootJingle(): void {
    this.arpeggio([NOTE.C4, NOTE.E4, NOTE.G4, NOTE.C5, NOTE.E5, NOTE.G5], 0.09, 'square', 0.13);
    this.audio.tone({
      frequency: NOTE.C6,
      duration: 0.35,
      type: 'triangle',
      volume: 0.16,
      delay: 0.56,
    });
  }

  private clearFanfare(): void {
    this.arpeggio([NOTE.G4, NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6], 0.08, 'square', 0.15);
    this.arpeggio([NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6], 0.08, 'triangle', 0.12, 0.48);
  }

  private extraLifeJingle(): void {
    this.arpeggio([NOTE.E5, NOTE.G5, NOTE.C6, NOTE.G5, NOTE.C6], 0.07, 'square', 0.15);
  }

  private gameOverTune(): void {
    this.arpeggio([NOTE.G4, NOTE.E4, NOTE.C4], 0.32, 'triangle', 0.2);
    this.audio.tone({
      frequency: NOTE.C4 / 2,
      duration: 1.0,
      type: 'sawtooth',
      volume: 0.12,
      delay: 0.96,
    });
  }

  // ---------------------------------------------------------------------------
  //  Helpers
  // ---------------------------------------------------------------------------

  private startSiren(): void {
    this.siren ??= this.audio.loop(SIREN_LOW, 'square', 0.035);
  }

  private stopSiren(): void {
    this.siren?.stop();
    this.siren = null;
  }

  /** Plays notes one after another. */
  private arpeggio(
    notes: readonly number[],
    stepSeconds: number,
    type: OscillatorType,
    volume: number,
    startDelay = 0,
  ): void {
    notes.forEach((frequency, index) => {
      this.audio.tone({
        frequency,
        duration: stepSeconds * 1.4,
        type,
        volume,
        delay: startDelay + index * stepSeconds,
      });
    });
  }
}
