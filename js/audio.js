// Synthesized sound effects (Web Audio, no asset files). The context starts
// on the first touch/key (browsers require a gesture). Everything is cheap
// one-shot oscillator/noise graphs, plus a few continuous loops (engine,
// siren) whose levels are set every frame.
import { CONFIG } from '../config.js';

let ctx = null;
let master = null;
let noiseBuf = null;
let muted = false;
let engine = null;
let siren = null;
let rainLoop = null;
let windLoop = null;
const last = {}; // throttle: sound name -> ctx time it last played
export const counts = {}; // sound name -> times played (for tests / debug)

try { muted = localStorage.getItem('bumperblock.muted') === '1'; } catch { /* storage blocked */ }

export function isMuted() {
  return muted;
}

export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('bumperblock.muted', m ? '1' : '0'); } catch { /* storage blocked */ }
  if (master) master.gain.setTargetAtTime(m ? 0 : CONFIG.audio.volume, ctx.currentTime, 0.03);
}

// Create / resume the audio context. Call from a user gesture.
export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : CONFIG.audio.volume;
    // Limiter so stacked hits and explosions don't clip.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.15;
    master.connect(limiter).connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startLoops();
  }
  if (ctx.state === 'suspended') ctx.resume();
}

const ready = () => ctx && ctx.state === 'running';

// Skip a sound if it played less than `gap` seconds ago.
function throttle(name, gap) {
  const t = ctx.currentTime;
  if (last[name] != null && t - last[name] < gap) return false;
  last[name] = t;
  counts[name] = (counts[name] || 0) + 1;
  return true;
}

// --- building blocks -------------------------------------------------------

function env(gainNode, t, attack, decay, peak) {
  const g = gainNode.gain;
  g.setValueAtTime(0.0001, t);
  g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function tone(type, f0, f1, dur, peak, t = ctx.currentTime, attack = 0.005) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  env(g, t, attack, dur, peak);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + attack + dur + 0.05);
}

function noise(dur, peak, filterType, f0, f1 = f0, q = 1, t = ctx.currentTime) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter();
  f.type = filterType;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  env(g, t, 0.004, dur, peak);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

// --- continuous loops ------------------------------------------------------

function startLoops() {
  // Engine: a low sawtooth through a lowpass, pitch follows speed.
  const eo = ctx.createOscillator();
  eo.type = 'sawtooth';
  eo.frequency.value = 55;
  const ef = ctx.createBiquadFilter();
  ef.type = 'lowpass';
  ef.frequency.value = 300;
  const eg = ctx.createGain();
  eg.gain.value = 0;
  eo.connect(ef).connect(eg).connect(master);
  eo.start();
  engine = { o: eo, f: ef, g: eg };

  // Siren: a square wave whose pitch an LFO swings between two notes.
  const so = ctx.createOscillator();
  so.type = 'square';
  so.frequency.value = 760;
  const lfo = ctx.createOscillator();
  lfo.type = 'square';
  lfo.frequency.value = 1.6;
  const depth = ctx.createGain();
  depth.gain.value = 170;
  lfo.connect(depth).connect(so.frequency);
  const sf = ctx.createBiquadFilter();
  sf.type = 'lowpass';
  sf.frequency.value = 1800;
  const sg = ctx.createGain();
  sg.gain.value = 0;
  so.connect(sf).connect(sg).connect(master);
  so.start();
  lfo.start();
  siren = { g: sg };

  // Rain: looped noise, high-passed into a hiss. Wind: looped noise through
  // a bandpass whose pitch rises with the wind.
  const loopNoise = () => {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    src.start();
    return src;
  };
  const rf = ctx.createBiquadFilter();
  rf.type = 'highpass';
  rf.frequency.value = 900;
  const rf2 = ctx.createBiquadFilter();
  rf2.type = 'lowpass';
  rf2.frequency.value = 7000;
  const rg = ctx.createGain();
  rg.gain.value = 0;
  loopNoise().connect(rf).connect(rf2).connect(rg).connect(master);
  rainLoop = { g: rg };
  const wf = ctx.createBiquadFilter();
  wf.type = 'bandpass';
  wf.frequency.value = 300;
  wf.Q.value = 0.8;
  const wg = ctx.createGain();
  wg.gain.value = 0;
  loopNoise().connect(wf).connect(wg).connect(master);
  windLoop = { f: wf, g: wg };
}

