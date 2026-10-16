// Weather and atmosphere: sun, rain, storms with lightning, snow, night
// under stadium lights, wind and fog. Each is a preset in CONFIG.weather and
// they combine ('night+rain'). Gameplay comes through three hooks: ground
// grip (terrain.setGround), wind drift (physics.wind), and lightning strikes.
// Everything else is atmosphere.
import { CONFIG } from '../config.js';
import { wind, windFactor } from './physics.js';
import { setGround } from './terrain.js';
import { stunAI } from './ai.js';
import { shock } from './damage.js';
import { burst, floatText, addShake } from './effects.js';
import * as sfx from './audio.js';

const pl = window.planck;
const rand = (a, b) => a + Math.random() * (b - a);
const range = ([a, b]) => rand(a, b);
const TAU = Math.PI * 2;
// Precipitation lives in a tile bigger than the view, wrapped around the
// camera, so it scrolls with the world without spawning/despawning.
const TILE_W = 48, TILE_H = 30;
const mod = (a, n) => ((a % n) + n) % n;

// Merge preset names ('night+rain') into one spec. Numbers take the max,
// ground multipliers multiply.
export function weatherSpec(name) {
  const P = CONFIG.weather.presets;
  const parts = String(name || 'clear').split('+').map((s) => s.trim()).filter((n) => P[n] && n !== 'clear');
  const spec = { ground: {}, labels: [], icons: [] };
  for (const n of parts) {
    for (const [k, v] of Object.entries(P[n])) {
      if (k === 'ground') for (const [gk, gv] of Object.entries(v)) spec.ground[gk] = (spec.ground[gk] ?? 1) * gv;
      else if (k === 'label') spec.labels.push(v);
      else if (k === 'icon') spec.icons.push(v);
      else if (typeof v === 'number') spec[k] = Math.max(spec[k] ?? 0, v);
      else spec[k] = v;
    }
  }
  spec.name = parts.join('+') || 'clear';
  spec.label = spec.labels.join(' · ');
  spec.short = spec.labels.map((l) => l.split(':')[0]).join(' + ');
  spec.icon = spec.icons.join('');
  return spec;
}

// Random ellipses that stay clear of blocks, zones, each other and the
// player's start.
function placePatches(list, type, count, rxRange, ryRange) {
  const T = CONFIG.terrain;
  const { width: W, height: H } = CONFIG.arena;
  const rects = [...T.blocks, ...T.zones];
  for (let made = 0, tries = 0; made < count && tries < 400; tries++) {
    const rx = rand(...rxRange), ry = rand(...ryRange);
    const x = rand(rx + 1, W - rx - 1), y = rand(ry + 1, H - ry - 1);
    if (Math.hypot(x - W * 0.2, y - H / 2) < 4) continue;
    if (rects.some((b) => Math.abs(x - b.x) < b.w / 2 + rx + 0.4 && Math.abs(y - b.y) < b.h / 2 + ry + 0.4)) continue;
    if (list.some((p) => Math.abs(x - p.x) < p.rx + rx + 1 && Math.abs(y - p.y) < p.ry + ry + 1)) continue;
    list.push({ type, x, y, rx, ry, a: rand(-0.4, 0.4) });
    made++;
  }
}

