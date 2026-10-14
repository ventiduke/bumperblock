// Wandering AI cars. They pick a new heading every few seconds, steer away
// from walls, and stop driving for a moment after a hard hit (stun) so a
// shoved car stays roughly where you put it.
import { CONFIG } from '../config.js';
import { createCar, applyGrip, applyDrive } from './physics.js';
import { surfaceAt, obstacleAhead } from './terrain.js';

const pl = window.planck;
const rand = (a, b) => a + Math.random() * (b - a);

// Tuning for a vehicle type: CONFIG.ai with the type's overrides on top.
export function vehicleSpec(type) {
  return { ...CONFIG.ai, ...CONFIG.vehicles[type] };
}

// Overall length of a vehicle type (semi = cab + trailer), for spawn spacing.
export function vehicleLength(type) {
  const v = CONFIG.vehicles[type];
  return v.length + (v.trailer ? v.trailer.length + 0.1 : 0);
}

// Create an AI vehicle; returns its bodies' car objects (a semi has two:
// cab first, then trailer, hinged together).
export function createVehicle(world, x, y, angle, color, type = 'car') {
  const spec = vehicleSpec(type);
  const cab = createAI(world, x, y, angle, color, type, spec);
  if (!spec.trailer) return [cab];
  const T = { ...spec, ...spec.trailer };
  const gap = 0.1;
  const back = spec.length / 2 + gap + T.length / 2;
  const tx = x - Math.cos(angle) * back, ty = y - Math.sin(angle) * back;
  const trailer = createAI(world, tx, ty, angle, color, 'trailer', T);
  trailer.cab = cab;
  cab.trailer = trailer;
  const hx = x - Math.cos(angle) * (spec.length / 2 + gap / 2);
  const hy = y - Math.sin(angle) * (spec.length / 2 + gap / 2);
  world.createJoint(new pl.RevoluteJoint({
    enableLimit: true, lowerAngle: -spec.hingeLimit, upperAngle: spec.hingeLimit, collideConnected: false,
  }, cab.body, trailer.body, pl.Vec2(hx, hy)));
  return [cab, trailer];
}

export function createAI(world, x, y, angle, color, type = 'car', spec = vehicleSpec(type)) {
  const car = createCar(world, { x, y, angle, kind: 'ai', color, tune: spec, length: spec.length, width: spec.width });
  car.type = type;
  car.spec = spec;
  car.counts = spec.counts ?? 1;
  car.heading = angle;
  car.wanderTimer = rand(CONFIG.ai.wanderMinTime, CONFIG.ai.wanderMaxTime);
  car.entering = 1.0; // seconds of driving straight in after spawning
  car.wallBias = rand(-0.5, 0.5);
  car.tag = 0;          // >0 while the player's influence can set off a match
  car.lookTimer = rand(0, 0.25);
  car.bounce = 0;
  car.rust = 0;          // seconds spent in a pile-up
  car.rustAt = CONFIG.pileup.rustTime + rand(-1, 1) * CONFIG.pileup.rustJitter;
  car.junk = false;
  return car;
}

export function stunAI(car, time = CONFIG.ai.stunTime) {
  if (car.kind !== 'ai') return;
  if (car.stun <= 0) car.body.setLinearDamping(CONFIG.ai.stunDamping);
  car.stun = Math.max(car.stun, time);
}

function wrapAngle(a) {
  const t = 2 * Math.PI;
  return a - t * Math.floor((a + Math.PI) / t);
}

// Ray-check for blocks ahead a few times a second (not every step).
// Returns the obstacle's surface normal, or null.
function blockedAhead(car, world, dt) {
  car.lookTimer -= dt;
  if (car.lookTimer > 0) return null;
  car.lookTimer = 0.25;
  return obstacleAhead(world, car.body, 2.2);
}

// Chance a wander decision steers toward the player at time `elapsed`.
function seekChance(elapsed, rampTime) {
  const A = CONFIG.ai;
  const t = Math.min(1, elapsed / rampTime);
  return A.seekStart + (A.seekMax - A.seekStart) * t;
}

export function updateAI(car, dt, world, game) {
  const A = car.spec;
  const body = car.body;
  if (car.tag > 0) car.tag = Math.max(0, car.tag - dt);
  const pos = body.getPosition();
  const surf = surfaceAt(pos.x, pos.y);
  applyGrip(body, A.lateralGrip * surf.grip);

  // Junk doesn't drive; it's just heavy wreckage to push around.
  if (car.junk) {
    body.setLinearDamping(CONFIG.pileup.junkDamping * surf.damping);
    return;
  }
  // Trailers and towed cars don't drive themselves.
  if (car.type === 'trailer' || car.towed) {
    body.setLinearDamping((car.towed ? 0.6 : A.linearDamping) * surf.damping);
    return;
  }

  if (car.stun > 0) {
    car.stun -= dt;
    if (car.stun <= 0) car.heading = body.getAngle();
    body.setLinearDamping((car.stun > 0 ? A.stunDamping : A.linearDamping) * surf.damping);
    if (car.stun > 0) return;
  } else {
    body.setLinearDamping(A.linearDamping * surf.damping);
  }

  const p = pos;
  const { width: W, height: H } = CONFIG.arena;
  let n;
  if (car.entering > 0) {
    car.entering -= dt;
  } else if (car.bounce > 0) {
    car.bounce -= dt; // hold the bounce heading so wall-avoid doesn't steer us back in
  } else {
    const d = A.wallAvoidDist;
    if ((n = blockedAhead(car, world, dt))) {
      // Bounce the heading off the obstacle's surface, plus a little jitter.
      const a = body.getAngle();
      const dx = Math.cos(a), dy = Math.sin(a);
      const dn = dx * n.x + dy * n.y;
      car.heading = Math.atan2(dy - 2 * dn * n.y, dx - 2 * dn * n.x) + rand(-0.3, 0.3);
      car.bounce = 0.8;
      car.wanderTimer = rand(A.wanderMinTime, A.wanderMaxTime);
    } else if (p.x < d || p.x > W - d || p.y < d || p.y > H - d) {
      car.heading = Math.atan2(H / 2 - p.y, W / 2 - p.x) + car.wallBias;
      car.wanderTimer = rand(A.wanderMinTime, A.wanderMaxTime);
    } else if ((car.wanderTimer -= dt) <= 0) {
      if (game && Math.random() < seekChance(game.elapsed, game.level.spawn.rampTime)) {
        const pp = game.player.body.getPosition();
        car.heading = Math.atan2(pp.y - p.y, pp.x - p.x) + rand(-0.4, 0.4);
      } else {
        car.heading = body.getAngle() + rand(-A.wanderMaxTurn, A.wanderMaxTurn);
      }
      car.wanderTimer = rand(A.wanderMinTime, A.wanderMaxTime);
    }
  }

  // Police head straight for a nearby player.
  if (car.type === 'police' && game && car.entering <= 0 && car.bounce <= 0) {
    const pp = game.player.body.getPosition();
    if (Math.hypot(pp.x - p.x, pp.y - p.y) < A.chaseRange) {
      car.heading = Math.atan2(pp.y - p.y, pp.x - p.x);
    }
  }

  const diff = wrapAngle(car.heading - body.getAngle());
  const w = Math.max(-A.turnRate, Math.min(A.turnRate, diff * 3));
  body.setAngularVelocity(w);
  applyDrive(body, A.accel * surf.accel, A.speed * surf.speed);
}
