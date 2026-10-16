import { chromium, URL, out, ok } from './harness.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.goto(URL + '?debug=1&weather=clear');
await page.waitForTimeout(800);

const setup = (px = 4, py = 11, ang = 0, mode = 'chain') => page.evaluate(([px, py, ang, mode]) => {
  bumper.CONFIG.match.mode = mode;
  bumper.startLevel(0, 0);
  const g = bumper.game;
  for (const c of g.cars) g.world.destroyBody(c.body);
  g.cars.length = 0; g.spawner.timer = -1e9;
  const P = g.player.body; P.setPosition(planck.Vec2(px, py)); P.setAngle(ang); P.setLinearVelocity(planck.Vec2(0, 0));
}, [px, py, ang, mode]);
const key = (code, down) => page.evaluate(([c, d]) => window.dispatchEvent(new KeyboardEvent(d ? 'keydown' : 'keyup', { code: c })), [code, down]);
const fwdSpeed = () => page.evaluate(() => { const b = bumper.game.player.body; const a = b.getAngle(); const v = b.getLinearVelocity(); return v.x * Math.cos(a) + v.y * Math.sin(a); });
// Stationary stunned AI car, upright (1 m wide in x).
const place = (cars) => page.evaluate((cars) => {
  for (const [col, x, y] of cars) { const c = bumper.spawnAt(col, x, y, Math.PI / 2); c.stun = 100; c.body.setLinearDamping(10); }
}, cars);
const nCars = () => page.evaluate(() => bumper.game.cars.length);

ok(await page.evaluate(() => getComputedStyle(document.getElementById('rotate')).display) === 'none', 'landscape: no rotate prompt');

// Camera follows and stays clamped to the arena.
await setup(4, 11, 0);
await page.evaluate(() => { const P = bumper.game.player.body; P.setPosition(planck.Vec2(36, 20)); P.setAngle(Math.PI / 2); });
await page.waitForTimeout(1500);
const cam = await page.evaluate(() => ({ ...bumper.game.camera, hw: innerWidth / 2 / (innerHeight / 14), hh: 7 }));
ok(cam.x > 40 - cam.hw && cam.y > 24 - cam.hh, `camera followed player to the far corner (cam ${cam.x.toFixed(1)}, ${cam.y.toFixed(1)})`);
ok(cam.x + cam.hw <= 40 + 1.4 && cam.y + cam.hh <= 24 + 1.4, 'camera clamped at arena edge');
await page.screenshot({ path: out + '/t3-corner.png' });

// Brake and reverse
await setup(4, 11, 0); await page.evaluate(() => bumper.step(60));
const v0 = await fwdSpeed();
await key('KeyS', true); await page.evaluate(() => bumper.step(105)); const vr = await fwdSpeed(); await key('KeyS', false);
ok(v0 > 6 && vr < -2.5, `brake then reverse (${v0.toFixed(1)} -> ${vr.toFixed(2)})`);

// Chain mode: AI trio alone stays primed
await setup(4, 11, 0);
await place([[0, 24, 8.5], [0, 25.02, 8.5], [0, 26.04, 8.5]]);
await page.evaluate(() => bumper.step(90));
let st = await page.evaluate(() => ({ n: bumper.game.cars.length, primed: bumper.game.matchInfo.primed.length }));
ok(st.n === 3 && st.primed === 1, `chain: trio without the player stays primed (${JSON.stringify(st)})`);

// Player touching the trio and holding (braking) sets it off
await key('KeyS', true);
await page.evaluate(() => { const P = bumper.game.player.body; P.setPosition(planck.Vec2(25, 9.95)); P.setAngle(0); P.setLinearVelocity(planck.Vec2(0, 0)); });
const boom = await page.evaluate(() => { const g = bumper.game; let i = 0; for (; i < 60 && g.cars.length; i++) bumper.step(1); return { n: g.cars.length, steps: i, score: g.score }; });
await key('KeyS', false);
ok(boom.n === 0 && boom.steps >= 17 && boom.steps <= 22, `chain: player touching trio -> explodes after ~0.3s (${JSON.stringify(boom)})`);