export function createWeather(name) {
  const spec = weatherSpec(CONFIG.features.weather ? name : 'clear');
  const C = CONFIG.weather;
  const { width: W, height: H } = CONFIG.arena;
  const w = {
    spec,
    t: 0,
    windAngle: rand(0, TAU),
    windStrength: (spec.wind || 0) * C.wind.base,
    gust: 0,
    gustTimer: range(C.wind.gustEvery),
    drops: [], flakes: [], motes: [], splashes: [], strikes: [], bolts: [], scorches: [], glows: [], clouds: [],
    flash: 0,
    strikeTimer: C.lightning.first,
    sheetTimer: rand(3, 6),
    cover: 0,
    towers: [],
    outageTimer: range(C.night.outageEvery),
    view: null,
    stats: { strikes: 0, zapped: 0, junk: 0 },
  };
  const patches = [];
  placePatches(patches, 'puddle', spec.puddles || 0, [1.2, 2.4], [0.7, 1.3]);
  placePatches(patches, 'drift', spec.drifts || 0, [2, 3.4], [1.1, 1.8]);
  w.patches = patches;
  setGround(spec.ground, patches);

  for (let i = 0; i < Math.round((spec.rain || 0) * 260); i++) {
    w.drops.push({ x: rand(0, TILE_W), y: rand(0, TILE_H), z: rand(0.6, 1) });
  }
  for (let i = 0; i < Math.round((spec.snow || 0) * 300); i++) {
    w.flakes.push({ x: rand(0, TILE_W), y: rand(0, TILE_H), z: rand(0.5, 1), s: rand(0, TAU) });
  }
  if (spec.wind) {
    for (let i = 0; i < 70; i++) {
      w.motes.push({ x: rand(0, TILE_W), y: rand(0, TILE_H), z: rand(0.5, 1), s: rand(0, TAU), leaf: i % 3 === 0 });
    }
  }
  if (spec.sun) {
    for (let i = 0; i < 4; i++) w.clouds.push({ x: rand(0, W + 20) - 10, y: rand(0, H), r: rand(5, 9) });
  }
  if (spec.night) {
    // Four floodlight towers on the corners, each lighting a pool toward the
    // middle; the centre of the arena stays dim.
    for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      w.towers.push({
        x: cx ? W + 0.15 : -0.15, y: cy ? H + 0.15 : -0.15,
        px: cx ? W * 0.76 : W * 0.24, py: cy ? H * 0.73 : H * 0.27,
        level: 1, phase: 'on', t: 0,
      });
    }
  }
  if (!spec.wind) { wind.x = 0; wind.y = 0; }
  return w;
}

// --- simulation ------------------------------------------------------------

export function updateWeather(g, dt) {
  const w = g.weather;
  const spec = w.spec;
  const C = CONFIG.weather;
  w.t += dt;

  if (spec.wind) updateWind(g, w, dt);
  if (spec.lightning) updateLightning(g, w, dt);
  if (spec.night) updateTowers(w, dt);
  if (spec.snow) w.cover = Math.min(1, w.t / C.snowCoverTime);
  w.flash = Math.max(0, w.flash - dt * 3);

  // Precipitation and wind-blown bits move in the tile; the renderer wraps them.
  const wx = wind.x, wy = wind.y;
  for (const d of w.drops) {
    d.x = mod(d.x + (wx * 3) * dt * d.z, TILE_W);
    d.y = mod(d.y + (14 + wy * 3) * dt * d.z, TILE_H);
  }
  for (const f of w.flakes) {
    f.x = mod(f.x + (wx * 2.2 + Math.sin(w.t * 1.3 + f.s) * 0.5) * dt * f.z, TILE_W);
    f.y = mod(f.y + (1.3 + wy * 2.2) * dt * f.z, TILE_H);
  }
  for (const m of w.motes) {
    const k = 5 * m.z;
    m.x = mod(m.x + (wx * k + Math.sin(w.t * 2 + m.s) * 0.3) * dt, TILE_W);
    m.y = mod(m.y + (wy * k + Math.cos(w.t * 1.7 + m.s) * 0.3) * dt, TILE_H);
  }
  for (const c of w.clouds) {
    const { width: W, height: H } = CONFIG.arena;
    c.x += Math.cos(0.35) * 1.1 * dt;
    c.y += Math.sin(0.35) * 1.1 * dt;
    if (c.x - c.r > W + 2) c.x = -c.r - 2;
    if (c.y - c.r > H + 2) c.y = -c.r - 2;
  }

  // Rain splashes: little rings across the view, more in puddles.
  if (spec.rain && w.view) {
    const v = w.view;
    const n = spec.rain * 40 * dt;
    for (let i = 0; i < n + (Math.random() < n % 1 ? 1 : 0); i++) {
      w.splashes.push({ x: rand(v.x0, v.x1), y: rand(v.y0, v.y1), life: 0.35, max: 0.35, r: rand(0.12, 0.25) });
    }
    for (const p of w.patches) {
      if (p.type === 'puddle' && Math.random() < spec.rain * 6 * dt) {
        const a = rand(0, TAU), r = Math.sqrt(Math.random());
        w.splashes.push({ x: p.x + Math.cos(a) * p.rx * r * 0.85, y: p.y + Math.sin(a) * p.ry * r * 0.85, life: 0.7, max: 0.7, r: 0.4 });
      }
    }
  }
  age(w.splashes, dt);
  age(w.bolts, dt);
  age(w.scorches, dt);
  age(w.glows, dt);

  // Spray when the player tears through a puddle; powder through a drift.
  const pb = g.player.body;
  const pp = pb.getPosition();
  const sp = pb.getLinearVelocity().length();
  if (sp > 3) {
    for (const p of w.patches) {
      if (((pp.x - p.x) / p.rx) ** 2 + ((pp.y - p.y) / p.ry) ** 2 > 1) continue;
      if (Math.random() < 0.6) burst(g.fx, pp.x, pp.y, p.type === 'puddle' ? '#9cc7ee' : '#f2f6ff', 1, 3, 0.4, 0.14);
    }
  }
}