// Per-frame levels. speed in m/s; sirenLevel 0..1; paused silences loops.
// rain: precipitation intensity (0..2); wind: drift speed in m/s.
export function update({ speed = 0, sirenLevel = 0, paused = false, rain = 0, wind = 0 }) {
  if (!ready()) return;
  const t = ctx.currentTime;
  const A = CONFIG.audio;
  const on = paused ? 0 : 1;
  engine.o.frequency.setTargetAtTime(48 + speed * 9, t, 0.08);
  engine.f.frequency.setTargetAtTime(220 + speed * 70, t, 0.08);
  engine.g.gain.setTargetAtTime(on * A.engine * (0.5 + Math.min(1, speed / 8)), t, 0.1);
  siren.g.gain.setTargetAtTime(on * A.siren * sirenLevel * sirenLevel, t, 0.15);
  rainLoop.g.gain.setTargetAtTime(on * A.rain * Math.min(1.5, rain), t, 0.3);
  const wk = Math.min(1, wind / 2.5);
  windLoop.g.gain.setTargetAtTime(on * A.wind * wk, t, 0.25);
  windLoop.f.frequency.setTargetAtTime(220 + 500 * wk, t, 0.3);
}

// --- one-shots -------------------------------------------------------------

// A collision. strength 0..1; heavier hits are lower, longer and louder.
export function impact(strength, wall = false) {
  if (!ready() || !throttle('impact', 0.045)) return;
  const s = Math.min(1, strength);
  noise(0.06 + s * 0.16, 0.12 + s * 0.5, 'lowpass', 2200 - s * 1200, 300, 0.8);
  tone('sine', 140 - s * 60, 45, 0.08 + s * 0.15, 0.15 + s * 0.45);
  if (wall) tone('triangle', 90, 60, 0.12, 0.12 * s);
}

// A group armed (its countdown started): quick rising tone over the delay.
export function arm() {
  if (!ready() || !throttle('arm', 0.08)) return;
  const d = CONFIG.match.delay;
  tone('triangle', 420, 980, d, 0.16);
  tone('sine', 840, 1960, d, 0.05);
}

// A match explodes. Bigger groups boom lower; combos climb in pitch.
export function explode(weight, combo = 1, convoy = false) {
  if (!ready() || !throttle('explode', 0.03)) return;
  const t = ctx.currentTime;
  const big = Math.min(1, (weight - 3) / 4);
  noise(0.35 + big * 0.3, 0.55 + big * 0.25, 'lowpass', 3000, 120, 0.7);
  tone('sine', 110 - big * 40, 32, 0.4 + big * 0.3, 0.6);
  // Chime arpeggio, pitched up by the combo count.
  const base = 523.25 * Math.pow(2, Math.min(combo - 1, 6) / 12 * 2);
  const notes = convoy ? [1, 1.26, 1.5, 2, 2.52] : [1, 1.26, 1.5];
  notes.forEach((m, i) => tone('triangle', base * m, base * m, 0.18, 0.14, t + 0.03 + i * 0.05));
}

export function boost() {
  if (!ready() || !throttle('boost', 0.1)) return;
  noise(0.45, 0.35, 'bandpass', 400, 2400, 1.5);
  tone('sawtooth', 90, 220, 0.4, 0.08);
}

export function ability(name) {
  if (!ready() || !throttle('ability', 0.1)) return;
  const t = ctx.currentTime;
  if (name === 'chameleon') {
    [660, 830, 990, 1320].forEach((f, i) => tone('sine', f, f, 0.14, 0.12, t + i * 0.045));
  } else if (name === 'phase') {
    tone('sine', 900, 180, 0.5, 0.18);
    tone('sine', 912, 186, 0.5, 0.12);
  } else if (name === 'tow') {
    tone('square', 160, 120, 0.08, 0.15);
    noise(0.12, 0.2, 'bandpass', 1400, 900, 4, t + 0.04);
  } else {
    tone('triangle', 600, 900, 0.12, 0.14);
  }
}