// Player as a bridge: red | player | red red
await setup(4, 11, 0);
await place([[0, 24, 8.5], [0, 26.1, 8.5], [0, 27.12, 8.5]]);
await page.evaluate(() => bumper.step(30));
const pre = await page.evaluate(() => bumper.game.matchInfo.primed.length);
await key('KeyS', true);
await page.evaluate(() => { const P = bumper.game.player.body; P.setPosition(planck.Vec2(25.05, 8.5)); P.setAngle(-Math.PI / 2); P.setLinearVelocity(planck.Vec2(0, 0)); });
const br = await page.evaluate(() => { const g = bumper.game; for (let i = 0; i < 60 && g.cars.length; i++) bumper.step(1); return g.cars.length; });
await key('KeyS', false);
ok(pre === 0 && br === 0, `chain: player bridging red | P | red red explodes all three (before: ${pre} primed, after: ${br} left)`);

// Pair + player is not enough (player doesn't count toward 3)
await setup(4, 11, 0);
await place([[1, 24, 8.5], [1, 25.02, 8.5]]);
await key('KeyS', true);
await page.evaluate(() => { const P = bumper.game.player.body; P.setPosition(planck.Vec2(24.5, 9.95)); P.setAngle(0); });
await page.evaluate(() => bumper.step(60));
await key('KeyS', false);
ok(await nCars() === 2, 'chain: pair + player does not explode');

// Pulling away before the delay cancels
await setup(4, 11, 0);
await place([[2, 24, 8.5], [2, 25.02, 8.5], [2, 26.04, 8.5]]);
await key('KeyS', true);
await page.evaluate(() => { const P = bumper.game.player.body; P.setPosition(planck.Vec2(25, 9.95)); P.setAngle(0); P.setLinearVelocity(planck.Vec2(0, 0)); });
const cancel = await page.evaluate(() => {
  const g = bumper.game; bumper.step(9);
  const mid = g.cars[0].matchTimer;
  g.player.body.setPosition(planck.Vec2(10, 11));
  bumper.step(60);
  return { mid, n: g.cars.length, timer: g.cars[0].matchTimer };
});
await key('KeyS', false);
ok(cancel.mid > 0.1 && cancel.n === 3 && cancel.timer === 0, `chain: pulling away mid-countdown cancels (${JSON.stringify(cancel)})`);

// Driving into a primed group naturally (player auto-drives into it)
await setup(25, 13.5, -Math.PI / 2);
await page.evaluate(() => { bumper.game.player.body.setPosition(planck.Vec2(25, 13.5)); });
await place([[3, 24, 8.5], [3, 25.02, 8.5], [3, 26.04, 8.5]]);
const drive = await page.evaluate(() => { const g = bumper.game; for (let i = 0; i < 180 && g.cars.length; i++) bumper.step(1); return g.cars.length; });
ok(drive === 0, `chain: ramming into a trio and pushing sets it off (${drive} left)`);

// Other modes still work
await setup(4, 11, 0, 'any');
await place([[0, 24, 8.5], [0, 25.02, 8.5], [0, 26.04, 8.5]]);
await page.evaluate(() => bumper.step(40));
ok(await nCars() === 0, "mode 'any' still works");
await page.evaluate(() => { bumper.CONFIG.match.mode = 'chain'; });

// Colors: 3 at the start, more later, with a toast
await setup(4, 11, 0);
const colors = await page.evaluate(() => {
  bumper.CONFIG.features.levels = false;
  bumper.CONFIG.features.damage = false;
  bumper.restart();
  const g2 = bumper.game; g2.spawner.timer = 0;
  const start = new Set(g2.cars.map(c => c.color));
  for (const c of g2.cars) g2.world.destroyBody(c.body); g2.cars.length = 0;
  g2.elapsed = 46;
  bumper.CONFIG.spawn.maxCars = 200;
  for (let i = 0; i < 60 * 40; i++) { bumper.step(1); g2.player.stuckTimer = 0; if (g2.over) break; }
  bumper.CONFIG.spawn.maxCars = 80;
  bumper.CONFIG.features.levels = true;
  bumper.CONFIG.features.damage = true;
  const later = new Set(g2.cars.map(c => c.color));
  return { start: [...start].sort(), later: [...later].sort(), n: g2.colors, toast: document.getElementById('toast').className };
});
ok(Math.max(...colors.start) <= 2 /* endless mode */ && colors.later.includes(3) && Math.max(...colors.later) <= 3 && colors.n === 4,
  `colors: start ${colors.start}, after 45s ${colors.later} (count ${colors.n})`);
ok(colors.toast.includes('show'), 'new color toast shown');