function age(list, dt) {
  let j = 0;
  for (const e of list) if ((e.life -= dt) > 0) list[j++] = e;
  list.length = j;
}

// Gusts every few seconds; the direction wanders. Every car is pushed toward
// the drift velocity (force = m * damping * drift, so a free-rolling car
// settles at exactly that speed), and tire grip lets them slide with it.
function updateWind(g, w, dt) {
  const C = CONFIG.weather.wind;
  const base = C.base * w.spec.wind;
  if ((w.gustTimer -= dt) <= 0) {
    w.gust = C.gustTime;
    w.gustTimer = range(C.gustEvery) + C.gustTime;
    w.windAngle += rand(-0.5, 0.5);
  }
  if (w.gust > 0) w.gust -= dt;
  const target = base * (w.gust > 0 ? C.gustMult : 1);
  w.windStrength += (target - w.windStrength) * (1 - Math.exp(-C.response * dt));
  w.windAngle += Math.sin(w.t * 0.13) * 0.03 * dt;
  wind.x = Math.cos(w.windAngle) * w.windStrength;
  wind.y = Math.sin(w.windAngle) * w.windStrength;

  const push = (car) => {
    const b = car.body;
    const k = b.getMass() * b.getLinearDamping() * windFactor(car);
    b.applyForceToCenter(pl.Vec2(wind.x * k, wind.y * k), true);
  };
  for (const car of g.cars) push(car);
  push(g.player);
}

// Lightning: a warning ring where it will land, then the strike. Half the
// strikes go for where the player is headed, some for junk, the rest anywhere.
function updateLightning(g, w, dt) {
  const L = CONFIG.weather.lightning;
  if ((w.strikeTimer -= dt) <= 0) {
    w.strikeTimer = range(L.every);
    w.strikes.push({ ...strikeTarget(g), t: L.warn });
    sfx.crackle();
  }
  let j = 0;
  for (const s of w.strikes) {
    if ((s.t -= dt) <= 0) strike(g, s.x, s.y);
    else w.strikes[j++] = s;
  }
  w.strikes.length = j;
  // Distant sheet lightning: a flicker and a low rumble, no strike.
  if ((w.sheetTimer -= dt) <= 0) {
    w.sheetTimer = rand(4, 9);
    w.flash = Math.max(w.flash, 0.3);
    sfx.thunder(0.35);
  }
}

