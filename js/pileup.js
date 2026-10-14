// Pile-ups: a big connected clump of touching AI cars (any colors) slowly
// rusts into junk, so waiting for a giant blob to "clean up" costs space.
// Explosions destroy nearby junk, which keeps the last-second save possible.
import { CONFIG } from '../config.js';
import { burst } from './effects.js';

function find(parent, i) {
  while (parent[i] !== i) {
    parent[i] = parent[parent[i]];
    i = parent[i];
  }
  return i;
}

// `links` are touching AI pairs from updateMatches. Advances each car's rust
// timer while it's in a pile-up and turns fully rusted cars into junk.
// Returns the number of pile-ups.
export function updatePileups(game, links, dt) {
  const P = CONFIG.pileup;
  const cars = game.cars;
  const index = new Map();
  const parent = new Array(cars.length);
  for (let i = 0; i < cars.length; i++) {
    index.set(cars[i], i);
    parent[i] = i;
  }
  for (const [a, b] of links) {
    const ia = index.get(a), ib = index.get(b);
    if (ia === undefined || ib === undefined) continue;
    const ra = find(parent, ia), rb = find(parent, ib);
    if (ra !== rb) parent[ra] = rb;
  }
  const size = new Map();
  for (let i = 0; i < cars.length; i++) {
    const r = find(parent, i);
    size.set(r, (size.get(r) || 0) + 1);
  }
  const piles = new Set();
  for (let i = 0; i < cars.length; i++) {
    const car = cars[i];
    if (car.junk) continue;
    const r = find(parent, i);
    // Cars already counting down to explode don't rust.
    if (size.get(r) >= P.size && car.groupId < 0) {
      piles.add(r);
      car.rust += dt;
      if (car.rust >= car.rustAt) makeJunk(game, car);
    } else if (car.rust > 0) {
      car.rust = Math.max(0, car.rust - dt * P.recover);
    }
  }
  return piles.size;
}

function makeJunk(game, car) {
  const P = CONFIG.pileup;
  car.junk = true;
  car.color = -1;
  car.primed = false;
  car.matchTimer = 0;
  car.groupId = -1;
  for (let f = car.body.getFixtureList(); f; f = f.getNext()) {
    if (!f.isSensor()) f.setDensity(CONFIG.ai.density * P.junkDensity);
  }
  car.body.resetMassData();
  const p = car.body.getPosition();
  burst(game.fx, p.x, p.y, '#8a8f99', 6, 2, 0.6, 0.2);
}

// Destroy junk within clearRadius of any exploding car. Returns how many.
export function clearJunkNear(game, group) {
  const R = CONFIG.pileup.clearRadius;
  let n = 0;
  for (const junk of game.cars) {
    if (!junk.junk || junk.dead) continue;
    const q = junk.body.getPosition();
    for (const car of group) {
      const p = car.body.getPosition();
      if (Math.hypot(q.x - p.x, q.y - p.y) <= R) {
        junk.dead = true;
        burst(game.fx, q.x, q.y, '#8a8f99', 10, 7, 0.6, 0.26);
        game.world.destroyBody(junk.body);
        n++;
        break;
      }
    }
  }
  return n;
}

