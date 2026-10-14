// Planck world, arena walls, car bodies, and the top-down tire model.
import { CONFIG } from '../config.js';

const pl = window.planck;
const { Vec2 } = pl;

export const CAT_WALL = 0x0001;
export const CAT_CAR = 0x0002;
export const CAT_SENSOR = 0x0004;
export const CAT_BLOCK = 0x0008; // terrain blocks (phase passes through these, not arena walls)
export const SOLID_MASK = CAT_CAR | CAT_WALL | CAT_BLOCK | CAT_SENSOR;
export const SENSOR_MASK = CAT_CAR;

export function createWorld() {
  const world = new pl.World({ gravity: Vec2(0, 0) });
  const { width: W, height: H, wallThickness: t } = CONFIG.arena;
  const walls = world.createBody({ type: 'static' });
  const wallFix = {
    friction: CONFIG.physics.wallFriction,
    restitution: CONFIG.physics.restitution,
    filterCategoryBits: CAT_WALL,
    filterMaskBits: CAT_CAR,
    userData: { kind: 'wall' },
  };
  walls.createFixture(pl.Box(W / 2 + t, t / 2, Vec2(W / 2, -t / 2), 0), wallFix);
  walls.createFixture(pl.Box(W / 2 + t, t / 2, Vec2(W / 2, H + t / 2), 0), wallFix);
  walls.createFixture(pl.Box(t / 2, H / 2 + t, Vec2(-t / 2, H / 2), 0), wallFix);
  walls.createFixture(pl.Box(t / 2, H / 2 + t, Vec2(W + t / 2, H / 2), 0), wallFix);
  walls.setUserData({ kind: 'wall' });
  return world;
}

// Car object shared by player and AI. Forward is local +x. `length`/`width`
// default to CONFIG.car (vehicle types pass their own).
export function createCar(world, { x, y, angle, kind, color = -1, tune, length, width }) {
  const L = length ?? CONFIG.car.length;
  const Wd = width ?? CONFIG.car.width;
  const body = world.createBody({
    type: 'dynamic',
    position: Vec2(x, y),
    angle,
    linearDamping: tune.linearDamping,
    angularDamping: tune.angularDamping,
    bullet: false,
  });
  const car = {
    kind, color, body, tune,
    length: L,
    width: Wd,
    id: nextId++,
    matchTimer: 0,
    groupId: -1,
    stun: 0,
    dead: false,
    flash: 0,
  };
  body.setUserData(car);
  car.solid = body.createFixture(pl.Box(L / 2, Wd / 2), {
    density: tune.density,
    friction: CONFIG.physics.friction,
    restitution: CONFIG.physics.restitution,
    filterCategoryBits: CAT_CAR,
    filterMaskBits: SOLID_MASK,
    userData: { kind: 'solid', car },
  });
  const m = CONFIG.match.contactMargin;
  car.sensor = body.createFixture(pl.Box(L / 2 + m, Wd / 2 + m), {
    density: 0,
    isSensor: true,
    filterCategoryBits: CAT_SENSOR,
    filterMaskBits: SENSOR_MASK,
    userData: { kind: 'sensor', car },
  });
  return car;
}
let nextId = 1;

export function forwardOf(body) {
  const a = body.getAngle();
  return Vec2(Math.cos(a), Math.sin(a));
}

export function rightOf(body) {
  const a = body.getAngle();
  return Vec2(-Math.sin(a), Math.cos(a));
}

// Cancel sideways sliding (tire grip), capped so hard shoves still slide.
export function applyGrip(body, grip) {
  const right = rightOf(body);
  const v = body.getLinearVelocity();
  const lat = Vec2.dot(right, v);
  const m = body.getMass();
  let imp = -lat * m;
  const max = grip * m;
  if (imp > max) imp = max;
  else if (imp < -max) imp = -max;
  body.applyLinearImpulse(Vec2(right.x * imp, right.y * imp), body.getWorldCenter(), true);
}

// Push along forward axis until forward speed reaches topSpeed.
export function applyDrive(body, accel, topSpeed) {
  const fwd = forwardOf(body);
  const v = body.getLinearVelocity();
  const fs = Vec2.dot(fwd, v);
  if (fs >= topSpeed) return;
  const f = body.getMass() * accel;
  body.applyForceToCenter(Vec2(fwd.x * f, fwd.y * f), true);
}

// True if no solid fixture overlaps the box centered at (x,y).
export function areaClear(world, x, y, half) {
  let clear = true;
  const lo = Vec2(x - half, y - half);
  const hi = Vec2(x + half, y + half);
  world.queryAABB({ lowerBound: lo, upperBound: hi }, (fx) => {
    if (fx.isSensor()) return true;
    // The broadphase uses fattened AABBs; re-check against the real one.
    const a = fx.getAABB(0);
    if (a.upperBound.x < lo.x || a.lowerBound.x > hi.x || a.upperBound.y < lo.y || a.lowerBound.y > hi.y) return true;
    clear = false;
    return false;
  });
  return clear;
}