function strikeTarget(g) {
  const L = CONFIG.weather.lightning;
  const { width: W, height: H } = CONFIG.arena;
  const r = Math.random();
  let x, y;
  const junk = g.cars.filter((c) => c.junk);
  if (r < L.nearPlayer) {
    const b = g.player.body;
    const p = b.getPosition(), v = b.getLinearVelocity();
    const lead = rand(0, 0.8), a = rand(0, TAU), d = rand(0, 2.5);
    x = p.x + v.x * lead + Math.cos(a) * d;
    y = p.y + v.y * lead + Math.sin(a) * d;
  } else if (junk.length && r < L.nearPlayer + L.onJunk) {
    const p = junk[Math.floor(Math.random() * junk.length)].body.getPosition();
    x = p.x;
    y = p.y;
  } else {
    x = rand(2, W - 2);
    y = rand(2, H - 2);
  }
  return { x: Math.min(W - 1.5, Math.max(1.5, x)), y: Math.min(H - 1.5, Math.max(1.5, y)) };
}

// A jagged bolt from above the view down to (x, y), with a branch or two.
function boltPath(x, y) {
  const pts = [[x, y]];
  let px = x, py = y;
  const top = y - 18;
  while (py > top) {
    py -= rand(0.6, 1.4);
    px += rand(-0.7, 0.7);
    pts.push([px, py]);
  }
  const branches = [];
  for (let b = 0; b < 2; b++) {
    const i = 2 + Math.floor(Math.random() * (pts.length - 4));
    let [bx, by] = pts[i];
    const dir = Math.random() < 0.5 ? -1 : 1;
    const br = [[bx, by]];
    for (let k = 0; k < 4; k++) {
      bx += dir * rand(0.3, 0.9);
      by += rand(0.2, 0.9);
      br.push([bx, by]);
    }
    branches.push(br);
  }
  return { pts, branches };
}

// The strike itself: shove and stun cars nearby, destroy junk in range, and
// hurt the player if they didn't get clear.
export function strike(g, x, y) {
  const L = CONFIG.weather.lightning;
  const w = g.weather;
  w.stats.strikes++;
  w.bolts.push({ x, y, life: 0.3, max: 0.3, ...boltPath(x, y) });
  w.flash = 1;
  w.scorches.push({ x, y, life: 12, max: 12 });
  w.glows.push({ x, y, r: 9, life: 0.6, max: 0.6, color: '#bcd8ff' });
  sfx.thunder(1);
  sfx.buzz(80);
  addShake(g.fx, 0.25);
  burst(g.fx, x, y, '#cfe8ff', 22, 10, 0.5, 0.2);
  burst(g.fx, x, y, '#ffffff', 10, 6, 0.3, 0.16);

  let junk = 0;
  for (const car of g.cars) {
    const p = car.body.getPosition();
    const dx = p.x - x, dy = p.y - y;
    const d = Math.hypot(dx, dy);
    if (d >= L.radius) continue;
    if (car.junk) {
      car.dead = true;
      burst(g.fx, p.x, p.y, '#8a8f99', 10, 7, 0.6, 0.26);
      g.world.destroyBody(car.body);
      junk++;
      continue;
    }
    const k = (L.shove * (1 - d / L.radius) * car.body.getMass()) / Math.max(d, 0.3);
    car.body.applyLinearImpulse(pl.Vec2(dx * k, dy * k), car.body.getWorldCenter(), true);
    stunAI(car);
    car.flash = 1;
  }
  if (junk) {
    g.cars = g.cars.filter((c) => !c.dead);
    if (g.player.towed?.dead) {
      g.player.towed = null;
      g.player.towJoint = null;
      g.player.abilityTime = 0;
    }
    g.score += junk * CONFIG.pileup.pointsPerJunk;
    g.stats.junk += junk;
    w.stats.junk += junk;
    floatText(g.fx, x, y - 1, `Lightning cleared ${junk} junk`, '#c9ced8');
  }

  const pb = g.player.body;
  const pp = pb.getPosition();
  const d = Math.hypot(pp.x - x, pp.y - y);
  if (d < L.radius) {
    const k = (L.shove * 0.5 * (1 - d / L.radius) * pb.getMass()) / Math.max(d, 0.3);
    pb.applyLinearImpulse(pl.Vec2((pp.x - x) * k, (pp.y - y) * k), pb.getWorldCenter(), true);
  }
  if (d < L.hitRadius) {
    w.stats.zapped++;
    g.player.skid = L.skid;
    g.player.skidGrip = 0.15;
    shock(g, L.damage);
  }
}

