// Canvas renderer. A camera follows the player around an arena larger than
// the screen; a minimap shows the whole arena.
import { CONFIG } from '../config.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const r = { canvas, ctx, scale: 1, ox: 0, oy: 0, dpr: 1, w: 0, h: 0, inset: null };
  const resize = () => {
    r.dpr = Math.min(window.devicePixelRatio || 1, CONFIG.render.maxDpr);
    r.w = window.innerWidth;
    r.h = window.innerHeight;
    canvas.width = Math.round(r.w * r.dpr);
    canvas.height = Math.round(r.h * r.dpr);
    const C = CONFIG.camera;
    r.scale = Math.min(r.h / C.viewHeight, r.w / C.minViewWidth);
    r.inset = safeInsets();
  };
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  resize();
  return r;
}

const RIM = 0.35; // visible wall rim in meters

// Ease the camera toward a point a little ahead of the player, clamped so the
// view stays over the arena. snap=true jumps straight there (new game).
export function updateCamera(r, cam, player, dt, snap = false) {
  const C = CONFIG.camera;
  const { width: W, height: H } = CONFIG.arena;
  const p = player.body.getPosition();
  const v = player.body.getLinearVelocity();
  let tx = p.x + v.x * C.lookAhead;
  let ty = p.y + v.y * C.lookAhead;
  const hw = r.w / 2 / r.scale, hh = r.h / 2 / r.scale;
  const clamp = (t, half, size) => (2 * half >= size + 2 * RIM + 2
    ? size / 2
    : Math.min(Math.max(t, half - RIM - 1), size - half + RIM + 1));
  tx = clamp(tx, hw, W);
  ty = clamp(ty, hh, H);
  const k = snap ? 1 : 1 - Math.exp(-C.follow * dt);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
}

// Reads env(safe-area-inset-*) (notches) via a probe element.
let probe = null;
function safeInsets() {
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.appendChild(probe);
  }
  const cs = getComputedStyle(probe);
  return {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  };
}

