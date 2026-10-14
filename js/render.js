// Canvas renderer. The whole arena is scaled to fit the screen.
import { CONFIG } from '../config.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const r = { canvas, ctx, scale: 1, ox: 0, oy: 0, dpr: 1, w: 0, h: 0 };
  const resize = () => {
    r.dpr = Math.min(window.devicePixelRatio || 1, CONFIG.render.maxDpr);
    r.w = window.innerWidth;
    r.h = window.innerHeight;
    canvas.width = Math.round(r.w * r.dpr);
    canvas.height = Math.round(r.h * r.dpr);
    const { width: W, height: H } = CONFIG.arena;
    const pad = 0.35; // visible wall rim in meters
    const top = CONFIG.render.hudTopPx;
    const availW = r.w - 12;
    const availH = r.h - top - 8;
    r.scale = Math.min(availW / (W + 2 * pad), availH / (H + 2 * pad));
    r.ox = (r.w - W * r.scale) / 2;
    // Spare vertical space goes below the arena first, so the boost button
    // doesn't cover a corner; anything beyond that is split evenly.
    const spare = availH - H * r.scale;
    const below = Math.min(spare, CONFIG.render.boostReservePx);
    r.oy = top + (spare - below) / 2;
  };
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  resize();
  return r;
}

function roundRect(ctx, x, y, w, h, rad) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, rad);
  else ctx.rect(x, y, w, h);
}

export function render(r, game, debug) {
  const { ctx, scale } = r;
  const { width: W, height: H } = CONFIG.arena;
  const { length: L, width: CW } = CONFIG.car;
  const fx = game.fx;

  ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
  ctx.fillStyle = '#14161c';
  ctx.fillRect(0, 0, r.w, r.h);

  let sx = 0, sy = 0;
  if (fx.shake > 0) {
    sx = (Math.random() * 2 - 1) * fx.shake;
    sy = (Math.random() * 2 - 1) * fx.shake;
  }
  ctx.setTransform(r.dpr * scale, 0, 0, r.dpr * scale, r.dpr * (r.ox + sx * scale), r.dpr * (r.oy + sy * scale));

  // Arena floor, grid, rim.
  ctx.fillStyle = '#2a2e3a';
  roundRect(ctx, -0.35, -0.35, W + 0.7, H + 0.7, 0.5);
  ctx.fill();
  ctx.fillStyle = '#20232c';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 0.04;
  ctx.beginPath();
  for (let x = 2; x < W; x += 2) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 2; y < H; y += 2) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();

  // Links within pending groups.
  ctx.lineCap = 'round';
  for (const [a, b, same] of game.matchInfo.links) {
    if (!same || a.groupId < 0) continue;
    const pa = a.body.getPosition(), pb = b.body.getPosition();
    const t = Math.min(1, Math.max(a.matchTimer, b.matchTimer) / CONFIG.match.delay);
    ctx.strokeStyle = `rgba(255,255,255,${0.35 + 0.5 * t})`;
    ctx.lineWidth = 0.18 + 0.12 * t;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }

  // Cars.
  const now = game.elapsed;
  const base = ctx.getTransform();
  for (const car of game.cars) {
    drawCar(ctx, car, L, CW, now);
    ctx.setTransform(base);
  }
  if (game.player) drawPlayer(ctx, game.player, L, CW);
  ctx.setTransform(base);

  // Particles.
  for (const p of fx.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  // Floating score text.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 0.9px system-ui, sans-serif';
  for (const t of fx.texts) {
    ctx.globalAlpha = Math.min(1, t.life * 2);
    ctx.fillStyle = '#000';
    ctx.fillText(t.text, t.x + 0.05, t.y + 0.05);
    ctx.fillStyle = '#fff';
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;

  if (debug) drawDebug(ctx, game);
}

function carBody(ctx, L, CW, fill, glass) {
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  roundRect(ctx, -L / 2 + 0.08, -CW / 2 + 0.1, L, CW, 0.22);
  ctx.fill();
  ctx.fillStyle = fill;
  roundRect(ctx, -L / 2, -CW / 2, L, CW, 0.22);
  ctx.fill();
  ctx.fillStyle = glass;
  ctx.fillRect(L * 0.08, -CW * 0.36, L * 0.22, CW * 0.72);
}

function place(ctx, body) {
  const p = body.getPosition();
  const a = body.getAngle();
  const c = Math.cos(a), s = Math.sin(a);
  ctx.transform(c, s, -s, c, p.x, p.y);
}

function drawCar(ctx, car, L, CW, now) {
  let tint = 0;
  if (car.groupId >= 0) {
    const t = Math.min(1, car.matchTimer / CONFIG.match.delay);
    tint = 0.25 + 0.55 * t * (0.6 + 0.4 * Math.sin(now * 40));
  } else if (car.flash > 0) {
    tint = car.flash * 0.8;
  }
  place(ctx, car.body);
  carBody(ctx, L, CW, CONFIG.colors[car.color], 'rgba(15,18,26,0.55)');
  if (tint > 0) {
    ctx.globalAlpha = tint;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, -L / 2, -CW / 2, L, CW, 0.22);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (car.stun > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(-L * 0.4, -CW * 0.36, L * 0.28, CW * 0.72);
  }
}

function drawPlayer(ctx, pc, L, CW) {
  const p = pc.body.getPosition();

  // Stuck warning ring.
  if (pc.stuckTimer > 0.15) {
    const t = Math.min(1, pc.stuckTimer / CONFIG.stuck.time);
    ctx.strokeStyle = `rgba(255,80,80,${0.4 + 0.6 * t})`;
    ctx.lineWidth = 0.18;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.45, -Math.PI / 2, -Math.PI / 2 + t * Math.PI * 2);
    ctx.stroke();
  }

  place(ctx, pc.body);
  if (pc.boostTime > 0) {
    ctx.fillStyle = Math.random() < 0.5 ? '#ffb347' : '#ff6b1c';
    ctx.beginPath();
    ctx.moveTo(-L / 2, -CW * 0.3);
    ctx.lineTo(-L / 2 - 0.6 - Math.random() * 0.5, 0);
    ctx.lineTo(-L / 2, CW * 0.3);
    ctx.fill();
  }
  carBody(ctx, L, CW, '#f4f5f7', 'rgba(15,18,26,0.75)');
  ctx.fillStyle = '#ff9f1c';
  ctx.fillRect(-L / 2, -0.12, L * 0.58, 0.24);
  ctx.fillRect(L * 0.3, -0.12, L * 0.2, 0.24);
}