// Stadium lights: now and then one tower flickers out for a few seconds.
function updateTowers(w, dt) {
  const N = CONFIG.weather.night;
  if ((w.outageTimer -= dt) <= 0) {
    w.outageTimer = range(N.outageEvery);
    const on = w.towers.filter((t) => t.phase === 'on');
    if (on.length) {
      const t = on[Math.floor(Math.random() * on.length)];
      t.phase = 'flickerOut';
      t.t = 1.2;
    }
  }
  for (const t of w.towers) {
    if (t.phase === 'on') { t.level = 1; continue; }
    t.t -= dt;
    if (t.phase === 'flickerOut') {
      t.level = Math.random() < 0.5 ? 1 : 0.15;
      if (t.t <= 0) { t.phase = 'off'; t.t = N.outageTime; sfx.clunk(); }
    } else if (t.phase === 'off') {
      t.level = 0;
      if (t.t <= 0) { t.phase = 'flickerIn'; t.t = 0.6; }
    } else if (t.phase === 'flickerIn') {
      t.level = Math.random() < 0.6 ? 1 : 0.2;
      if (t.t <= 0) { t.phase = 'on'; t.level = 1; sfx.clunk(0.5); }
    }
  }
}

// Explosions light up the dark.
export function weatherExplosion(g, x, y, color) {
  if (!g.weather) return;
  g.weather.glows.push({ x, y, r: 7, life: 0.6, max: 0.6, color });
}

// --- rendering -------------------------------------------------------------

function ellipse(ctx, p, sx = 1, sy = 1) {
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, p.rx * sx, p.ry * sy, p.a || 0, 0, TAU);
}

// Under the cars: snow cover (before terrain, so zones still read on top).
export function drawWeatherFloor(ctx, g) {
  const w = g.weather;
  if (!w?.cover) return;
  const { width: W, height: H } = CONFIG.arena;
  ctx.fillStyle = `rgba(232,238,248,${0.5 * w.cover})`;
  ctx.fillRect(0, 0, W, H);
}

// Under the cars, after terrain: puddles, drifts, scorch marks.
export function drawWeatherGround(ctx, g) {
  const w = g.weather;
  if (!w) return;
  for (const p of w.patches) {
    if (p.type === 'puddle') {
      ctx.fillStyle = 'rgba(60,100,145,0.42)';
      ellipse(ctx, p);
      ctx.fill();
      ctx.strokeStyle = 'rgba(150,195,235,0.35)';
      ctx.lineWidth = 0.06;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(220,235,255,0.25)'; // sheen
      ctx.lineWidth = 0.1;
      ctx.beginPath();
      ctx.ellipse(p.x - p.rx * 0.2, p.y - p.ry * 0.25, p.rx * 0.5, p.ry * 0.35, p.a, Math.PI * 1.1, Math.PI * 1.6);
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(214,222,236,0.9)';
      ellipse(ctx, p);
      ctx.fill();
      ctx.fillStyle = 'rgba(250,252,255,0.95)';
      ellipse(ctx, { ...p, x: p.x - 0.15, y: p.y - 0.15 }, 0.8, 0.7);
      ctx.fill();
    }
  }
  for (const s of w.scorches) {
    const a = Math.min(1, s.life / s.max * 1.5);
    const grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 1.4);
    grd.addColorStop(0, `rgba(10,10,12,${0.6 * a})`);
    grd.addColorStop(1, 'rgba(10,10,12,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(s.x - 1.4, s.y - 1.4, 2.8, 2.8);
  }
}

