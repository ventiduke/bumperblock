// Spawns AI cars just inside the arena edges at an increasing rate.
import { CONFIG } from '../config.js';
import { areaClear } from './physics.js';
import { createVehicle, vehicleLength } from './ai.js';

const rand = (a, b) => a + Math.random() * (b - a);

// Spawn interval at time `elapsed` for a pace { startInterval, minInterval, rampTime }.
export function spawnInterval(elapsed, S = CONFIG.spawn) {
  const t = Math.min(1, elapsed / S.rampTime);
  return S.startInterval + (S.minInterval - S.startInterval) * t;
}

// Number of colors in play at time t (from CONFIG.colorSchedule).
export function colorCount(elapsed) {
  let n = CONFIG.colors.length;
  for (const step of CONFIG.colorSchedule) if (elapsed >= step.t) n = step.count;
  return Math.min(n, CONFIG.colors.length);
}

export function createSpawner() {
  return { timer: 0 };
}

// Weighted pick from the level's vehicle mix (or CONFIG.vehicleMix).
export function pickType(game) {
  const mix = game.level.types || CONFIG.vehicleMix;
  let total = 0;
  for (const w of Object.values(mix)) total += w;
  let r = Math.random() * total;
  let type = 'car';
  for (const [t, w] of Object.entries(mix)) if ((r -= w) < 0) { type = t; break; }
  // Respect a per-type cap (e.g. police.max).
  const max = CONFIG.vehicles[type]?.max;
  if (max != null && game.cars.filter((c) => c.type === type).length >= max) return 'car';
  return type;
}

// Pick a random point along a random edge, facing into the arena. Long
// vehicles spawn further in so their tail isn't in the wall.
function edgePoint(len) {
  const { width: W, height: H } = CONFIG.arena;
  const k = Math.max(CONFIG.spawn.edgeInset, len * 0.75);
  const side = Math.floor(Math.random() * 4);
  const spread = 0.6;
  switch (side) {
    case 0: return { x: rand(k, W - k), y: k, angle: Math.PI / 2 + rand(-spread, spread) };
    case 1: return { x: rand(k, W - k), y: H - k, angle: -Math.PI / 2 + rand(-spread, spread) };
    case 2: return { x: k, y: rand(k, H - k), angle: rand(-spread, spread) };
    default: return { x: W - k, y: rand(k, H - k), angle: Math.PI + rand(-spread, spread) };
  }
}

// Try a few edge points; returns the new vehicle's bodies, or null if none
// were clear.
export function trySpawn(game, avoid = null, avoidDist = 0, type = pickType(game)) {
  const n = game.colors;
  const len = vehicleLength(type);
  const half = Math.max(CONFIG.spawn.clearance, len / 2 + 0.3);
  for (let i = 0; i < 6; i++) {
    const p = edgePoint(len);
    if (avoid && Math.hypot(p.x - avoid.x, p.y - avoid.y) < avoidDist) continue;
    // For long vehicles, check the box centered on the middle of the vehicle.
    const back = (len - CONFIG.vehicles[type].length) / 2;
    const cx = p.x - Math.cos(p.angle) * back, cy = p.y - Math.sin(p.angle) * back;
    if (!areaClear(game.world, cx, cy, half)) continue;
    const bodies = createVehicle(game.world, p.x, p.y, p.angle, Math.floor(Math.random() * n), type);
    game.cars.push(...bodies);
    return bodies;
  }
  return null;
}

export function updateSpawner(sp, game, dt) {
  if (game.cars.length >= CONFIG.spawn.maxCars) return;
  sp.timer += dt;
  // Keep spawns out of the player's immediate surroundings (they appear on screen).
  if (sp.timer >= spawnInterval(game.elapsed, game.level.spawn) && trySpawn(game, game.player.body.getPosition(), 6)) sp.timer = 0;
}