// Terrain still works at the new positions
await setup(5, 18.5, 0);
const mud = await page.evaluate(() => { bumper.step(60); const b = bumper.game.player.body; return { v: b.getLinearVelocity().length(), x: b.getPosition().x }; });
ok(mud.v > 2.5 && mud.v < 3.4 && mud.x < 12.5, `mud slows (${mud.v.toFixed(2)} m/s)`);
await setup(31, 7, 0);
const ice = await page.evaluate(() => { const b = bumper.game.player.body; bumper.step(20); b.setLinearVelocity(planck.Vec2(b.getLinearVelocity().x, 5)); bumper.step(15); return Math.abs(b.getLinearVelocity().y); });
ok(ice > 2, `ice slides (${ice.toFixed(2)} m/s sideways left)`);
await setup(15.5, 12, 0);
const blk = await page.evaluate(() => { bumper.step(90); return bumper.game.player.body.getPosition().x; });
ok(blk < 17.2, `central island is solid (stopped at x=${blk.toFixed(2)})`);

// Game over pinned against the island
await setup(15.0, 12, 0);
const go = await page.evaluate(() => {
  const g = bumper.game; bumper.spawnAt(0, 17.45, 12, Math.PI / 2);
  let s = -1, o = -1;
  for (let i = 0; i < 400; i++) { bumper.step(1); if (s < 0 && g.player.stuckTimer > 0) s = i; if (g.over) { o = i; break; } }
  return (o - s) / 60;
});
ok(go > 1.8 && go < 2.4, `game over after ${go.toFixed(2)}s pinned`);
await page.waitForTimeout(100);
ok(await page.isVisible('#gameover'), 'game over panel visible');
await page.click('#restart-big');
ok(await page.evaluate(() => !bumper.game.over), 'play again resets');

// Portrait phone: rotate prompt + paused
const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const pp = await pctx.newPage();
pp.on('pageerror', e => errors.push('portrait: ' + e.message));
await pp.goto(URL + '?weather=clear'); await pp.waitForTimeout(400);
const e0 = await pp.evaluate(() => bumper.game.elapsed); await pp.waitForTimeout(500);
ok(await pp.evaluate(() => bumper.game.elapsed) === e0, 'portrait phone: paused behind rotate prompt');
await pctx.close();

// ---- Levels ----
const trioAt = (col, x = 24, y = 8.5) => place([[col, x, y], [col, x + 1.02, y], [col, x + 2.04, y]]);
const touchTrio = async () => {
  await key('KeyS', true);
  await page.evaluate(() => { const P = bumper.game.player.body; P.setPosition(planck.Vec2(25, 9.95)); P.setAngle(0); P.setLinearVelocity(planck.Vec2(0, 0)); });
  await page.evaluate(() => { const g = bumper.game; for (let i = 0; i < 60 && !g.complete && g.cars.length; i++) bumper.step(1); });
  await key('KeyS', false);
};
await setup(4, 11, 0);
await page.evaluate(() => { bumper.game.cleared.total = 12; });
await trioAt(0); await touchTrio();
await page.waitForTimeout(100);
let lv = await page.evaluate(() => ({ complete: bumper.game.complete, score: bumper.game.score, visible: !document.getElementById('levelup').hidden, stars: document.querySelectorAll('#lu-stars .on').length, label: document.getElementById('goal-items').textContent }));
ok(lv.complete && lv.visible && lv.stars === 3 && lv.score > 30, `level 1 completes at 15 cleared, results with 3 stars and bonus (score ${lv.score})`);
await page.screenshot({ path: out + '/t3-levelup.png' });
const frozen = await page.evaluate(() => { const t = bumper.game.elapsed; bumper.step(30); return bumper.game.elapsed === t; });
ok(frozen, 'play pauses on the results screen');
await page.click('#lu-cards .card');  // take the first upgrade card to continue
await page.waitForTimeout(100);
lv = await page.evaluate(() => ({ idx: bumper.game.levelIndex, colors: bumper.game.colors, score: bumper.game.score, chips: document.querySelectorAll('#goal-items .chip').length, hidden: document.getElementById('levelup').hidden, toast: document.querySelector('#toast .text').textContent }));
ok(lv.idx === 1 && lv.colors === 4 && lv.chips === 4 && lv.hidden && lv.score > 30, `next level: level 2, 4 colors, per-color goal chips, score carried (${JSON.stringify(lv)})`);
ok(lv.toast.startsWith('Level 2'), `level intro banner (${lv.toast})`);
// Per-color goal: needs every color
const each = await page.evaluate(() => {
  const g = bumper.game; for (const c of g.cars) g.world.destroyBody(c.body); g.cars.length = 0; g.spawner.timer = -1e9;
  g.cleared.byColor = [6, 6, 6, 3]; g.cleared.total = 21; bumper.step(2); return g.complete;
});
ok(!each, 'per-color goal not met while one color is short');
await trioAt(3); await touchTrio();
ok(await page.evaluate(() => bumper.game.complete), 'per-color goal completes when the last color is cleared');
// Retry keeps the level and its starting score
await page.evaluate(() => { bumper.nextLevel(); });
const retry = await page.evaluate(() => { const s0 = bumper.game.levelStartScore; bumper.game.score += 500; bumper.restart(); return { idx: bumper.game.levelIndex, score: bumper.game.score, s0 }; });
ok(retry.idx === 2 && retry.score === retry.s0, `retry restarts the same level with its starting score (${JSON.stringify(retry)})`);
// Levels past the list keep scaling
const scale = await page.evaluate(() => { bumper.startLevel(7, 0); const l = bumper.game.level; return { colors: l.colors, each: l.each, start: l.spawn.startInterval }; });
ok(scale.colors === 6 && scale.each > 6 && scale.start < 1.1, `levels past the list scale up (${JSON.stringify(scale)})`);

