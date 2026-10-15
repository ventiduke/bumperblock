// Terrain: solid blocks inside the arena and surface zones (ice, mud) that
// change how cars handle.
import { CONFIG } from '../config.js';
import { CAT_BLOCK, CAT_CAR } from './physics.js';

const pl = window.planck;
const NORMAL = { grip: 1, damping: 1, accel: 1, speed: 1 };

export function createTerrain(world) {
  const T = CONFIG.terrain;
  if (!T.blocks.length) return;
  const body = world.createBody({ type: 'static' });
  body.setUserData({ kind: 'wall' });
  for (const b of T.blocks) {
    body.createFixture(pl.Box(b.w / 2, b.h / 2, pl.Vec2(b.x, b.y), 0), {
      friction: CONFIG.physics.wallFriction,
      restitution: CONFIG.physics.restitution,
      filterCategoryBits: CAT_BLOCK,
      filterMaskBits: CAT_CAR,
      userData: { kind: 'wall' },
    });
  }
}

// Temporary ice patches (the Ghost slick upgrade): { x, y, r, life, max }.
export const slicks = [];

export function addSlick(x, y) {
  const U = CONFIG.upgrades;
  slicks.push({ x, y, r: U.slickRadius, life: U.slickLife, max: U.slickLife });
}

export function updateSlicks(dt) {
  let j = 0;
  for (const s of slicks) if ((s.life -= dt) > 0) slicks[j++] = s;
  slicks.length = j;
}

export function clearSlicks() {
  slicks.length = 0;
}

// Handling multipliers at a point (slicks first, then the first matching zone).
export function surfaceAt(x, y) {
  const T = CONFIG.terrain;
  for (const s of slicks) {
    if ((x - s.x) ** 2 + (y - s.y) ** 2 <= s.r * s.r) return T.types.ice;
  }
  for (const z of T.zones) {
    if (Math.abs(x - z.x) <= z.w / 2 && Math.abs(y - z.y) <= z.h / 2) {
      return T.types[z.type] || NORMAL;
    }
  }
  return NORMAL;
}

// Surface normal of the nearest static fixture within `dist` ahead of the
// body, or null if the way is clear.
export function obstacleAhead(world, body, dist) {
  const p = body.getPosition();
  const a = body.getAngle();
  const end = pl.Vec2(p.x + Math.cos(a) * dist, p.y + Math.sin(a) * dist);
  let normal = null;
  world.rayCast(p, end, (fx, point, n, fraction) => {
    if (fx.isSensor() || fx.getBody().getType() !== 'static') return -1;
    normal = { x: n.x, y: n.y };
    return fraction; // keep looking for anything closer
  });
  return normal;
}
