// Bootstrap, fixed-timestep loop, game state, explosions, restart.
import { CONFIG } from '../config.js';
import { createWorld, areaClear } from './physics.js';
import { createTerrain } from './terrain.js';
import { createPlayer, updatePlayer, updateStuck, tryBoost } from './player.js';
import { createAI, updateAI, stunAI } from './ai.js';
import { createSpawner, updateSpawner, spawnInterval } from './spawner.js';
import { updateMatches, scoreFor } from './match.js';
import { createEffects, burst, floatText, addShake, updateEffects } from './effects.js';
import { createRenderer, render, updateCamera } from './render.js';
import { createInput } from './input.js';
import { createHUD } from './hud.js';
import { getLevel, endlessLevel, activeColors, goalMet, goalText, starsFor, levelBonus } from './levels.js';
import { initDamage, impactDamage, updateDamage, repairFrom } from './damage.js';
import { updatePileups, clearJunkNear } from './pileup.js';

const pl = window.planck;
const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const hud = createHUD();
const input = createInput(canvas, hud.el.boostBtn);

let game = null;

function emptyMatchInfo() {
  return { links: [], playerLinks: [], groups: [], primed: [], ready: [] };
}

// Start level `levelIndex` (0-based), carrying `startScore` over.
function newGame(levelIndex = 0, startScore = 0) {
  const world = createWorld();
  const level = CONFIG.features.levels ? getLevel(levelIndex) : endlessLevel();
  const g = {
    world,
    level,
    levelIndex,
    levelStartScore: startScore,
    player: null,
    cars: [],
    spawner: createSpawner(),
    fx: createEffects(),
    score: startScore,
    combo: 0,
    comboTimer: 0,
    elapsed: 0,
    over: false,
    complete: false,
    cleared: { total: 0, byColor: [] },
    matchInfo: emptyMatchInfo(),
    colors: activeColors(level, 0),
    camera: { x: 0, y: 0 },
  };
  initDamage(g);
  g.onRepairChange = (c) => (c >= 0 ? hud.announce('Repair color', CONFIG.colors[c]) : hud.announce('No repairs for now'));
  createTerrain(world);
  g.player = createPlayer(world);
  world.on('pre-solve', (contact) => recordApproach(contact));
  world.on('post-solve', (contact, impulse) => onImpact(g, contact, impulse));

  const { width: W, height: H } = CONFIG.arena;
  const pp = g.player.body.getPosition();
  let tries = 0;
  while (g.cars.length < level.initialCars && tries++ < 300) {
    const x = 1.5 + Math.random() * (W - 3);
    const y = 1.5 + Math.random() * (H - 3);
    if (Math.hypot(x - pp.x, y - pp.y) < 4.5) continue;
    if (!areaClear(world, x, y, 1.6)) continue;
    g.cars.push(createAI(world, x, y, Math.random() * Math.PI * 2, Math.floor(Math.random() * g.colors)));
  }
  return g;
}

// Before the solver runs, note how fast the player and the other body were
// closing on each other, so damage can tell a ram from getting rammed.
function recordApproach(contact) {
  const ba = contact.getFixtureA().getBody();
  const bb = contact.getFixtureB().getBody();
  const ka = ba.getUserData()?.kind, kb = bb.getUserData()?.kind;
  if (ka !== 'player' && kb !== 'player') return;
  const wm = contact.getWorldManifold(null);
  if (!wm) return;
  const n = wm.normal; // points from A to B
  const va = ba.getLinearVelocity(), vb = bb.getLinearVelocity();
  const aToward = Math.max(0, va.x * n.x + va.y * n.y);
  const bToward = Math.max(0, -(vb.x * n.x + vb.y * n.y));
  contact.approach = ka === 'player'
    ? { player: aToward, other: bToward }
    : { player: bToward, other: aToward };
}

function onImpact(g, contact, impulse) {
  const ua = contact.getFixtureA().getBody().getUserData();
  const ub = contact.getFixtureB().getBody().getUserData();
  const imps = impulse.normalImpulses;
  const n = contact.getManifold().pointCount;
  let maxImp = 0;
  for (let i = 0; i < n; i++) maxImp = Math.max(maxImp, imps[i]);

  const A = ua && ua.kind !== 'wall' ? ua : null;
  const B = ub && ub.kind !== 'wall' ? ub : null;
  const playerInvolved = (A && A.kind === 'player') || (B && B.kind === 'player');

  // Tagging: any touch from the player tags the car; a hard hit from a
  // tagged car (one the player launched) passes part of its tag on, so
  // knock-on shots count but ordinary AI bumps don't spread it.
  const M = CONFIG.match;
  if (A && B) {
    if (playerInvolved) {
      const other = A.kind === 'player' ? B : A;
      other.tag = M.tagTime;
    } else if (maxImp >= M.carryImpulse) {
      if (A.tag > 0) B.tag = Math.max(B.tag, A.tag * M.tagCarry);
      if (B.tag > 0) A.tag = Math.max(A.tag, B.tag * M.tagCarry);
    }
  }
  if (maxImp < CONFIG.ai.stunImpulse) return;

  if (playerInvolved) impactDamage(g, maxImp, !(A && B), contact.approach);

  // Hard hits stun AI so they settle where they land (optionally AI-AI/wall hits too).
  if (playerInvolved || CONFIG.ai.stunFromAI) {
    if (A) stunAI(A);
    if (B) stunAI(B);
  }

  if (A && A.kind === 'ai') A.flash = Math.min(1, maxImp / 10);
  if (B && B.kind === 'ai') B.flash = Math.min(1, maxImp / 10);
  if (playerInvolved && maxImp > CONFIG.fx.shakeImpulse) {
    addShake(g.fx, (maxImp - CONFIG.fx.shakeImpulse) * 0.012);
  }
  if (maxImp > CONFIG.fx.sparkImpulse) {
    const wm = contact.getWorldManifold(null);
    if (wm && wm.pointCount > 0) {
      const p = wm.points[0];
      burst(g.fx, p.x, p.y, '#ffe9a8', Math.min(8, 2 + Math.floor(maxImp / 3)), 4, 0.25, 0.12);
    }
  }
}

