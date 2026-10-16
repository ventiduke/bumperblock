import { chromium, URL, out, ok } from './harness.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.goto(URL + '?debug=1&weather=clear');
await page.waitForTimeout(600);
// These tests cover every ability, so unlock them all (no upgrade draft).
await page.evaluate(() => { bumper.CONFIG.features.upgrades = false; bumper.restart(); });
const ev = (fn, arg) => page.evaluate(fn, arg);
const setup = (px = 4, py = 11, ang = 0) => ev(([px, py, ang]) => {
  bumper.startLevel(0, 0);
  const g = bumper.game;
  for (const c of g.cars) g.world.destroyBody(c.body);
  g.cars.length = 0; g.spawner.timer = -1e9; g.health = 1e9; g.repairColor = -1; g.repairTimer = 1e9;
  const P = g.player.body; P.setPosition(planck.Vec2(px, py)); P.setAngle(ang); P.setLinearVelocity(planck.Vec2(0, 0));
}, [px, py, ang]);
const key = (code, down = true) => ev(([c, d]) => window.dispatchEvent(new KeyboardEvent(d ? 'keydown' : 'keyup', { code: c })), [code, down]);
// stationary upright vehicles
const place = (list) => ev((list) => {
  for (const [col, x, y, type, ang] of list) {
    const c = bumper.spawnAt(col, x, y, ang ?? Math.PI / 2, type || 'car');
    for (const b of [c, c.trailer].filter(Boolean)) { b.stun = 1e9; b.body.setLinearDamping(10); }
  }
}, list);
const holdBrake = async (fn) => { await key('KeyS'); const r = await fn(); await key('KeyS', false); return r; };
const putPlayer = (x, y, a = 0) => ev(([x, y, a]) => { const P = bumper.game.player.body; P.setPosition(planck.Vec2(x, y)); P.setAngle(a); P.setLinearVelocity(planck.Vec2(0, 0)); }, [x, y, a]);
const steps = (n) => ev((n) => { const g = bumper.game; for (let i = 0; i < n && !g.over && !g.complete; i++) bumper.step(1); return g.cars.length; }, n);

// ---- Ability slot ----
await setup();
let ab = await ev(() => ({ a: bumper.game.player.ability, label: document.getElementById('ability-label').textContent }));
ok(ab.a === 'chameleon' && ab.label === 'CHAMELEON', `starts with chameleon equipped (${JSON.stringify(ab)})`);
await page.click('#ability-cycle'); await steps(1);
await key('KeyQ'); await steps(1); await key('KeyQ', false);
await page.waitForTimeout(80);
ab = await ev(() => ({ a: bumper.game.player.ability, label: document.getElementById('ability-label').textContent }));
ok(ab.a === 'tow' && ab.label === 'TOW', `swap button and Q cycle abilities (${JSON.stringify(ab)})`);
await key('KeyQ'); await steps(1); await key('KeyQ', false);
// Number keys pick directly; E still works as an alias for F
const nums = [];
for (const k of ['Digit2', 'Digit3', 'Numpad1']) { await key(k); await steps(1); await key(k, false); nums.push(await ev(() => bumper.game.player.ability)); }
ok(nums.join() === 'phase,tow,chameleon', `1 / 2 / 3 equip abilities directly (${nums.join(' -> ')})`);
await key('KeyE'); await steps(1); await key('KeyE', false);
const eAlias = await ev(() => bumper.game.player.chameleon > 0);
ok(eAlias, 'E still uses the ability');
const lockedPick = await ev(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2' })); bumper.step(1); return bumper.game.player.ability; });
ok(lockedPick === 'chameleon', 'number keys do not swap while an ability is active');
await ev(() => { const p = bumper.game.player; p.abilityTime = 0; p.chameleon = 0; p.abilityCharge = 1; });
const persist = await ev(() => { bumper.restart(); return bumper.game.player.ability; });
ok(persist === 'chameleon', 'equipped ability persists across retries');

// ---- Chameleon ----
await setup();
await place([[0, 24, 8.5], [0, 25.02, 8.5]]);
const noCham = await holdBrake(async () => { await putPlayer(24.5, 9.95); return steps(60); });
ok(noCham === 2, 'pair + player does not explode without chameleon');
await key('KeyF'); await steps(1); await key('KeyF', false);
const cham = await holdBrake(async () => { await putPlayer(24.5, 9.95); return steps(40); });
const chargeAfter = await ev(() => bumper.game.player.abilityCharge);
ok(cham === 0, 'chameleon: pair + player explodes');
ok(chargeAfter < 0.2, `chameleon then recharges from empty (${chargeAfter.toFixed(2)})`);
const swapLocked = await ev(() => { const p = bumper.game.player; bumper.step(60 * 5.5); p.abilityCharge = 1; bumper.step(1); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' })); bumper.step(1); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' })); bumper.step(1); return p.ability; });
ok(swapLocked === 'chameleon', "can't swap while an ability is active");
const recharge = await ev(() => { const p = bumper.game.player; bumper.step(60 * 5.2); const a = p.abilityCharge; bumper.step(60 * 14); return { a, b: p.abilityCharge }; });
ok(recharge.a < 0.05 && recharge.b >= 1, `recharge takes ~14s after it ends (${JSON.stringify(recharge)})`);