// ---- Damage ----
await setup(4, 11, 0);
const ram = await page.evaluate(() => {
  const g = bumper.game; g.repairTimer = 1e9;
  bumper.spawnAt(0, 9, 11, Math.PI / 2);
  const h0 = g.health; bumper.step(60); return { lost: h0 - g.health };
});
ok(ram.lost < 1.5, `normal-speed ram on an AI car costs ~nothing beyond wear (${ram.lost.toFixed(2)} HP in 1s)`);
// Ramming a car pinned against a wall: your fault, free. Getting slammed: costs.
await setup(33, 14, 0);
const pinRam = await page.evaluate(() => {
  const g = bumper.game; g.repairTimer = 1e9;
  const c = bumper.spawnAt(0, 39.45, 14, Math.PI / 2); c.stun = 100;
  const h0 = g.health; bumper.step(60); return { lost: h0 - g.health, by: g.damageBy };
});
ok(pinRam.by.hit < 0.5, `ramming a car pinned to a wall is free (hit dmg ${pinRam.by.hit.toFixed(2)})`);
await setup(20, 15.5, 0);
const slam = await page.evaluate(() => {
  const g = bumper.game; g.repairTimer = 1e9;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }));
  bumper.step(5);
  const c = bumper.spawnAt(0, 20, 18.5, -Math.PI / 2); c.stun = 100; c.body.setLinearDamping(0);
  c.body.setLinearVelocity(planck.Vec2(0, -14));
  for (let i = 0; i < 30; i++) bumper.step(1);
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS' }));
  return g.damageBy.hit;
});
ok(slam > 0.5, `getting slammed by a fast car costs health (${slam.toFixed(1)} HP)`);
await setup(30, 11, 0);
const wall = await page.evaluate(() => {
  const g = bumper.game; g.repairTimer = 1e9;
  const b = g.player.body; b.setLinearVelocity(planck.Vec2(14, 0));
  const h0 = g.health; bumper.step(90); return h0 - g.health;
});
ok(wall > 2, `high-speed wall hit costs health (${wall.toFixed(1)} HP)`);
// Sandwiched: nose against the top wall, a car leaning on the player's side.
await setup(37, 1.2, -Math.PI / 2);
const sq = await page.evaluate(() => {
  const g = bumper.game; g.repairTimer = 1e9;
  const c = bumper.spawnAt(0, 35.95, 1.2, -Math.PI / 2); c.stun = 100;
  bumper.step(10);
  const h0 = g.health; let squeezed = 0;
  for (let i = 0; i < 60; i++) { c.body.applyForceToCenter(planck.Vec2(30, 0), true); bumper.step(1); if (g.squeezed) squeezed++; }
  return { lost: h0 - g.health, squeezed };
});
ok(sq.squeezed > 50 && sq.lost > 4.5 && sq.lost < 8, `sandwiched between wall and car: squeeze drains ~6 HP/s (${sq.lost.toFixed(1)} HP/s, ${sq.squeezed}/60 steps)`);
await setup(4, 11, 0);
const heal = await page.evaluate(() => { const g = bumper.game; g.repairColor = 1; g.repairTimer = 1e9; g.health = 50; return 0; });
await trioAt(1); await touchTrio();
const h1 = await page.evaluate(() => bumper.game.health);
await trioAt(2); await touchTrio();
const h2 = await page.evaluate(() => bumper.game.health);
ok(h1 > 70 && h1 <= 75 && h2 < h1, `repair color heals (+${(h1 - 50).toFixed(1)}), other colors don't (${h2.toFixed(1)})`);
// Repair windows: on -> off (no repair color, no healing) -> on (a different color)
const rot = await page.evaluate(() => {
  const g = bumper.game; const c0 = g.repairColor; g.repairTimer = 0.02; bumper.step(3);
  const off = { c: g.repairColor, toast: document.querySelector('#toast .text').textContent };
  g.health = 50;
  return { c0, off };
});
await trioAt(rot.c0); await touchTrio();
const offHeal = await page.evaluate(() => bumper.game.health);
await page.waitForTimeout(100);
const offHud = await page.evaluate(() => document.getElementById('repair').classList.contains('none'));
ok(rot.off.c === -1 && rot.off.toast === 'No repairs for now' && offHeal < 50 && offHud,
  `repair window ends: no repair color, no healing, HUD greyed (${JSON.stringify(rot.off)}, hp ${offHeal.toFixed(1)})`);
