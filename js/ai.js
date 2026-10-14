// Wandering AI cars. They pick a new heading every few seconds, steer away
// from walls, and stop driving for a moment after a hard hit (stun) so a
// shoved car stays roughly where you put it.
import { CONFIG } from '../config.js';
import { createCar, applyGrip, applyDrive } from './physics.js';

const rand = (a, b) => a + Math.random() * (b - a);

export function createAI(world, x, y, angle, color) {
  const car = createCar(world, { x, y, angle, kind: 'ai', color, tune: CONFIG.ai });
  car.heading = angle;
  car.wanderTimer = rand(CONFIG.ai.wanderMinTime, CONFIG.ai.wanderMaxTime);
  car.entering = 1.0; // seconds of driving straight in after spawning
  car.wallBias = rand(-0.5, 0.5);
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

export function updateAI(car, dt) {
  const A = CONFIG.ai;
  const body = car.body;
  applyGrip(body, A.lateralGrip);

  if (car.stun > 0) {
    car.stun -= dt;
    if (car.stun <= 0) {
      body.setLinearDamping(A.linearDamping);
      car.heading = body.getAngle();
    }
    return;
  }

  const p = body.getPosition();
  const { width: W, height: H } = CONFIG.arena;
  if (car.entering > 0) {
    car.entering -= dt;
  } else {
    const d = A.wallAvoidDist;
    if (p.x < d || p.x > W - d || p.y < d || p.y > H - d) {
      car.heading = Math.atan2(H / 2 - p.y, W / 2 - p.x) + car.wallBias;
      car.wanderTimer = rand(A.wanderMinTime, A.wanderMaxTime);
    } else if ((car.wanderTimer -= dt) <= 0) {
      car.heading = body.getAngle() + rand(-A.wanderMaxTurn, A.wanderMaxTurn);
      car.wanderTimer = rand(A.wanderMinTime, A.wanderMaxTime);
    }
  }

  const diff = wrapAngle(car.heading - body.getAngle());
  const w = Math.max(-A.turnRate, Math.min(A.turnRate, diff * 3));
  body.setAngularVelocity(w);
  applyDrive(body, A.accel, A.speed);
}
