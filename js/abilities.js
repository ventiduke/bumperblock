// Second ability slot: chameleon, phase, tow. One is equipped at a time;
// each has an active duration (or toggle) and a recharge.
import { CONFIG } from '../config.js';
import { SOLID_MASK, SENSOR_MASK, CAT_WALL } from './physics.js';
import { stunAI } from './ai.js';
import { burst, floatText } from './effects.js';
import { addSlick } from './terrain.js';

const pl = window.planck;

export function initAbilities(p, equipped) {
  p.ability = equipped || CONFIG.abilities.start;
  p.abilityCharge = 1;   // 0..1, ready at 1
  p.abilityTime = 0;     // seconds left on an active ability
  p.chameleon = 0;
  p.phasing = false;
  p.towed = null;        // car on the rope
  p.towJoint = null;
}

export function abilityLabel(name) {
  return { chameleon: 'CHAMELEON', phase: 'PHASE', tow: 'TOW' }[name] || name.toUpperCase();
}

// Equip ability `index` from CONFIG.abilities.list (number keys), if it's
// unlocked this run. Not while one is active.
export function selectAbility(g, index) {
  const p = g.player;
  const name = CONFIG.abilities.list[index];
  if (p.abilityTime > 0 || p.towed || !name || !g.unlocked.includes(name)) return false;
  p.ability = name;
  return true;
}

// Swap to the next unlocked ability.
export function cycleAbility(g) {
  const list = g.unlocked;
  if (list.length < 2) return false;
  const next = list[(list.indexOf(g.player.ability) + 1) % list.length];
  return selectAbility(g, CONFIG.abilities.list.indexOf(next));
}

export function useAbility(g) {
  const p = g.player;
  const A = CONFIG.abilities;
  if (p.ability === 'tow' && p.towed) return dropTow(g);
  if (p.abilityCharge < 1 || p.abilityTime > 0) return false;
  const pos = p.body.getPosition();
  if (p.ability === 'chameleon') {
    p.chameleon = p.abilityTime = A.chameleon.duration + (g.mods?.chameleonPlus ?? 0);
  } else if (p.ability === 'phase') {
    p.abilityTime = A.phase.duration;
    p.phaseExtra = 0;
    setPhase(p, true);
  } else if (p.ability === 'tow') {
    const target = nearestCar(g, A.tow.range + (g.mods?.ropePlus ?? 0));
    if (!target) {
      floatText(g.fx, pos.x, pos.y - 1.2, 'nothing to tow', '#c9ced8');
      return false;
    }
    attachTow(g, target);
    p.abilityTime = A.tow.maxTime;
  }
  p.abilityCharge = 0;
  if (g.stats) g.stats.abilities[p.ability] = (g.stats.abilities[p.ability] || 0) + 1;
  burst(g.fx, pos.x, pos.y, '#ffffff', 10, 4, 0.4, 0.18);
  return true;
}

function nearestCar(g, range) {
  const pos = g.player.body.getPosition();
  let best = null, bd = range;
  for (const car of g.cars) {
    if (car.junk || car.dead) continue;
    const q = car.body.getPosition();
    // Measure to the car's surface, roughly: centre distance minus half its length.
    const d = Math.hypot(q.x - pos.x, q.y - pos.y) - car.length / 2;
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

function attachTow(g, car) {
  const p = g.player;
  const L = CONFIG.car.length;
  // Rope from the player's rear bumper to the nearest end of the towed car.
  const rear = p.body.getWorldPoint(pl.Vec2(-L / 2, 0));
  const front = car.body.getWorldPoint(pl.Vec2(car.length / 2, 0));
  const back = car.body.getWorldPoint(pl.Vec2(-car.length / 2, 0));
  const end = Math.hypot(front.x - rear.x, front.y - rear.y) < Math.hypot(back.x - rear.x, back.y - rear.y)
    ? pl.Vec2(car.length / 2, 0) : pl.Vec2(-car.length / 2, 0);
  p.towJoint = g.world.createJoint(new pl.RopeJoint({
    bodyA: p.body, bodyB: car.body,
    localAnchorA: pl.Vec2(-L / 2, 0), localAnchorB: end,
    maxLength: CONFIG.abilities.tow.ropeLength + (g.mods?.ropePlus ?? 0), collideConnected: true,
  }));
  p.towed = car;
  car.towed = true;
  car.towEnd = end;
}

export function dropTow(g) {
  const p = g.player;
  if (p.towJoint && p.towed && !p.towed.dead) g.world.destroyJoint(p.towJoint);
  if (p.towed) {
    p.towed.towed = false;
    if (!p.towed.dead) stunAI(p.towed, 1.0);
  }
  p.towed = null;
  p.towJoint = null;
  p.abilityTime = 0;
  return true;
}

function setPhase(p, on) {
  p.phasing = on;
  // Phasing: collide only with the arena walls, and don't touch anything for
  // matching either.
  p.solid.setFilterMaskBits(on ? CAT_WALL : SOLID_MASK);
  p.sensor.setFilterMaskBits(on ? 0 : SENSOR_MASK);
}

// True if the player's body overlaps any solid car or block right now.
function overlapping(g) {
  const p = g.player;
  const shape = p.solid.getShape();
  const xf = p.body.getTransform();
  const aabb = p.solid.getAABB(0);
  let hit = false;
  g.world.queryAABB(aabb, (fx) => {
    if (fx === p.solid || fx.isSensor()) return true;
    if (pl.testOverlap(shape, 0, fx.getShape(), 0, xf, fx.getBody().getTransform())) {
      hit = true;
      return false;
    }
    return true;
  });
  return hit;
}

export function updateAbilities(g, dt) {
  const p = g.player;
  const A = CONFIG.abilities;
  // Ghost slick: phasing drops ice patches behind you.
  if (p.phasing && g.mods?.phaseSlick) {
    p.slickTimer = (p.slickTimer || 0) - dt;
    if (p.slickTimer <= 0) {
      p.slickTimer = CONFIG.upgrades.slickEvery;
      const back = p.body.getWorldPoint(pl.Vec2(-CONFIG.car.length / 2, 0));
      addSlick(back.x, back.y);
    }
  }
  if (p.abilityTime > 0) {
    p.abilityTime -= dt;
    if (p.ability === 'chameleon') p.chameleon = Math.max(0, p.abilityTime);
    if (p.abilityTime <= 0) {
      if (p.ability === 'phase') {
        // Don't drop out of phase inside something.
        if (overlapping(g) && p.phaseExtra < A.phase.maxExtend) {
          p.phaseExtra += dt;
          p.abilityTime = dt;
          return;
        }
        setPhase(p, false);
      }
      if (p.ability === 'tow') dropTow(g);
      p.abilityTime = 0;
      p.chameleon = 0;
    }
  }
  // The towed car may have exploded or rusted.
  if (p.towed && (p.towed.dead || p.towed.junk)) {
    if (p.towed.junk) dropTow(g);
    else { p.towed = null; p.towJoint = null; p.abilityTime = 0; }
  }
  if (p.abilityTime <= 0 && !p.towed && p.abilityCharge < 1) {
    p.abilityCharge = Math.min(1, p.abilityCharge + dt / A[p.ability].cooldown);
  }
}
