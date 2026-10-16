import { chromium, URL, out, ok } from './harness.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => { window.__buzz = []; navigator.vibrate = (p) => { window.__buzz.push(p); return true; }; });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.goto(URL + '?debug=1&weather=clear');
await page.waitForTimeout(500);
const ev = (fn, arg) => page.evaluate(fn, arg);
const clean = () => ev(() => {
  bumper.CONFIG.features.upgrades = false;
  bumper.startLevel(0, 0); const g = bumper.game;
  for (const c of g.cars) g.world.destroyBody(c.body); g.cars.length = 0; g.spawner.timer = -1e9; g.repairTimer = 1e9;
  const P = g.player.body; P.setPosition(planck.Vec2(4, 11)); P.setAngle(0); P.setLinearVelocity(planck.Vec2(0, 0));
});
const counts = () => ev(() => ({ ...bumper.sfx.counts }));

// Audio starts on the first key press
const before = await ev(() => ({ muted: bumper.sfx.isMuted() }));
await page.keyboard.press('KeyX');
await page.waitForTimeout(150);
const state = await ev(() => { const c = bumper.sfx; return { ok: typeof c.unlock === 'function' }; });
await clean();
await page.keyboard.press('Space'); // boost
await page.waitForTimeout(100);
let c = await counts();
ok(c.boost >= 1, `audio unlocks on first key; boost plays a sound (${JSON.stringify(c)})`);

// Impact: ram a stationary car at speed
await clean();
await ev(() => { const k = bumper.spawnAt(0, 9, 11, Math.PI / 2); k.stun = 1e9; k.body.setLinearDamping(10); bumper.step(90); });
c = await counts();
ok(c.impact >= 1, `ramming a car plays an impact (${c.impact})`);

// Match: arm tone, explosion, hitstop on a 4-match, vibration
await clean();
const m = await ev(() => {
  const g = bumper.game;
  for (const x of [23, 24.02, 25.04, 26.06]) { const k = bumper.spawnAt(1, x, 8.5, Math.PI / 2); k.stun = 1e9; k.body.setLinearDamping(10); }
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }));
  const P = g.player.body; P.setPosition(planck.Vec2(24.5, 9.95)); P.setAngle(0); P.setLinearVelocity(planck.Vec2(0, 0));
  for (let i = 0; i < 40 && g.cars.length; i++) bumper.step(1);
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS' }));
  return { left: g.cars.length, hitstop: g.hitstop, buzz: window.__buzz.slice() };
});
c = await counts();
ok(m.left === 0 && c.arm >= 1 && c.explode >= 1, `match: arm tone then explosion (${c.arm} arm, ${c.explode} explode)`);
ok(m.hitstop > 0.05, `big match triggers a freeze-frame (${m.hitstop.toFixed(2)}s)`);
const frozen = await ev(() => new Promise(r => { const t0 = bumper.game.elapsed; bumper.game.hitstop = 0.15; setTimeout(() => { const t1 = bumper.game.elapsed; setTimeout(() => r({ during: t1 - t0, after: bumper.game.elapsed - t1 }), 300); }, 80); }));
ok(frozen.during < 0.02 && frozen.after > 0.1, `simulation pauses during the freeze-frame, then resumes (${frozen.during.toFixed(3)}s / ${frozen.after.toFixed(2)}s)`);
ok(m.buzz.some(b => b === 60), `phone vibrates on a big match (${JSON.stringify(m.buzz)})`);

