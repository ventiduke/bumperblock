// Player car: auto-throttle, steering, boost, and stuck (boxed-in) detection.
import { CONFIG } from '../config.js';
import { createCar, applyGrip, applyDrive, forwardOf } from './physics.js';

const pl = window.planck;

export function createPlayer(world) {
  const { width: W, height: H } = CONFIG.arena;
  const car = createCar(world, {
    x: W / 2, y: H * 0.62, angle: -Math.PI / 2, kind: 'player', tune: CONFIG.player,
  });
  car.boostCharge = 1;
  car.boostTime = 0;
  car.stuckTimer = 0;
  return car;
}

export function tryBoost(p) {
  const B = CONFIG.boost;
  if (p.boostCharge < B.cost - 1e-6) return false;
  p.boostCharge -= B.cost;
  p.boostTime = B.duration;
  const fwd = forwardOf(p.body);
  const m = p.body.getMass();
  p.body.applyLinearImpulse(pl.Vec2(fwd.x * B.kick * m, fwd.y * B.kick * m), p.body.getWorldCenter(), true);
  return true;
}

export function updatePlayer(p, dt, steer) {
  const P = CONFIG.player;
  const B = CONFIG.boost;
  const body = p.body;

  p.boostCharge = Math.min(1, p.boostCharge + dt / B.rechargeTime);
  const boosting = p.boostTime > 0;
  if (boosting) p.boostTime -= dt;

  const speed = body.getLinearVelocity().length();
  const turnFactor = P.minTurnFactor + (1 - P.minTurnFactor) * Math.min(1, speed / P.fullTurnSpeed);
  const targetW = steer * P.turnRate * turnFactor;
  const w = body.getAngularVelocity();
  body.setAngularVelocity(w + (targetW - w) * Math.min(1, P.steerResponse * dt));

  applyGrip(body, P.lateralGrip);
  applyDrive(
    body,
    P.accel * (boosting ? B.accelMultiplier : 1),
    P.topSpeed * (boosting ? B.speedMultiplier : 1),
  );
}

// Returns true when the player has been boxed in long enough to lose.
export function updateStuck(p, dt) {
  const S = CONFIG.stuck;
  const speed = p.body.getLinearVelocity().length();
  if (speed < S.speed && touchingCar(p.body)) {
    p.stuckTimer += dt;
  } else {
    p.stuckTimer = Math.max(0, p.stuckTimer - dt * S.decay);
  }
  return p.stuckTimer >= S.time;
}

function touchingCar(body) {
  for (let ce = body.getContactList(); ce; ce = ce.next) {
    const c = ce.contact;
    if (!c.isTouching()) continue;
    const fa = c.getFixtureA();
    const fb = c.getFixtureB();
    if (fa.isSensor() || fb.isSensor()) continue;
    const other = ce.other.getUserData();
    if (other && other.kind === 'ai') return true;
  }
  return false;
}
