// Spawns AI cars just inside the arena edges at an increasing rate.
import { CONFIG } from '../config.js';
import { areaClear } from './physics.js';
import { createAI } from './ai.js';

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

// Pick a random point along a random edge, facing into the arena.
function edgePoint() {
  const { width: W, height: H } = CONFIG.arena;
  const k = CONFIG.spawn.edgeInset;
  const side = Math.floor(Math.random() * 4);
  const spread = 0.6;
  switch (side) {
    case 0: return { x: rand(k, W - k), y: k, angle: Math.PI / 2 + rand(-spread, spread) };
    case 1: return { x: rand(k, W - k), y: H - k, angle: -Math.PI / 2 + rand(-spread, spread) };
    case 2: return { x: k, y: rand(k, H - k), angle: rand(-spread, spread) };
    default: return { x: W - k, y: rand(k, H - k), angle: Math.PI + rand(-spread, spread) };
  }
}

// Try a few edge points; returns the new car or null if none were clear.
export function trySpawn(game, avoid = null, avoidDist = 0) {
  const n = game.colors;
  for (let i = 0; i < 6; i++) {
    const p = edgePoint();
    if (avoid && Math.hypot(p.x - avoid.x, p.y - avoid.y) < avoidDist) continue;
    if (!areaClear(game.world, p.x, p.y, CONFIG.spawn.clearance)) continue;
    const car = createAI(game.world, p.x, p.y, p.angle, Math.floor(Math.random() * n));
    game.cars.push(car);
    return car;
  }
  return null;
}

export function updateSpawner(sp, game, dt) {
  if (game.cars.length >= CONFIG.spawn.maxCars) return;
  sp.timer += dt;
  // Keep spawns out of the player's immediate surroundings (they appear on screen).
  if (sp.timer >= spawnInterval(game.elapsed, game.level.spawn) && trySpawn(game, game.player.body.getPosition(), 6)) sp.timer = 0;
}