// ---- Phase ----
await setup(20, 15.5, 0);
await ev(() => { bumper.game.player.ability = 'phase'; });
await place([[0, 23, 14.5], [1, 23, 15.5], [2, 23, 16.5], [0, 24.02, 14.5], [1, 24.02, 15.5], [2, 24.02, 16.5]]);
await steps(20); // build some speed
await key('KeyF'); const through = await ev(() => { const g = bumper.game; for (let i = 0; i < 70; i++) bumper.step(1); return { x: g.player.body.getPosition().x, phasing: g.player.phasing, cars: g.cars.length, stuck: g.player.stuckTimer }; }); await key('KeyF', false);
ok(through.x > 25.5 && through.cars === 6, `phase: drives straight through a wall of cars (x=${through.x.toFixed(1)})`);
await setup(36, 9, 0);
await ev(() => { const p = bumper.game.player; p.ability = 'phase'; p.abilityCharge = 1; });
await key('KeyF'); const arena = await ev(() => { bumper.step(80); return bumper.game.player.body.getPosition().x; }); await key('KeyE', false);
ok(arena < 39.2, `phase: arena walls stay solid (x=${arena.toFixed(2)})`);
await setup(30, 15.5, 0);
await ev(() => { const p = bumper.game.player; p.ability = 'phase'; p.abilityCharge = 1; });
const ext = await ev(() => {
  const g = bumper.game; const p = g.player;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' })); bumper.step(1);
  p.body.setType('static'); // hold the player still, inside a car, when the phase timer runs out
  const c = bumper.spawnAt(0, 30.2, 15.5, 0); c.stun = 1e9; c.body.setType('static');
  bumper.step(Math.round(60 * 1.6));
  const during = p.phasing;
  g.world.destroyBody(c.body); c.dead = true; g.cars = g.cars.filter(x => !x.dead);
  bumper.step(5);
  p.body.setType('dynamic');
  return { during, after: p.phasing };
});
ok(ext.during && !ext.after, `phase stays on while overlapping a car, ends once clear (${JSON.stringify(ext)})`);