// Above the cars: warnings, clouds, precipitation, bolts, then the light /
// fog layer and screen effects. Called with the world transform set.
export function drawWeatherSky(ctx, r, g, view) {
  const w = g.weather;
  if (!w) return;
  const spec = w.spec;
  const L = CONFIG.weather.lightning;
  w.view = view;
  const now = g.elapsed;

  // Strike warnings: a pulsing ring that tightens, faster near the end.
  for (const s of w.strikes) {
    const k = 1 - s.t / L.warn;
    const pulse = 0.5 + 0.5 * Math.sin(now * (10 + 30 * k));
    ctx.fillStyle = `rgba(255,236,140,${0.1 + 0.25 * k * pulse})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, L.hitRadius, 0, TAU);
    ctx.fill();
    ctx.setLineDash([0.3, 0.25]);
    ctx.strokeStyle = `rgba(200,225,255,${0.5 + 0.4 * pulse})`;
    ctx.lineWidth = 0.1;
    ctx.beginPath();
    ctx.arc(s.x, s.y, L.radius * (1 - 0.35 * k), 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Cloud shadows drifting over the arena (sun).
  for (const c of w.clouds) {
    const grd = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
    grd.addColorStop(0, 'rgba(0,0,10,0.26)');
    grd.addColorStop(1, 'rgba(0,0,10,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);
  }

  // Splash rings.
  ctx.lineWidth = 0.04;
  for (const s of w.splashes) {
    const k = 1 - s.life / s.max;
    ctx.strokeStyle = `rgba(200,222,255,${0.45 * (1 - k)})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r * (0.3 + k), 0, TAU);
    ctx.stroke();
  }

  const wx = (x) => view.x0 + mod(x - view.x0, TILE_W);
  const wy = (y) => view.y0 + mod(y - view.y0, TILE_H);
  if (w.drops.length) {
    ctx.strokeStyle = 'rgba(185,205,240,0.38)';
    ctx.lineWidth = 0.035;
    ctx.beginPath();
    for (const d of w.drops) {
      const x = wx(d.x), y = wy(d.y);
      if (x > view.x1 || y > view.y1) continue;
      ctx.moveTo(x, y);
      ctx.lineTo(x - wind.x * 0.12 * d.z, y - 0.75 * d.z);
    }
    ctx.stroke();
  }
  if (w.flakes.length) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    for (const f of w.flakes) {
      const x = wx(f.x), y = wy(f.y);
      if (x > view.x1 || y > view.y1) continue;
      const s = 0.05 + 0.07 * f.z;
      ctx.moveTo(x + s, y);
      ctx.arc(x, y, s, 0, TAU);
    }
    ctx.fill();
  }
  if (w.motes.length) {
    const strength = Math.hypot(wind.x, wind.y);
    const max = CONFIG.weather.wind.base * spec.wind * CONFIG.weather.wind.gustMult;
    const a = Math.min(1, strength / max);
    const len = 0.4 + 1.6 * a;
    const ux = wind.x / (strength || 1), uy = wind.y / (strength || 1);
    ctx.strokeStyle = `rgba(230,236,245,${0.08 + 0.22 * a})`;
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    for (const m of w.motes) {
      if (m.leaf) continue;
      const x = wx(m.x), y = wy(m.y);
      if (x > view.x1 || y > view.y1) continue;
      ctx.moveTo(x, y);
      ctx.lineTo(x - ux * len * m.z, y - uy * len * m.z);
    }
    ctx.stroke();
    for (const m of w.motes) {
      if (!m.leaf) continue;
      const x = wx(m.x), y = wy(m.y);
      if (x > view.x1 || y > view.y1) continue;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(now * 4 * m.z + m.s);
      ctx.fillStyle = m.s > Math.PI ? '#b8893f' : '#8fae4a';
      ctx.fillRect(-0.1, -0.05, 0.2, 0.1);
      ctx.restore();
    }
  }

  // Overall tint: gloomy for rain/storms, warm for sun. Flashes cut through.
  if (spec.dark) {
    ctx.fillStyle = `rgba(14,22,40,${spec.dark * (1 - w.flash)})`;
    ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  }
  if (spec.sun) {
    ctx.fillStyle = 'rgba(255,196,110,0.06)';
    ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  }

  if (spec.night) drawLightLayer(ctx, r, g, 'night');
  if (spec.fog) drawLightLayer(ctx, r, g, 'fog');
  if (spec.night) drawTowers(ctx, w);

  // Lightning flash over everything, then the bolt on top of it.
  if (w.flash > 0) {
    ctx.fillStyle = `rgba(225,235,255,${0.45 * w.flash})`;
    ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  }
  // Bolts: a wide glow, then a white core.
  for (const b of w.bolts) {
    const a = b.life / b.max;
    for (const [lw, col] of [[0.45, `rgba(110,160,255,${0.6 * a})`], [0.12, `rgba(255,255,255,${a})`]]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (const line of [b.pts, ...b.branches]) {
        line.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      }
      ctx.stroke();
    }
  }

  if (spec.sun) {
    const m = ctx.getTransform();
    ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
    drawGlare(ctx, r);
    ctx.setTransform(m);
  }
}

