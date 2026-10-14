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

// Returns { links, playerLinks, groups, primed, ready }:
//   links       - [carA, carB, sameColor] for every touching AI pair
//   playerLinks - cars touching the player that are in a counting-down group
//   groups      - armed qualifying (>= minGroup) groups, counting down
//   primed      - qualifying groups waiting for the player (see match.mode)
//   ready       - subset of groups whose countdown has finished
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
  const nearPlayer = new Set();
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
    if (a === b || a.dead || b.dead) continue;
    if (a.kind === 'player' || b.kind === 'player') {
      nearPlayer.add(a.kind === 'player' ? b : a);
      continue;
    }
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

  // Chain mode: the player is a wildcard link, joining every same-color car
  // it touches into one chain.
  if (M.mode === 'chain') {
    const firstOfColor = new Map();
    for (const car of nearPlayer) {
      const i = index.get(car);
      if (i === undefined) continue;
      const first = firstOfColor.get(car.color);
      if (first === undefined) firstOfColor.set(car.color, i);
      else {
        const ra = find(parent, first);
        const rb = find(parent, i);
        if (ra !== rb) parent[ra] = rb;
      }
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
  const primed = [];
  const ready = [];
  let gid = 0;
  for (const list of comps.values()) {
    const qualifies = list.length >= M.minGroup;
    const armed = qualifies && isArmed(list, M.mode, nearPlayer);
    for (const car of list) car.primed = qualifies && !armed;
    if (!armed) {
      for (const car of list) {
        car.matchTimer = 0;
        car.groupId = -1;
      }
      if (qualifies) primed.push(list);
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

  const playerLinks = [];
  if (M.mode === 'chain') {
    for (const car of nearPlayer) if (car.groupId >= 0) playerLinks.push(car);
  }
  return { links, playerLinks, groups, primed, ready };
}

// In chain mode the player must stay connected for the whole countdown.
// Otherwise a countdown, once started, keeps going even if the trigger lapses.
function isArmed(list, mode, nearPlayer) {
  if (mode === 'any') return true;
  if (mode === 'chain') return list.some((car) => nearPlayer.has(car));
  for (const car of list) {
    if (car.matchTimer > 0) return true;
    if (mode === 'touch' ? nearPlayer.has(car) : car.tag > 0) return true;
  }
  return false;
}

export function scoreFor(n, combo) {
  const M = CONFIG.match;
  return Math.round(M.pointsPerCar * n * (1 + 0.5 * (n - M.minGroup)) * combo);
}