// ---- Tow ----
await setup(10, 11, 0);
await ev(() => { bumper.game.player.ability = 'tow'; });
await place([[0, 7.6, 11, 'car', 0]]);
await ev(() => { bumper.game.cars[0].stun = 0; });
await key('KeyF'); await steps(1); await key('KeyF', false);
const tow1 = await ev(() => { const p = bumper.game.player; return { towed: !!p.towed, label: (bumper.step(1), document.getElementById('ability-label').textContent) }; });
await page.waitForTimeout(60);
const lbl = await ev(() => document.getElementById('ability-label').textContent);
ok(tow1.towed && lbl === 'DROP', `tow hooks the nearest car (button shows ${lbl})`);
const drag = await ev(() => { const g = bumper.game; const c = g.cars[0]; const x0 = c.body.getPosition().x; bumper.step(90); const p = g.player.body.getPosition(), q = c.body.getPosition(); return { moved: q.x - x0, gap: Math.hypot(p.x - q.x, p.y - q.y) }; });
ok(drag.moved > 4 && drag.gap < 2.2 + 1.8 + 0.3, `towed car follows on the rope (moved ${drag.moved.toFixed(1)}m, gap ${drag.gap.toFixed(2)})`);
await key('KeyF'); await steps(1); await key('KeyF', false);
const dropped = await ev(() => ({ towed: bumper.game.player.towed, joints: (() => { let n = 0; for (let j = bumper.game.world.getJointList(); j; j = j.getNext()) n++; return n; })() }));
ok(!dropped.towed && dropped.joints === 0, 'pressing again drops the tow');
// Delivering: towed red touching a red pair counts as part of your chain
await setup(10, 11, 0);
await ev(() => { const p = bumper.game.player; p.ability = 'tow'; p.abilityCharge = 1; });
await place([[0, 7.6, 11, 'car', 0]]);
await key('KeyF'); await steps(1); await key('KeyF', false);
const deliver = await holdBrake(async () => {
  return ev(() => {
    const g = bumper.game; const t = g.player.towed;
    const q = t.body.getPosition();
    for (const dy of [-1.02, 1.02]) { const c = bumper.spawnAt(0, q.x, q.y + dy, 0); c.stun = 1e9; c.body.setLinearDamping(10); }
    for (let i = 0; i < 40 && g.cars.length; i++) bumper.step(1);
    return { left: g.cars.length, towed: g.player.towed };
  });
});
ok(deliver.left === 0 && !deliver.towed, `towed car delivered into a pair sets off the match (${deliver.left} left)`);

// ---- Vehicles ----
await setup();
const types = await ev(() => { const c = {}; for (let i = 0; i < 2000; i++) { const t = bumper.pickType(); c[t] = (c[t] || 0) + 1; } return c; });
ok(types.car && types.motorcycle && types.bus && !types.semi && !types.police, `level 1 mix: cars, motorcycles, buses (${JSON.stringify(types)})`);
const mix4 = await ev(() => { bumper.startLevel(4, 0); const g = bumper.game; for (const x of g.cars) g.world.destroyBody(x.body); g.cars.length = 0; const c = {}; for (let i = 0; i < 2000; i++) { const t = bumper.pickType(); c[t] = (c[t] || 0) + 1; } return c; });
ok(mix4.semi && mix4.police, `later levels add semis and police (${JSON.stringify(mix4)})`);

await setup();
await place([[0, 24, 8.5, 'bus', 0], [0, 24, 9.72, 'car', 0]]);
const bus = await holdBrake(async () => { await putPlayer(24, 10.82); return ev(() => { const g = bumper.game; const c0 = g.cleared.total; for (let i = 0; i < 40 && g.cars.length; i++) bumper.step(1); return { left: g.cars.length, counted: g.cleared.total - c0 }; }); });
ok(bus.left === 0 && bus.counted === 3, `bus counts as 2: bus + car + you explodes, 3 toward the order (${JSON.stringify(bus)})`);

await setup();
await place([[1, 26, 8.5, 'semi', 0]]);
const semiParts = await ev(() => bumper.game.cars.length);
await place([[1, 25.4, 9.72, 'car', 0]]);
const semi = await holdBrake(async () => { await putPlayer(25.4, 10.82); return ev(() => { const g = bumper.game; for (let i = 0; i < 40 && g.cars.length; i++) bumper.step(1); return g.cars.length; }); });
ok(semiParts === 2 && semi === 0, `semi = cab + trailer, counts 2; semi + car + you explodes all three bodies (${semiParts} parts, ${semi} left)`);