const on = await page.evaluate(() => { const g = bumper.game; g.repairTimer = 0.02; bumper.step(3); return { c: g.repairColor, toast: document.querySelector('#toast .text').textContent }; });
ok(on.c >= 0 && on.c !== rot.c0 && on.toast === 'Repair color', `next repair window picks a new color (${rot.c0} -> ${on.c})`);
await setup(4, 11, 0);
const wreck = await page.evaluate(() => { const g = bumper.game; g.health = 0.3; bumper.step(60); return { over: g.over, title: document.getElementById('go-title').textContent }; });
ok(wreck.over && wreck.title === 'Wrecked!', 'health 0 -> Wrecked! game over');
await page.waitForTimeout(100);
await page.screenshot({ path: out + '/t3-wrecked.png' });
await page.click('#restart-big');

// ---- Pile-ups ----
const clump = (n, y = 15.5, x0 = 22) => page.evaluate(([n, y, x0]) => {
  for (let i = 0; i < n; i++) { const c = bumper.spawnAt(i % 3, x0 + i * 1.02, y, Math.PI / 2); c.stun = 1e9; c.body.setLinearDamping(10); }
}, [n, y, x0]);
await setup(4, 11, 0);
await clump(8);
const rust = await page.evaluate(() => {
  const g = bumper.game; g.health = 1e9;
  bumper.step(60 * 3); const mid = g.cars.filter(c => c.rust > 0).length;
  bumper.step(60 * 6);
  return { mid, junk: g.cars.filter(c => c.junk).length, colors: g.cars.map(c => c.color) };
});
ok(rust.mid === 8 && rust.junk === 8 && rust.colors.every(c => c === -1), `8-car clump rusts into junk after ~6s (${JSON.stringify(rust)})`);
await page.screenshot({ path: out + '/t3-junk.png' });
await setup(4, 11, 0);
await clump(6);
const small = await page.evaluate(() => { const g = bumper.game; g.health = 1e9; bumper.step(60 * 9); return g.cars.filter(c => c.junk || c.rust > 0).length; });
ok(small === 0, 'a 6-car clump (below pile-up size) does not rust');
const junkNoMatch = await page.evaluate(() => { bumper.CONFIG.match.mode = 'any'; const g = bumper.game; for (const c of g.cars) { c.junk = true; c.color = -1; } bumper.step(60); bumper.CONFIG.match.mode = 'chain'; return g.cars.length; });
ok(junkNoMatch === 6, 'junk never matches, even in any mode');
// Clean-up save: explode a trio next to junk
await setup(4, 11, 0);
await clump(8);
await page.evaluate(() => { const g = bumper.game; g.health = 1e9; bumper.step(60 * 9); });
await place([[0, 23, 17.5], [0, 24.02, 17.5], [0, 25.04, 17.5]]);
const save = await page.evaluate(async () => {
  const g = bumper.game; const before = g.cars.filter(c => c.junk).length; const s0 = g.score;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }));
  const P = g.player.body; P.setPosition(planck.Vec2(24, 18.95)); P.setAngle(0); P.setLinearVelocity(planck.Vec2(0, 0));
  for (let i = 0; i < 60; i++) bumper.step(1);
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS' }));
  return { before, after: g.cars.filter(c => c.junk).length, pts: g.score - s0 };
});
ok(save.after < save.before && save.pts > 30, `exploding next to junk clears it for bonus points (${JSON.stringify(save)})`);