function explode(g, group) {
  const M = CONFIG.match;
  let cx = 0, cy = 0;
  for (const car of group) {
    const p = car.body.getPosition();
    cx += p.x;
    cy += p.y;
  }
  cx /= group.length;
  cy /= group.length;

  // Blasts clear rusted junk next to the exploding cars (the clean-up save).
  const junk = CONFIG.features.pileups ? clearJunkNear(g, group) : 0;

  for (const car of group) {
    const p = car.body.getPosition();
    const col = CONFIG.colors[car.color];
    burst(g.fx, p.x, p.y, col, CONFIG.fx.particlesPerCar, 9, 0.7, 0.28);
    burst(g.fx, p.x, p.y, '#ffffff', 4, 6, 0.35, 0.18);
    car.dead = true;
    g.world.destroyBody(car.body);
  }
  g.cars = g.cars.filter((c) => !c.dead);

  const color = group[0].color;
  g.cleared.total += group.length;
  g.cleared.byColor[color] = (g.cleared.byColor[color] || 0) + group.length;
  repairFrom(g, color, group.length, cx, cy);

  g.combo = g.comboTimer > 0 ? g.combo + 1 : 1;
  g.comboTimer = M.comboWindow;
  const pts = scoreFor(group.length, g.combo) + junk * CONFIG.pileup.pointsPerJunk;
  g.score += pts;
  floatText(g.fx, cx, cy, g.combo > 1 ? `+${pts} x${g.combo}` : `+${pts}`);
  if (junk) floatText(g.fx, cx, cy + 1, `${junk} junk cleared`, '#c9ced8');
  addShake(g.fx, 0.12 + 0.03 * group.length);

  // Shockwave: shove and stun everything nearby.
  const shove = (car) => {
    const b = car.body;
    const p = b.getPosition();
    const dx = p.x - cx, dy = p.y - cy;
    const d = Math.hypot(dx, dy);
    if (d >= M.blastRadius || d < 1e-3) return;
    const k = M.blastImpulse * (1 - d / M.blastRadius) * b.getMass() / d;
    b.applyLinearImpulse(pl.Vec2(dx * k, dy * k), b.getWorldCenter(), true);
    stunAI(car);
    if (car.kind === 'ai') car.tag = M.tagTime; // blasts can chain
  };
  for (const car of g.cars) shove(car);
  shove(g.player);
}

function gameOver(g, title) {
  g.over = true;
  const p = g.player.body.getPosition();
  burst(g.fx, p.x, p.y, '#ffffff', 30, 8, 0.8, 0.25);
  addShake(g.fx, 0.3);
  hud.showGameOver(title, g.score, g.levelIndex);
}

function completeLevel(g) {
  g.complete = true;
  const time = g.elapsed;
  const bonus = levelBonus(g.level, time, CONFIG.features.damage ? g.health : 0);
  g.score += bonus;
  const stars = starsFor(g.level, time);
  hud.showLevelComplete({ level: g.levelIndex + 1, time, health: g.health, bonus, score: g.score, stars, damage: CONFIG.features.damage });
}

function step(g, dt) {
  if (g.over || g.complete) {
    updateEffects(g.fx, dt);
    return;
  }
  const p = g.player;
  if (input.consumeBoost()) tryBoost(p);
  updatePlayer(p, dt, input.steer(), input.brake());
  for (const car of g.cars) {
    updateAI(car, dt, g.world, g);
    if (car.flash > 0) car.flash = Math.max(0, car.flash - dt * 4);
  }

  const P = CONFIG.physics;
  g.world.step(dt, P.velocityIterations, P.positionIterations);
  g.elapsed += dt;

  g.matchInfo = updateMatches(g, dt);
  const links = g.matchInfo.links;
  for (const group of g.matchInfo.ready) explode(g, group);
  if (g.matchInfo.ready.length) g.matchInfo = emptyMatchInfo();
  g.pileups = CONFIG.features.pileups ? updatePileups(g, links, dt) : 0;

  if (CONFIG.features.levels && goalMet(g.level, g.cleared)) {
    completeLevel(g);
    updateEffects(g.fx, dt);
    return;
  }

  updateSpawner(g.spawner, g, dt);
  const colors = activeColors(g.level, g.elapsed);
  if (colors > g.colors) {
    g.colors = colors;
    hud.announce('New color!', CONFIG.colors[colors - 1]);
  }

  if (g.comboTimer > 0) {
    g.comboTimer -= dt;
    if (g.comboTimer <= 0) g.combo = 0;
  }

  if (updateDamage(g, dt)) gameOver(g, 'Wrecked!');
  else if (updateStuck(p, dt)) gameOver(g, 'Boxed in!');

  updateEffects(g.fx, dt);
}

