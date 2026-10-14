// Finds connected groups of touching same-color AI cars and decides which
// have held long enough to explode.
import { CONFIG } from '../config.js';

function find(parent, i) {
  while (parent[i] !== i) {
    parent[i] = parent[parent[i]];
    i = parent[i];
  }
  return i;
}

// Returns { links, groups, ready }:
//   links  - [carA, carB, sameColor] for every touching AI pair (for debug/visuals)
//   groups - arrays of cars in qualifying (>= minGroup) groups
//   ready  - subset of groups whose countdown has finished
export function updateMatches(game, dt) {
  const M = CONFIG.match;
  const cars = game.cars;
  const index = new Map();
  const parent = new Array(cars.length);
  for (let i = 0; i < cars.length; i++) {
    index.set(cars[i], i);
    parent[i] = i;
  }

  const links = [];
  const seen = new Set();
  for (let c = game.world.getContactList(); c; c = c.getNext()) {
    if (!c.isTouching()) continue;
    const fa = c.getFixtureA();
    const fb = c.getFixtureB();
    // Only sensor-vs-solid pairs: "within contactMargin" of each other.
    if (fa.isSensor() === fb.isSensor()) continue;
    const da = fa.getUserData();
    const db = fb.getUserData();
    if (!da || !db || !da.car || !db.car) continue;
    const a = da.car;
    const b = db.car;
    if (a === b || a.kind !== 'ai' || b.kind !== 'ai' || a.dead || b.dead) continue;
    const key = a.id < b.id ? a.id * 100000 + b.id : b.id * 100000 + a.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const same = a.color === b.color;
    links.push([a, b, same]);
    if (same) {
      const ra = find(parent, index.get(a));
      const rb = find(parent, index.get(b));
      if (ra !== rb) parent[ra] = rb;
    }
  }

  const comps = new Map();
  for (let i = 0; i < cars.length; i++) {
    const r = find(parent, i);
    let list = comps.get(r);
    if (!list) comps.set(r, (list = []));
    list.push(cars[i]);
  }

  const groups = [];
  const ready = [];
  let gid = 0;
  for (const list of comps.values()) {
    if (list.length < M.minGroup) {
      for (const car of list) {
        car.matchTimer = 0;
        car.groupId = -1;
      }
      continue;
    }
    let oldest = 0;
    for (const car of list) {
      car.matchTimer += dt;
      car.groupId = gid;
      if (car.matchTimer > oldest) oldest = car.matchTimer;
    }
    groups.push(list);
    if (oldest >= M.delay) ready.push(list);
    gid++;
  }

  return { links, groups, ready };
}

export function scoreFor(n, combo) {
  const M = CONFIG.match;
  return Math.round(M.pointsPerCar * n * (1 + 0.5 * (n - M.minGroup)) * combo);
}
