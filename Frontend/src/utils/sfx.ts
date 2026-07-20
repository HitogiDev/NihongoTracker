/**
 * Tiny synthesized sound-effects layer (WebAudio, no audio assets).
 *
 * All sounds are short synthesized chimes in the spirit of Duolingo's
 * feedback: bright, quick, and non-intrusive. The AudioContext is created
 * lazily on first play (browsers require a user gesture before audio can
 * start) and every call is safe to make unconditionally — muted or
 * unsupported environments simply no-op.
 */

const MUTE_KEY = 'sfxMuted';

let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {});
  }
  return ctx;
}

export function isSfxMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setSfxMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, String(muted));
  } catch {
    // localStorage unavailable — mute state just won't persist.
  }
}

export function toggleSfx(): boolean {
  const next = !isSfxMuted();
  setSfxMuted(next);
  return next;
}

interface Note {
  /** Frequency in Hz. */
  freq: number;
  /** Offset from now, seconds. */
  at: number;
  /** Length, seconds. */
  dur: number;
  /** Peak gain 0..1. */
  gain?: number;
  type?: OscillatorType;
}

function play(notes: Note[]) {
  if (isSfxMuted()) return;
  const ac = audioContext();
  if (!ac) return;

  const now = ac.currentTime;
  for (const n of notes) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = n.type ?? 'sine';
    osc.frequency.value = n.freq;

    const start = now + n.at;
    const peak = n.gain ?? 0.12;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + n.dur);

    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(start + n.dur + 0.05);
  }
}

/** Bright two-note "correct answer" chime. */
export function playLogSuccess() {
  play([
    { freq: 880, at: 0, dur: 0.18, type: 'triangle', gain: 0.14 },
    { freq: 1318.5, at: 0.09, dur: 0.28, type: 'triangle', gain: 0.16 },
  ]);
}

let lastTick = 0;

/** Short tick for XP count-up; throttled so rapid updates don't stack. */
export function playXpTick() {
  const now = performance.now();
  if (now - lastTick < 45) return;
  lastTick = now;
  play([
    {
      freq: 1200 + Math.random() * 500,
      at: 0,
      dur: 0.05,
      type: 'square',
      gain: 0.025,
    },
  ]);
}

/** Ascending arpeggio fanfare for level up. */
export function playLevelUp() {
  const base = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  play([
    ...base.map((freq, i) => ({
      freq,
      at: i * 0.11,
      dur: 0.32,
      type: 'triangle' as OscillatorType,
      gain: 0.14,
    })),
    { freq: 1318.5, at: 0.44, dur: 0.6, type: 'triangle', gain: 0.16 },
    { freq: 2093, at: 0.44, dur: 0.6, type: 'sine', gain: 0.07 },
  ]);
}

/** Rising whoosh + ding for overtaking someone on the leaderboard. */
export function playOvertake() {
  if (isSfxMuted()) return;
  const ac = audioContext();
  if (!ac) return;

  // Whoosh: fast upward frequency sweep.
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(950, now + 0.32);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.05, now + 0.06);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
  osc.connect(gain).connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.4);

  // Ding on arrival.
  play([
    { freq: 1567.98, at: 0.3, dur: 0.4, type: 'triangle', gain: 0.15 },
    { freq: 2349.3, at: 0.34, dur: 0.35, type: 'sine', gain: 0.06 },
  ]);
}

type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'secret';

/** Chord that scales with achievement rarity — richer the rarer. */
export function playAchievement(rarity: Rarity = 'common') {
  const chords: Record<Rarity, number[]> = {
    common: [659.25, 987.77],
    rare: [587.33, 880, 1174.66],
    epic: [523.25, 783.99, 1046.5, 1318.5],
    legendary: [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98],
    secret: [554.37, 739.99, 1108.73, 1479.98],
  };
  const notes = chords[rarity] ?? chords.common;
  play(
    notes.map((freq, i) => ({
      freq,
      at: i * 0.07,
      dur: 0.5 + i * 0.08,
      type: 'triangle' as OscillatorType,
      gain: 0.12,
    }))
  );
  if (rarity === 'legendary') {
    // Sparkle tail.
    play([
      { freq: 2093, at: 0.5, dur: 0.5, type: 'sine', gain: 0.05 },
      { freq: 2637, at: 0.62, dur: 0.5, type: 'sine', gain: 0.04 },
      { freq: 3135.96, at: 0.74, dur: 0.55, type: 'sine', gain: 0.03 },
    ]);
  }
}