function drawTerrain(ctx) {
  const T = CONFIG.terrain;
  for (const z of T.zones) {
    const x = z.x - z.w / 2, y = z.y - z.h / 2;
    if (z.type === 'ice') {
      ctx.fillStyle = 'rgba(150, 215, 255, 0.16)';
      roundRect(ctx, x, y, z.w, z.h, 0.6);
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = 'rgba(210, 240, 255, 0.18)';
      ctx.lineWidth = 0.12;
      ctx.beginPath();
      for (let d = -z.h; d < z.w; d += 1.1) {
        ctx.moveTo(x + d, y + z.h);
        ctx.lineTo(x + d + z.h, y);
      }
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = 'rgba(170, 225, 255, 0.45)';
    } else if (z.type === 'mud') {
      ctx.fillStyle = 'rgba(120, 82, 44, 0.55)';
      roundRect(ctx, x, y, z.w, z.h, 0.9);
      ctx.fill();
      ctx.fillStyle = 'rgba(70, 46, 22, 0.55)';
      // Deterministic speckles so they don't flicker.
      for (let i = 0; i < 40; i++) {
        const px = x + 0.4 + ((i * 7.31) % (z.w - 0.8));
        const py = y + 0.4 + ((i * 3.77) % (z.h - 0.8));
        ctx.beginPath();
        ctx.arc(px, py, 0.12 + (i % 3) * 0.06, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(150, 105, 60, 0.6)';
    } else {
      continue;
    }
    ctx.lineWidth = 0.06;
    roundRect(ctx, x, y, z.w, z.h, z.type === 'mud' ? 0.9 : 0.6);
    ctx.stroke();
  }
  for (const b of T.blocks) {
    const x = b.x - b.w / 2, y = b.y - b.h / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(ctx, x + 0.1, y + 0.14, b.w, b.h, 0.15);
    ctx.fill();
    ctx.fillStyle = '#3d4352';
    roundRect(ctx, x, y, b.w, b.h, 0.15);
    ctx.fill();
    ctx.fillStyle = '#4b5263';
    roundRect(ctx, x + 0.1, y + 0.1, b.w - 0.2, b.h - 0.2, 0.1);
    ctx.fill();
  }
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
  const cam = game.camera;
  r.ox = r.w / 2 - cam.x * scale;
  r.oy = r.h / 2 - cam.y * scale;
  // Visible world rect (plus a margin) for culling.
  const m = 2;
  const view = {
    x0: cam.x - r.w / 2 / scale - m, x1: cam.x + r.w / 2 / scale + m,
    y0: cam.y - r.h / 2 / scale - m, y1: cam.y + r.h / 2 / scale + m,
  };
  const visible = (p) => p.x > view.x0 && p.x < view.x1 && p.y > view.y0 && p.y < view.y1;

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

  drawTerrain(ctx);

  // Primed groups (matched but waiting for the player): faint dashed links.
  ctx.lineCap = 'round';
  ctx.setLineDash([0.25, 0.3]);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 0.14;
  ctx.beginPath();
  for (const [a, b, same] of game.matchInfo.links) {
    if (!same || !a.primed) continue;
    const pa = a.body.getPosition(), pb = b.body.getPosition();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Links within counting-down groups.
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

  // Chain mode: the player's links into a counting-down group.
  if (game.matchInfo.playerLinks.length) {
    const pp = game.player.body.getPosition();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 0.26;
    ctx.beginPath();
    for (const car of game.matchInfo.playerLinks) {
      const p = car.body.getPosition();
      ctx.moveTo(pp.x, pp.y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  // Cars.
  const now = game.elapsed;
  const repairColor = CONFIG.features.damage ? game.repairColor : -1;
  const base = ctx.getTransform();
  for (const car of game.cars) {
    if (!visible(car.body.getPosition())) continue;
    drawCar(ctx, car, L, CW, now, repairColor);
    ctx.setTransform(base);
  }
  if (game.player) drawPlayer(ctx, game.player, L, CW, game);
  ctx.setTransform(base);

  // Particles.
  for (const p of fx.particles) {
    if (!visible(p)) continue;
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
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;

  if (debug) drawDebug(ctx, game);

  ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
  drawMinimap(ctx, r, game, view, m);
}

function drawMinimap(ctx, r, game, view, margin) {
  const mw = CONFIG.render.minimapWidth;
  if (!mw) return;
  const { width: W, height: H } = CONFIG.arena;
  const k = mw / W;
  const mh = H * k;
  const x0 = 10 + r.inset.left;
  const y0 = 56 + r.inset.top;
  ctx.save();
  ctx.translate(x0, y0);
  ctx.fillStyle = 'rgba(10,11,15,0.6)';
  roundRect(ctx, -4, -4, mw + 8, mh + 8, 6);
  ctx.fill();
  ctx.scale(k, k);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(0, 0, W, H);
  for (const z of CONFIG.terrain.zones) {
    ctx.fillStyle = z.type === 'ice' ? 'rgba(150,215,255,0.25)' : 'rgba(140,95,50,0.5)';
    ctx.fillRect(z.x - z.w / 2, z.y - z.h / 2, z.w, z.h);
  }
  ctx.fillStyle = '#5a6172';
  for (const b of CONFIG.terrain.blocks) ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
  const dot = 1.3;
  for (const car of game.cars) {
    const p = car.body.getPosition();
    ctx.fillStyle = car.junk ? '#5d6270' : CONFIG.colors[car.color];
    ctx.fillRect(p.x - dot / 2, p.y - dot / 2, dot, dot);
  }
  if (game.player) {
    const p = game.player.body.getPosition();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  // Current view.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 0.35;
  ctx.strokeRect(
    Math.max(0, view.x0 + margin), Math.max(0, view.y0 + margin),
    Math.min(W, view.x1 - margin) - Math.max(0, view.x0 + margin),
    Math.min(H, view.y1 - margin) - Math.max(0, view.y0 + margin),
  );
  ctx.restore();
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

function drawCar(ctx, car, L, CW, now, repairColor) {
  let tint = 0;
  if (car.groupId >= 0) {
    const t = Math.min(1, car.matchTimer / CONFIG.match.delay);
    tint = 0.25 + 0.55 * t * (0.6 + 0.4 * Math.sin(now * 40));
  } else if (car.flash > 0) {
    tint = car.flash * 0.8;
  } else if (car.primed) {
    tint = 0.14 + 0.12 * Math.sin(now * 5); // slow "breathing": bump me to set it off
  }
  place(ctx, car.body);
  if (car.junk) {
    drawJunk(ctx, L, CW);
    return;
  }
  // Tagged by the player: orange outline that fades as the tag runs out.
  if (car.tag > 0 && CONFIG.match.mode === 'tagged') {
    ctx.strokeStyle = `rgba(255,159,28,${0.25 + 0.75 * Math.min(1, car.tag / CONFIG.match.tagTime)})`;
    ctx.lineWidth = 0.14;
    roundRect(ctx, -L / 2 - 0.1, -CW / 2 - 0.1, L + 0.2, CW + 0.2, 0.3);
    ctx.stroke();
  }
  carBody(ctx, L, CW, CONFIG.colors[car.color], 'rgba(15,18,26,0.55)');
  // Rusting in a pile-up: browns over, and the outline blinks near the end.
  if (car.rust > 0) {
    const r = Math.min(1, car.rust / car.rustAt);
    ctx.globalAlpha = 0.65 * r;
    ctx.fillStyle = '#7a5a40';
    roundRect(ctx, -L / 2, -CW / 2, L, CW, 0.22);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (r > 0.5 && Math.sin(now * 14) > 0) {
      ctx.strokeStyle = '#ff9f1c';
      ctx.lineWidth = 0.1;
      roundRect(ctx, -L / 2 - 0.06, -CW / 2 - 0.06, L + 0.12, CW + 0.12, 0.26);
      ctx.stroke();
    }
  }
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
  // Repair color: white cross on the roof.
  if (repairColor >= 0 && car.color === repairColor) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-L * 0.28, -0.07, 0.5, 0.14);
    ctx.fillRect(-L * 0.28 + 0.18, -0.25, 0.14, 0.5);
  }
}

function drawJunk(ctx, L, CW) {
  carBody(ctx, L, CW, '#5d6270', 'rgba(15,18,26,0.6)');
  ctx.fillStyle = '#7a5a40';
  ctx.beginPath();
  ctx.arc(-L * 0.2, CW * 0.15, 0.16, 0, Math.PI * 2);
  ctx.arc(L * 0.3, -CW * 0.2, 0.12, 0, Math.PI * 2);
  ctx.arc(-L * 0.38, -CW * 0.25, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,22,28,0.7)';
  ctx.lineWidth = 0.06;
  ctx.beginPath();
  ctx.moveTo(-L * 0.45, CW * 0.35);
  ctx.lineTo(-L * 0.1, -CW * 0.1);
  ctx.lineTo(L * 0.05, CW * 0.3);
  ctx.stroke();
}

function drawPlayer(ctx, pc, L, CW, game) {
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
  if (CONFIG.features.damage) {
    // Dents darken the body as health drops; red flash when hit or squeezed.
    const wear = 1 - Math.max(0, game.health) / CONFIG.damage.maxHealth;
    if (wear > 0.05) {
      ctx.fillStyle = `rgba(40,30,30,${0.45 * wear})`;
      ctx.beginPath();
      ctx.arc(-L * 0.25, CW * 0.2, 0.3 * wear + 0.1, 0, Math.PI * 2);
      ctx.arc(L * 0.35, -CW * 0.25, 0.25 * wear + 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
    if (game.hurtFlash > 0) {
      ctx.globalAlpha = Math.min(0.7, game.hurtFlash);
      ctx.fillStyle = '#ff3b3b';
      roundRect(ctx, -L / 2, -CW / 2, L, CW, 0.22);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  if (pc.reversing) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-L / 2 - 0.08, -CW * 0.42, 0.12, 0.22);
    ctx.fillRect(-L / 2 - 0.08, CW * 0.2, 0.12, 0.22);
  }
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
