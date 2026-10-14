// Player health: impact and squeeze damage, constant wear, and repair by
// exploding the current repair color.
import { CONFIG } from '../config.js';
import { floatText, burst, addShake } from './effects.js';

export function initDamage(g) {
  g.health = CONFIG.damage.maxHealth;
  g.repairColor = Math.floor(Math.random() * g.colors);
  g.repairTimer = CONFIG.damage.repairRotate;
  g.hurtFlash = 0;
  g.damageBy = { wall: 0, boost: 0, hit: 0, squeeze: 0, drain: 0 }; // for tuning / debug
}

function hurt(g, amount, source) {
  if (amount <= 0) return;
  g.health = Math.max(0, g.health - amount);
  g.damageBy[source] += amount;
}

// Called from the post-solve handler for hard contacts involving the player.
// `approach` = { player, other }: closing speeds recorded before the solve.
export function impactDamage(g, impulse, isWall, approach) {
  const D = CONFIG.damage;
  if (!CONFIG.features.damage || impulse <= Math.min(D.hitThreshold, D.impactThreshold)) return;
  let fault, source;
  if (isWall) {
    fault = D.wallMult;
    source = 'wall';
  } else {
    const a = approach || { player: 1, other: 1 };
    const total = a.player + a.other;
    fault = total > 1e-3 ? a.other / total : 0.5;
    source = 'hit';
    if (g.player.boostTime > 0 && D.boostRamMult > fault) {
      fault = D.boostRamMult;
      source = 'boost';
    }
  }
  const threshold = source === 'hit' ? D.hitThreshold : D.impactThreshold;
  const dmg = Math.max(0, impulse - threshold) * D.perImpulse * fault;
  if (dmg < 0.5) return;
  hurt(g, dmg, source);
  g.hurtFlash = Math.min(1, g.hurtFlash + dmg / 12);
  const p = g.player.body.getPosition();
  floatText(g.fx, p.x, p.y - 1.2, `-${Math.round(dmg)}`, '#ff6b6b');
  burst(g.fx, p.x, p.y, '#c9ced8', Math.min(10, 2 + Math.round(dmg / 2)), 3, 0.5, 0.18);
  addShake(g.fx, Math.min(0.2, dmg * 0.01));
}

// True while the player is slow and pressed against 2+ things, at least one a car.
function squeezed(body) {
  const D = CONFIG.damage;
  if (body.getLinearVelocity().length() > D.squeezeSpeed) return false;
  let things = 0, cars = 0;
  for (let ce = body.getContactList(); ce; ce = ce.next) {
    const c = ce.contact;
    if (!c.isTouching() || c.getFixtureA().isSensor() || c.getFixtureB().isSensor()) continue;
    things++;
    const o = ce.other.getUserData();
    if (o && o.kind === 'ai') cars++;
  }
  return things >= 2 && cars >= 1;
}

// Per-step wear, squeeze damage, and repair-color rotation. Returns true when
// the car is wrecked.
export function updateDamage(g, dt) {
  if (!CONFIG.features.damage) return false;
  const D = CONFIG.damage;
  hurt(g, D.drainPerSec * dt, 'drain');
  g.squeezed = squeezed(g.player.body);
  if (g.squeezed) {
    hurt(g, D.squeezePerSec * dt, 'squeeze');
    g.hurtFlash = Math.min(1, g.hurtFlash + dt * 1.5);
  }
  g.hurtFlash = Math.max(0, g.hurtFlash - dt * 2.5);

  // Smoke when badly damaged.
  const frac = g.health / D.maxHealth;
  if (frac < 0.5 && Math.random() < (0.5 - frac) * 0.6) {
    const p = g.player.body.getPosition();
    burst(g.fx, p.x, p.y, frac < 0.25 ? '#3a3a3a' : '#8a8f99', 1, 1.2, 0.9, 0.35);
  }

  if (g.colors > 1 && (g.repairTimer -= dt) <= 0) {
    let next = g.repairColor;
    while (next === g.repairColor) next = Math.floor(Math.random() * g.colors);
    g.repairColor = next;
    g.repairTimer = D.repairRotate;
    g.onRepairChange?.(next);
  }
  return g.health <= 0;
}

// Heal for an exploded group if it was the repair color.
export function repairFrom(g, color, n, x, y) {
  if (!CONFIG.features.damage || color !== g.repairColor) return;
  const D = CONFIG.damage;
  const before = g.health;
  g.health = Math.min(D.maxHealth, g.health + n * D.healPerCar);
  const healed = Math.round(g.health - before);
  if (healed > 0) floatText(g.fx, x, y + 1.0, `+${healed} HP`, '#6ef59a');
}