// Night darkness or fog, drawn on a half-resolution canvas with holes cut
// out where there's light (or clear air), then laid over the view.
let layer = null, lctx = null;
function drawLightLayer(ctx, r, g, kind) {
  const w = g.weather;
  const K = 0.5;
  const lw = Math.ceil(r.w * K), lh = Math.ceil(r.h * K);
  if (!layer) {
    layer = document.createElement('canvas');
    lctx = layer.getContext('2d');
  }
  if (layer.width !== lw || layer.height !== lh) {
    layer.width = lw;
    layer.height = lh;
  }
  const m = ctx.getTransform();
  const s = (m.a / r.dpr) * K;
  const X = (x) => ((m.a * x + m.e) / r.dpr) * K;
  const Y = (y) => ((m.d * y + m.f) / r.dpr) * K;
  const c = lctx;
  c.globalCompositeOperation = 'source-over';
  c.clearRect(0, 0, lw, lh);
  const N = CONFIG.weather.night;
  const F = CONFIG.weather.fog;
  c.fillStyle = kind === 'night'
    ? `rgba(4,7,18,${N.darkness * (1 - 0.8 * w.flash)})`
    : `rgba(150,160,174,${F.density * (1 - 0.3 * w.flash)})`;
  c.fillRect(0, 0, lw, lh);
  c.globalCompositeOperation = 'destination-out';
  // Cut a soft hole: fully `strength` inside r0, fading to nothing at r1.
  const hole = (x, y, r1, strength, r0 = 0) => {
    if (r1 <= 0) return;
    const cx = X(x), cy = Y(y), R = r1 * s;
    if (cx + R < 0 || cy + R < 0 || cx - R > lw || cy - R > lh) return;
    const grd = c.createRadialGradient(cx, cy, r0 * s, cx, cy, R);
    grd.addColorStop(0, `rgba(0,0,0,${strength})`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = grd;
    c.fillRect(cx - R, cy - R, R * 2, R * 2);
  };
  const pb = g.player.body;
  const pp = pb.getPosition();
  const now = g.elapsed;
  if (kind === 'night') {
    for (const t of w.towers) hole(t.px, t.py, N.poolRadius * (0.4 + 0.6 * t.level), 0.92 * t.level);
    // Headlights: a cone ahead of the player.
    const a = pb.getAngle();
    const len = N.headlight * s;
    c.save();
    c.translate(X(pp.x), Y(pp.y));
    c.rotate(a);
    const grd = c.createRadialGradient(0, 0, 0, 0, 0, len);
    grd.addColorStop(0, 'rgba(0,0,0,0.9)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = grd;
    c.beginPath();
    c.moveTo(0.6 * s, -0.35 * s);
    c.lineTo(len, -len * 0.45);
    c.lineTo(len, len * 0.45);
    c.lineTo(0.6 * s, 0.35 * s);
    c.closePath();
    c.fill();
    c.restore();
    hole(pp.x, pp.y, 2.4, 0.85);
    for (const car of g.cars) {
      const p = car.body.getPosition();
      if (car.type === 'police') hole(p.x, p.y, 3.4, 0.65);
      else if (!car.junk) hole(p.x, p.y, 1.4, 0.45);
    }
  } else {
    hole(pp.x, pp.y, F.fadeRadius, 1, F.clearRadius);
    for (const car of g.cars) {
      if (car.type !== 'police') continue;
      const p = car.body.getPosition();
      hole(p.x, p.y, 2.2, 0.5); // you can see the light bar through the fog
    }
  }
  for (const gl of w.glows) hole(gl.x, gl.y, gl.r * (0.5 + 0.5 * gl.life / gl.max), 0.95 * gl.life / gl.max);
  for (const st of w.strikes) hole(st.x, st.y, CONFIG.weather.lightning.radius, 0.6);

  ctx.save();
  ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
  ctx.drawImage(layer, 0, 0, r.w, r.h);
  // Colored light on top: police light bars and explosion glows.
  ctx.globalCompositeOperation = 'lighter';
  const tint = (x, y, rad, color, alpha) => {
    const cx = X(x) / K, cy = Y(y) / K, R = (rad * s) / K;
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    grd.addColorStop(0, color.replace('A', alpha));
    grd.addColorStop(1, color.replace('A', 0));
    ctx.fillStyle = grd;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  };
  for (const car of g.cars) {
    if (car.type !== 'police' || car.junk) continue;
    const p = car.body.getPosition();
    tint(p.x, p.y, 3, Math.sin(now * 18) > 0 ? 'rgba(255,45,61,A)' : 'rgba(45,123,255,A)', 0.3);
  }
  if (kind === 'night') {
    for (const gl of w.glows) tint(gl.x, gl.y, gl.r * 0.6, 'rgba(255,200,120,A)', 0.25 * gl.life / gl.max);
  }
  ctx.restore();
}

function drawTowers(ctx, w) {
  for (const t of w.towers) {
    ctx.fillStyle = '#2b2f3a';
    ctx.fillRect(t.x - 0.35, t.y - 0.35, 0.7, 0.7);
    if (t.level <= 0) continue;
    const grd = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, 1.6);
    grd.addColorStop(0, `rgba(255,252,235,${t.level})`);
    grd.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(t.x - 1.6, t.y - 1.6, 3.2, 3.2);
  }
}

// Sun glare from the top-right corner.
function drawGlare(ctx, r) {
  const sx = r.w * 0.9, sy = r.h * 0.06;
  const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, r.h * 0.6);
  grd.addColorStop(0, 'rgba(255,240,200,0.28)');
  grd.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, r.w, r.h);
}

// Shadow offset/opacity for car bodies: long and crisp in the sun, faint
// under clouds and at night.
export function shadowFor(spec) {
  if (spec?.sun) return { x: 0.22, y: 0.28, a: 0.4 };
  if (spec?.night || spec?.fog) return { x: 0.03, y: 0.05, a: 0.22 };
  if (spec?.rain || spec?.snow) return { x: 0.05, y: 0.06, a: 0.24 };
  return { x: 0.08, y: 0.1, a: 0.32 };
}