function drawDebug(ctx, game) {
  ctx.lineWidth = 0.04;
  for (let b = game.world.getBodyList(); b; b = b.getNext()) {
    const xf = b.getTransform();
    for (let f = b.getFixtureList(); f; f = f.getNext()) {
      const shape = f.getShape();
      if (shape.getType() !== 'polygon') continue;
      const vs = shape.m_vertices;
      ctx.strokeStyle = f.isSensor() ? 'rgba(0,255,255,0.6)' : 'rgba(0,255,0,0.9)';
      ctx.setLineDash(f.isSensor() ? [0.12, 0.12] : []);
      ctx.beginPath();
      for (let i = 0; i < vs.length; i++) {
        const v = vs[i];
        const x = xf.p.x + xf.q.c * v.x - xf.q.s * v.y;
        const y = xf.p.y + xf.q.s * v.x + xf.q.c * v.y;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  for (const [a, b, same] of game.matchInfo.links) {
    const pa = a.body.getPosition(), pb = b.body.getPosition();
    ctx.strokeStyle = same ? '#ffff00' : 'rgba(160,160,160,0.8)';
    ctx.lineWidth = 0.06;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }
  ctx.font = 'bold 0.5px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  for (const car of game.cars) {
    if (car.groupId < 0) continue;
    const p = car.body.getPosition();
    ctx.fillText(`g${car.groupId} ${car.matchTimer.toFixed(2)}`, p.x, p.y - 0.9);
  }
}