// ---- Boost placement + swipe ----
const bb = await page.evaluate(() => { const r = document.getElementById('boost').getBoundingClientRect(); return { cy: (r.top + r.bottom) / 2, h: innerHeight, right: innerWidth - r.right }; });
ok(bb.cy > bb.h * 0.35 && bb.cy < bb.h * 0.65 && bb.right < 30, `boost button sits mid-height on the right edge (center y ${bb.cy.toFixed(0)} of ${bb.h})`);
await setup(4, 11, 0);
const cdp2 = await ctx.newCDPSession(page);
const c0b = await page.evaluate(() => bumper.game.player.boostCharge);
await cdp2.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 300, id: 7 }] });
await cdp2.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y: 270, id: 7 }] });
await cdp2.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y: 230, id: 7 }] });
await page.waitForTimeout(80);
await cdp2.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
const c1b = await page.evaluate(() => bumper.game.player.boostCharge);
ok(c1b < c0b - 0.3, `quick swipe up boosts (charge ${c0b.toFixed(2)} -> ${c1b.toFixed(2)})`);
await cdp2.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 300, id: 8 }] });
await page.waitForTimeout(400);
await cdp2.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y: 220, id: 8 }] });
await cdp2.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
const c2b = await page.evaluate(() => bumper.game.player.boostCharge);
ok(c2b >= c1b - 0.01, 'slow drag up does not boost (steering stays safe)');

// ---- Feature toggles ----
const h0 = await page.evaluate(() => {
  const C = bumper.CONFIG; C.features.damage = false; C.features.levels = false;
  bumper.startLevel(0, 0); return bumper.game.health;
});
await page.waitForTimeout(1000);
const off = await page.evaluate((h0) => {
  const g = bumper.game;
  const vis = (id) => getComputedStyle(document.getElementById(id)).display !== 'none';
  const res = { health: g.health === h0, goalHidden: !vis('goal'), healthHidden: !vis('health') };
  const C = bumper.CONFIG; C.features.damage = true; C.features.levels = true; bumper.startLevel(0, 0);
  return res;
}, h0);
ok(off.health && off.goalHidden && off.healthHidden, `features off: no damage, goal + health HUD hidden (${JSON.stringify(off)})`);

// Perf: 60 cars
await page.evaluate(() => {
  bumper.CONFIG.features.damage = false;
  bumper.restart(); const g = bumper.game; g.spawner.timer = -1e9;
  for (const c of g.cars) g.world.destroyBody(c.body); g.cars.length = 0;
  let n = 0;
  for (let x = 1.6; x < 39 && g.cars.length < 60; x += 2.3) for (let y = 1.4; y < 23 && g.cars.length < 60; y += 1.9) {
    if (Math.hypot(x - 8, y - 12) < 2.5) continue;
    if (!bumper.areaClear(x, y, 1.0)) continue;
    bumper.spawnAt((n++) % 6, x, y, 0);
  }
  bumper.CONFIG.stuck.time = 1e9;
});
const perf = await page.evaluate(() => new Promise(r => {
  const t0 = performance.now(); bumper.step(300); const stepMs = (performance.now() - t0) / 300;
  let frames = 0; const start = performance.now();
  const f = () => { frames++; if (performance.now() - start < 2000) requestAnimationFrame(f); else r({ stepMs, fps: frames / 2, cars: bumper.game.cars.length }); };
  requestAnimationFrame(f);
}));
ok(perf.cars === 60 && perf.fps > 55, `perf: ${perf.cars} cars, step ${perf.stepMs.toFixed(2)}ms, ${perf.fps.toFixed(0)} fps`);
await page.screenshot({ path: out + '/t3-crowd.png' });
ok(errors.length === 0, 'no console errors/warnings' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
