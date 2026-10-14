// Particles, floating score text, and screen shake. World units (meters).
import { CONFIG } from '../config.js';

export function createEffects() {
  return { particles: [], texts: [], shake: 0 };
}

export function burst(fx, x, y, color, count, speed = 7, life = 0.6, size = 0.22) {
  const max = CONFIG.fx.maxParticles;
  for (let i = 0; i < count; i++) {
    if (fx.particles.length >= max) fx.particles.shift();
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    fx.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: life * (0.6 + Math.random() * 0.4),
      max: life,
      size: size * (0.6 + Math.random() * 0.8),
      color,
    });
  }
}

export function floatText(fx, x, y, text, color = '#ffffff') {
  fx.texts.push({ x, y, text, color, life: 1.0 });
}

export function addShake(fx, amount) {
  fx.shake = Math.min(CONFIG.fx.shakeMax, fx.shake + amount);
}

export function updateEffects(fx, dt) {
  const ps = fx.particles;
  let j = 0;
  const drag = Math.exp(-4 * dt);
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    p.life -= dt;
    if (p.life <= 0) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= drag;
    p.vy *= drag;
    ps[j++] = p;
  }
  ps.length = j;

  fx.texts = fx.texts.filter((t) => {
    t.life -= dt;
    t.y -= 1.2 * dt;
    return t.life > 0;
  });

  fx.shake *= Math.exp(-CONFIG.fx.shakeDecay * dt);
  if (fx.shake < 0.002) fx.shake = 0;
}