function startLevel(index, score) {
  game = newGame(index, score);
  updateCamera(renderer, game.camera, game.player, 0, true);
  input.reset();
  hud.hidePanels();
  accumulator = 0;
  if (CONFIG.features.levels) hud.announce(`Level ${index + 1}: ${goalText(game.level)}`);
}

// Retry the current level with the score it started with.
function restart() {
  startLevel(game ? game.levelIndex : 0, game ? game.levelStartScore : 0);
}
const nextLevel = () => startLevel(game.levelIndex + 1, game.score);
const fromStart = () => startLevel(0, 0);

document.getElementById('restart').addEventListener('click', restart);
document.getElementById('restart-big').addEventListener('click', restart);
document.getElementById('restart-first').addEventListener('click', fromStart);
document.getElementById('next-level').addEventListener('click', nextLevel);
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR') restart();
  else if (e.code === 'Enter' && game.over) restart();
  else if (e.code === 'Enter' && game.complete) nextLevel();
});

// Fixed-timestep loop.
const DT = 1 / CONFIG.physics.stepHz;
// Mirrors the CSS rule that shows the "rotate your phone" overlay.
const rotatePrompt = window.matchMedia('(orientation: portrait) and (pointer: coarse)');

// On phones that allow it (Android Chrome), go full screen and lock to
// landscape on the first touch. iOS ignores this; the overlay covers it.
document.addEventListener('pointerdown', function lockLandscape(e) {
  if (e.pointerType !== 'touch') return;
  document.removeEventListener('pointerdown', lockLandscape);
  const el = document.documentElement;
  if (!el.requestFullscreen) return;
  el.requestFullscreen({ navigationUI: 'hide' })
    .then(() => screen.orientation?.lock?.('landscape'))
    .catch(() => {});
});
let accumulator = 0;
let lastTime = performance.now();
let fps = 60;
let debugTimer = 0;
const debugEl = document.getElementById('debug-text');
if (DEBUG) debugEl.hidden = false;

function frame(now) {
  let elapsed = (now - lastTime) / 1000;
  lastTime = now;
  if (elapsed > 0.25) elapsed = 0.25;
  if (elapsed > 0) fps += (1 / elapsed - fps) * 0.05;

  if (rotatePrompt.matches) elapsed = 0; // paused behind the "rotate" overlay
  accumulator += elapsed;
  let steps = 0;
  while (accumulator >= DT && steps < CONFIG.physics.maxSubSteps) {
    step(game, DT);
    accumulator -= DT;
    steps++;
  }
  if (steps === CONFIG.physics.maxSubSteps) accumulator = 0;

  updateCamera(renderer, game.camera, game.player, elapsed);
  render(renderer, game, DEBUG);
  hud.update(game);

  if (DEBUG && (debugTimer -= elapsed) <= 0) {
    debugTimer = 0.25;
    const pv = game.player.body.getLinearVelocity().length();
    debugEl.textContent =
      `fps ${fps.toFixed(0)}\n` +
      `cars ${game.cars.length}  armed ${game.matchInfo.groups.length}  primed ${game.matchInfo.primed.length}  piles ${game.pileups}  junk ${game.cars.filter((c) => c.junk).length}\n` +
      `level ${game.levelIndex + 1}  spawn every ${spawnInterval(game.elapsed, game.level.spawn).toFixed(2)}s  t=${game.elapsed.toFixed(0)}s\n` +
      `health ${game.health.toFixed(1)}${game.squeezed ? ' SQUEEZED' : ''}  repair ${game.repairColor >= 0 ? 'c' + game.repairColor : 'none'} for ${game.repairTimer.toFixed(0)}s\n` +
      `speed ${pv.toFixed(2)}  stuck ${game.player.stuckTimer.toFixed(2)}\n` +
      `boost ${game.player.boostCharge.toFixed(2)}`;
  }
  requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', () => {
  lastTime = performance.now();
});

// Test/debug hook.
window.bumper = {
  get game() { return game; },
  CONFIG,
  restart,
  startLevel,
  nextLevel,
  step: (n = 1) => { for (let i = 0; i < n; i++) step(game, DT); },
  areaClear: (x, y, half) => areaClear(game.world, x, y, half),
  spawnAt(color, x, y, angle = 0) {
    const car = createAI(game.world, x, y, angle, color);
    game.cars.push(car);
    return car;
  },
};

startLevel(0, 0);
requestAnimationFrame(frame);