export function drop() {
  if (!ready() || !throttle('drop', 0.1)) return;
  tone('square', 220, 140, 0.07, 0.1);
}

export function ram() {
  if (!ready() || !throttle('ram', 0.12)) return;
  noise(0.22, 0.6, 'lowpass', 1600, 200, 0.9);
  tone('square', 120, 50, 0.2, 0.25);
}

export function rust() {
  if (!ready() || !throttle('rust', 0.35)) return;
  noise(0.5, 0.12, 'bandpass', 300, 180, 9);
  tone('sawtooth', 70, 55, 0.4, 0.05);
}

export function heal() {
  if (!ready() || !throttle('heal', 0.12)) return;
  const t = ctx.currentTime;
  [784, 988, 1175].forEach((f, i) => tone('sine', f, f, 0.16, 0.1, t + i * 0.06));
}

export function heartbeat() {
  if (!ready() || !throttle('heartbeat', 0.5)) return;
  const t = ctx.currentTime;
  tone('sine', 70, 50, 0.12, 0.35, t);
  tone('sine', 65, 48, 0.12, 0.25, t + 0.16);
}

export function warn() {
  if (!ready() || !throttle('warn', 0.25)) return;
  tone('square', 880, 880, 0.06, 0.07);
}

export function ding() {
  if (!ready() || !throttle('ding', 0.15)) return;
  tone('sine', 1318, 1318, 0.25, 0.1);
  tone('sine', 1975, 1975, 0.2, 0.04);
}

export function click() {
  if (!ready() || !throttle('click', 0.05)) return;
  tone('triangle', 700, 1100, 0.06, 0.12);
}

export function win(stars = 3) {
  if (!ready() || !throttle('win', 0.5)) return;
  const t = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5].slice(0, 2 + stars);
  notes.forEach((f, i) => {
    tone('triangle', f, f, 0.3, 0.16, t + i * 0.11);
    tone('sine', f * 2, f * 2, 0.25, 0.05, t + i * 0.11);
  });
}

export function lose() {
  if (!ready() || !throttle('lose', 0.5)) return;
  const t = ctx.currentTime;
  [392, 330, 262].forEach((f, i) => tone('sawtooth', f, f * 0.97, 0.3, 0.1, t + i * 0.18));
  noise(0.6, 0.3, 'lowpass', 900, 100, 0.7, t);
}

// Thunder: a crack (close strikes) and a long low rumble. near 0..1.
export function thunder(near = 1) {
  if (!ready() || !throttle('thunder', 0.2)) return;
  const t = ctx.currentTime;
  if (near > 0.6) noise(0.25, 0.7 * near, 'highpass', 1800, 900, 0.7, t);
  noise(1.8 + near, 0.55 * Math.max(0.3, near), 'lowpass', 500, 60, 0.6, t + (near > 0.6 ? 0.05 : 0.3));
  tone('sine', 55, 30, 1.2, 0.3 * near, t + 0.05);
}

// Lightning about to strike: an electric crackle.
export function crackle() {
  if (!ready() || !throttle('crackle', 0.3)) return;
  const t = ctx.currentTime;
  for (let i = 0; i < 6; i++) noise(0.04, 0.14, 'bandpass', 3000 + Math.random() * 3000, 2000, 3, t + i * 0.09 + Math.random() * 0.04);
  tone('sawtooth', 120, 240, 0.6, 0.04, t);
}

// A floodlight tower cutting out (or back in).
export function clunk(level = 1) {
  if (!ready() || !throttle('clunk', 0.2)) return;
  tone('square', 70, 50, 0.15, 0.18 * level);
  noise(0.1, 0.2 * level, 'lowpass', 900, 200, 1);
}

// Phone vibration where supported (not iOS Safari). ms or a pattern.
export function buzz(pattern) {
  if (!CONFIG.feel.haptics || muted) return;
  try { navigator.vibrate?.(pattern); } catch { /* not allowed */ }
}