await setup(4, 3, 0);
const hinge = await ev(() => {
  const g = bumper.game; g.player.body.setType('static');
  const cab = bumper.spawnAt(2, 20, 16, 0, 'semi'); cab.entering = 0; cab.wanderTimer = 99; cab.heading = 0;
  const d0 = Math.hypot(cab.body.getPosition().x - cab.trailer.body.getPosition().x, cab.body.getPosition().y - cab.trailer.body.getPosition().y);
  let maxDev = 0;
  for (let i = 0; i < 240; i++) {
    if (i === 60) cab.heading = Math.PI / 2;
    bumper.step(1);
    const a = cab.body.getPosition(), b = cab.trailer.body.getPosition();
    maxDev = Math.max(maxDev, Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - d0));
  }
  const rel = Math.abs(Math.atan2(Math.sin(cab.body.getAngle() - cab.trailer.body.getAngle()), Math.cos(cab.body.getAngle() - cab.trailer.body.getAngle())));
  return { d0, maxDev, moved: cab.body.getPosition().x - 20 };
});
ok(hinge.maxDev < 1.0 && hinge.moved > 1, `semi trailer stays hitched while driving and turning (max hitch drift ${hinge.maxDev.toFixed(2)}m)`);

const speeds = await ev(() => {
  bumper.startLevel(0, 0); const g = bumper.game;
  for (const c of g.cars) g.world.destroyBody(c.body); g.cars.length = 0; g.spawner.timer = -1e9;
  g.player.body.setType('static');
  const res = {};
  for (const [t, y] of [['car', 15], ['motorcycle', 17], ['bus', 19.5]]) { const c = bumper.spawnAt(0, 26, y, 0, t); c.entering = 0; c.wanderTimer = 99; c.heading = 0; res[t] = c; }
  bumper.step(120);
  return Object.fromEntries(Object.entries(res).map(([t, c]) => [t, +c.body.getLinearVelocity().length().toFixed(2)]));
});
ok(speeds.motorcycle > speeds.car && speeds.car > speeds.bus, `speeds differ by type (${JSON.stringify(speeds)})`);

await setup(10, 8.5, 0);
const chase = await ev(() => {
  const g = bumper.game; g.player.body.setType('static');
  const c = bumper.spawnAt(1, 19, 8.5, Math.PI / 2, 'police'); c.entering = 0;
  const d0 = 9;
  bumper.step(150);
  const q = c.body.getPosition();
  g.player.body.setType('dynamic');
  return { d0, d1: Math.hypot(q.x - 10, q.y - 8.5) };
});
ok(chase.d1 < 3, `police chase the player (${chase.d0.toFixed(1)}m -> ${chase.d1.toFixed(1)}m)`);

await setup();
await place([[2, 24, 8.5, 'car', 0], [2, 24, 9.33, 'motorcycle', 0], [2, 24, 10.26, 'bus', 0]]);
const convoy = await holdBrake(async () => { await putPlayer(24, 11.41); return ev(() => { const g = bumper.game; const s0 = g.score; let seen = false; for (let i = 0; i < 40 && g.cars.length; i++) { bumper.step(1); if (g.fx.texts.some(t => t.text === 'CONVOY!')) seen = true; } return { left: g.cars.length, pts: g.score - s0, seen }; }); });
ok(convoy.left === 0 && convoy.seen && convoy.pts > 60, `3 vehicle types in one match: CONVOY bonus (${JSON.stringify(convoy)})`);
await page.screenshot({ path: out + '/t5-end.png' });

// natural play for a while with all types, no errors
await ev(() => { bumper.startLevel(4, 0); const g = bumper.game; g.health = 1e9; for (let i = 0; i < 60 * 40; i++) { bumper.step(1); g.player.stuckTimer = 0; if (g.over || g.complete) break; } });
await page.waitForTimeout(300);
await page.screenshot({ path: out + '/t5-mix.png' });
ok(errors.length === 0, 'no console errors/warnings' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