// Ability + cop ram + heal + rust
await clean();
await ev(() => { const p = bumper.game.player; p.abilityCharge = 1; window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' })); bumper.step(1); });
await ev(() => {
  const g = bumper.game; const P = g.player.body; P.setPosition(planck.Vec2(38.9, 12)); P.setAngle(0);
  const k = bumper.spawnAt(1, 38.5, 4, Math.PI / 2, 'police'); k.entering = 0; bumper.step(240);
});
await ev(() => { const g = bumper.game; g.health = 40; g.repairColor = 2; for (const x of [23, 24.02, 25.04]) { const k = bumper.spawnAt(2, x, 16, Math.PI / 2); k.stun = 1e9; k.body.setLinearDamping(10); }
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' })); const P = g.player.body; P.setPosition(planck.Vec2(24, 17.45)); P.setAngle(0); P.setLinearVelocity(planck.Vec2(0, 0));
  for (let i = 0; i < 40; i++) bumper.step(1); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS' })); });
await ev(() => { const g = bumper.game; for (let i = 0; i < 8; i++) { const k = bumper.spawnAt(i % 3, 6 + i * 1.02, 2.2, Math.PI / 2); k.stun = 1e9; k.body.setLinearDamping(10); } bumper.step(60 * 9); });
c = await counts();
ok(c.ability >= 1 && c.ram >= 1 && c.heal >= 1 && c.rust >= 1, `ability, cop ram, heal and rust each have a sound (${c.ability}/${c.ram}/${c.heal}/${c.rust})`);

// Skid marks: sliding on ice leaves marks that fade
await clean();
const sk = await ev(() => {
  const g = bumper.game; const P = g.player.body; P.setPosition(planck.Vec2(30, 7)); P.setAngle(0);
  bumper.step(30); P.setLinearVelocity(planck.Vec2(P.getLinearVelocity().x, 6)); bumper.step(20);
  const n = g.marks.length; bumper.step(60 * 5); return { n, after: g.marks.length };
});
ok(sk.n > 4 && sk.after < sk.n, `sliding leaves skid marks that fade (${sk.n} -> ${sk.after})`);
await ev(() => { const g = bumper.game; const P = g.player.body; P.setPosition(planck.Vec2(30, 7)); bumper.step(30); P.setLinearVelocity(planck.Vec2(P.getLinearVelocity().x, 6)); bumper.step(15); g.over = true; });
await page.waitForTimeout(150);
await page.screenshot({ path: out + '/t7-skid.png' });

// Win / lose / card click / ding
await ev(() => { bumper.CONFIG.features.upgrades = true; bumper.fromStart(); const g = bumper.game; g.cleared.total = 999; bumper.step(1); });
await page.waitForTimeout(100);
await page.click('#lu-cards .card');
await ev(() => { const g = bumper.game; g.health = 0.001; bumper.step(3); g.repairTimer = 0.01; });
c = await counts();
ok(c.win >= 1 && c.click >= 1 && c.lose >= 1, `level clear fanfare, card click, game-over sting (${c.win}/${c.click}/${c.lose})`);
await ev(() => { bumper.restart(); bumper.game.repairTimer = 0.01; bumper.step(2); });
c = await counts();
ok(c.ding >= 1, 'repair color change dings');

// Mute: button toggles, persists across reloads, M key too
await page.click('#mute');
let mu = await ev(() => ({ m: bumper.sfx.isMuted(), cls: document.getElementById('mute').classList.contains('muted'), ls: localStorage.getItem('bumperblock.muted') }));
ok(mu.m && mu.cls && mu.ls === '1', `mute button mutes and remembers (${JSON.stringify(mu)})`);
await page.reload(); await page.waitForTimeout(500);
mu = await ev(() => ({ m: bumper.sfx.isMuted(), cls: document.getElementById('mute').classList.contains('muted') }));
ok(mu.m && mu.cls, 'still muted after reload');
await page.keyboard.press('KeyM');
ok(!(await ev(() => bumper.sfx.isMuted())), 'M toggles sound back on');
const quietBuzz = await ev(() => { bumper.sfx.setMuted(true); window.__buzz.length = 0; bumper.sfx.buzz(50); bumper.sfx.setMuted(false); return window.__buzz.length; });
ok(quietBuzz === 0, 'muting also silences vibration');

// Performance with sound running: 60 cars
const perf = await ev(() => new Promise(r => { bumper.CONFIG.features.damage = false; bumper.startLevel(4, 0); const g = bumper.game;
  for (let x = 2; x < 39; x += 3) for (let y = 2; y < 23; y += 3.2) if (g.cars.length < 60 && bumper.areaClear(x, y, 1)) bumper.spawnAt(Math.floor(Math.random() * 5), x, y, 0);
  let f = 0; const s = performance.now(); const tick = () => { f++; if (performance.now() - s < 2000) requestAnimationFrame(tick); else { bumper.CONFIG.features.damage = true; r(f / 2); } }; requestAnimationFrame(tick); }));
ok(perf > 55, `60 fps with sound running (${perf.toFixed(0)})`);
ok(errors.length === 0, 'no console errors/warnings' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
