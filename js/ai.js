// Wandering AI cars. They pick a new heading every few seconds, steer away
// from walls, and stop driving for a moment after a hard hit (stun) so a
// shoved car stays roughly where you put it.
import { CONFIG } from '../config.js';
import { createCar, applyGrip, applyDrive } from './physics.js';
import { surfaceAt, obstacleAhead } from './terrain.js';

const rand = (a, b) => a + Math.random() * (b - a);

export function createAI(world, x, y, angle, color) {
  const car = createCar(world, { x, y, angle, kind: 'ai', color, tune: CONFIG.ai });
  car.heading = angle;
  car.wanderTimer = rand(CONFIG.ai.wanderMinTime, CONFIG.ai.wanderMaxTime);
  car.entering = 1.0; // seconds of driving straight in after spawning
  car.wallBias = rand(-0.5, 0.5);
  car.tag = 0;          // >0 while the player's influence can set off a match
  car.lookTimer = rand(0, 0.25);
  car.bounce = 0;
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
function seekChance(elapsed) {
  const A = CONFIG.ai;
  const t = Math.min(1, elapsed / CONFIG.spawn.rampTime);
  return A.seekStart + (A.seekMax - A.seekStart) * t;
}

export function updateAI(car, dt, world, game) {
  const A = CONFIG.ai;
  const body = car.body;
  if (car.tag > 0) car.tag = Math.max(0, car.tag - dt);
  const pos = body.getPosition();
  const surf = surfaceAt(pos.x, pos.y);
  applyGrip(body, A.lateralGrip * surf.grip);

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
      if (game && Math.random() < seekChance(game.elapsed)) {
        const pp = game.player.body.getPosition();
        car.heading = Math.atan2(pp.y - p.y, pp.x - p.x) + rand(-0.4, 0.4);
      } else {
        car.heading = body.getAngle() + rand(-A.wanderMaxTurn, A.wanderMaxTurn);
      }
      car.wanderTimer = rand(A.wanderMinTime, A.wanderMaxTime);
    }
  }

  const diff = wrapAngle(car.heading - body.getAngle());
  const w = Math.max(-A.turnRate, Math.min(A.turnRate, diff * 3));
  body.setAngularVelocity(w);
  applyDrive(body, A.accel * surf.accel, A.speed * surf.speed);
}
