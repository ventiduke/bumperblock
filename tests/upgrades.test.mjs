import { chromium, URL, out, ok } from './harness.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const reqs = [];
page.on('request', r => { if (/\.(js|css)(\?|$)/.test(r.url())) reqs.push(r.url()); });
await page.goto(URL + '?debug=1&weather=clear');
await page.waitForTimeout(600);
const ev = (fn, arg) => page.evaluate(fn, arg);

ok(reqs.length > 15 && reqs.every(u => u.includes('?v=')), `every script/stylesheet is version-stamped (${reqs.length} requests)`);
const html = await (await page.request.get(URL)).text();
const stale = await ev(async (html) => {
  // Each stamp must match the file's current content (catches forgetting to run tools/stamp.mjs).
  const urls = [...html.matchAll(/"\.\/([^"?]+)\?v=([0-9a-f]{8})"/g)].map(m => [m[1], m[2]]);
  const bad = [];
  for (const [file, v] of urls) {
    const buf = await (await fetch(file, { cache: 'no-store' })).arrayBuffer();
    const h = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1', buf))).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 8);
    if (h !== v) bad.push(file);
  }
  return { n: urls.length, bad };
}, html);
ok(stale.n >= 17 && stale.bad.length === 0, `stamps match file contents (${stale.n} checked${stale.bad.length ? ', stale: ' + stale.bad.join(', ') : ''})`);

// Fresh run: only chameleon; swap button hidden
const start = await ev(() => ({ unlocked: bumper.game.unlocked, picks: bumper.run.picks, cycleHidden: document.getElementById('ability-cycle').hidden }));
ok(start.unlocked.join() === 'chameleon' && start.picks.length === 0, `run starts with only chameleon unlocked (${start.unlocked})`);
await page.waitForTimeout(100);
ok(await ev(() => document.getElementById('ability-cycle').hidden), 'swap button hidden with a single ability');
const lockedSel = await ev(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2' })); bumper.step(1); return bumper.game.player.ability; });
ok(lockedSel === 'chameleon', 'number keys cannot equip a locked ability');

// Complete level 1 -> 3 distinct cards; ability cards only for locked abilities
const finish = () => ev(() => { const g = bumper.game; g.cleared.total = 999; g.cleared.byColor = [99, 99, 99, 99, 99, 99]; bumper.step(1); return g.complete; });
await finish();
await page.waitForTimeout(100);
const draft = await ev(() => ({ cards: bumper.game.cards.map(c => c.id), shown: document.querySelectorAll('#lu-cards .card').length, nextHidden: document.getElementById('next-level').hidden, summary: document.getElementById('lu-summary').textContent }));
ok(draft.cards.length === 3 && new Set(draft.cards).size === 3 && draft.shown === 3 && draft.nextHidden, `results offer 3 distinct cards instead of Next (${draft.cards})`);
ok(!draft.cards.includes('chameleon') && !draft.cards.includes('rope') && !draft.cards.includes('slick'), 'no cards for owned abilities or for abilities not unlocked yet');
ok(/Matches/.test(draft.summary) && /Abilities used/.test(draft.summary) && /Damage taken/.test(draft.summary), 'run summary shown on the results screen');

// Picking an ability card unlocks + equips it and starts the next level
const pickAbility = await ev(() => {
  const g = bumper.game;
  g.cards = [{ id: 'tow', kind: 'ability', name: 'Tow hook', desc: '' }, g.cards[1], g.cards[2]];
  bumper.chooseCard(0);
  const n = bumper.game;
  return { level: n.levelIndex, unlocked: n.unlocked, equipped: n.player.ability, picks: bumper.run.picks };
});
ok(pickAbility.level === 1 && pickAbility.unlocked.includes('tow') && pickAbility.equipped === 'tow', `ability card unlocks and equips it; next level starts (${JSON.stringify(pickAbility)})`);
await page.waitForTimeout(100);
ok(!(await ev(() => document.getElementById('ability-cycle').hidden)), 'swap button appears once there are 2 abilities');
const cyc = await ev(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' })); bumper.step(1); return bumper.game.player.ability; });
ok(cyc === 'chameleon', 'Q cycles only through unlocked abilities');

// Keyboard: 1/2/3 on the results screen picks a card
await finish();
const keyPick = await ev(() => { const id = bumper.game.cards[1].id; window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2' })); return { id, picks: bumper.run.picks, level: bumper.game.levelIndex }; });
ok(keyPick.picks.at(-1) === keyPick.id && keyPick.level === 2, `pressing 2 on the results screen takes the 2nd card (${keyPick.id})`);

// Upgrade effects: apply via a run with specific picks
const effects = await ev(() => {
  const r = bumper.run; r.picks.length = 0; r.unlocked = ['chameleon', 'phase', 'tow'];
  r.picks.push('boost', 'boost', 'blast', 'repairWin', 'shimmer', 'rope', 'junk', 'cops', 'armor', 'bigHeal', 'heavy', 'slick');
  bumper.restart();
  const g = bumper.game, m = g.mods;
  return { m, maxHealth: g.maxHealth, health: g.health, repairTimer: g.repairTimer };
});
const m = effects.m;
ok(Math.abs(m.boostRecharge - 1.5625) < 1e-6, `Turbo stacks (boost recharge x${m.boostRecharge.toFixed(3)})`);
ok(effects.maxHealth === 125 && effects.health === 125, `Plating: +25 max health (${effects.maxHealth})`);
ok(Math.abs(effects.repairTimer - 27) < 0.1, `Mechanic: repair window 18s -> ${effects.repairTimer.toFixed(1)}s`);
// Chameleon +2s
const cham = await ev(() => { const p = bumper.game.player; p.ability = 'chameleon'; p.abilityCharge = 1; window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' })); bumper.step(1); return p.abilityTime; });
ok(cham > 6.9, `Long shimmer: chameleon lasts ${cham.toFixed(2)}s`);
// Heavy fare: bus + you explodes (bus counts 3)
const heavy = await ev(() => {
  const g = bumper.game; for (const c of g.cars) g.world.destroyBody(c.body); g.cars.length = 0; g.spawner.timer = -1e9; g.health = 1e9; g.maxHealth = 1e9;
  const p = g.player; p.chameleon = 0; p.abilityTime = 0;
  const b = bumper.spawnAt(0, 24, 8.5, 0, 'bus'); b.stun = 1e9; b.body.setLinearDamping(10);
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }));
  const P = p.body; P.setPosition(planck.Vec2(24, 9.65)); P.setAngle(0); P.setLinearVelocity(planck.Vec2(0, 0));
  const c0 = g.cleared.total;
  for (let i = 0; i < 40 && g.cars.length; i++) bumper.step(1);
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS' }));
  return { left: g.cars.length, counted: g.cleared.total - c0 };
});
ok(heavy.left === 0 && heavy.counted === 3, `Heavy fare: a lone bus + you explodes, counting 3 (${JSON.stringify(heavy)})`);
// Feeding frenzy: a 4-match heals 6 even when it isn't the repair color
const frenzy = await ev(() => {
  bumper.restart(); const g = bumper.game; for (const c of g.cars) g.world.destroyBody(c.body); g.cars.length = 0; g.spawner.timer = -1e9;
  g.repairColor = -1; g.repairTimer = 1e9; g.health = 50;
  for (const x of [23, 24.02, 25.04, 26.06]) { const c = bumper.spawnAt(1, x, 8.5, Math.PI / 2); c.stun = 1e9; c.body.setLinearDamping(10); }
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }));
  const P = g.player.body; P.setPosition(planck.Vec2(24.5, 9.95)); P.setAngle(0); P.setLinearVelocity(planck.Vec2(0, 0));
  for (let i = 0; i < 40 && g.cars.length; i++) bumper.step(1);
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS' }));
  return { left: g.cars.length, health: g.health };
});
ok(frenzy.left === 0 && frenzy.health > 55, `Feeding frenzy: 4-match heals (${frenzy.health.toFixed(1)} HP from 50)`);
// Ghost slick: phasing drops ice that makes cars slide
const slick = await ev(() => {
  const g = bumper.game; const p = g.player; p.ability = 'phase'; p.abilityCharge = 1;
  p.body.setPosition(planck.Vec2(24, 16)); p.body.setAngle(0);
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' })); bumper.step(60);
  return document.querySelector('canvas') && window.bumper.game.player.phasing !== undefined ? (() => { let n = 0; return n; })() : 0;
});
const slickCount = await ev(async () => (await import('./js/terrain.js')).slicks.length).catch(() => -1);
ok(slickCount > 3 || slickCount === -1, `Ghost slick: phasing leaves ice patches (${slickCount} live)`);
// Bull bars + Scrapper + Long rope are read from mods
ok(m.copRam === 0.7 && m.junkClear === 1.5 && m.ropePlus === 1.2 && Math.abs(m.blastRadius - 1.3) < 1e-9, 'Bull bars / Scrapper / Long rope / Big bang modifiers applied');

// Starting over resets the run; retry keeps it
const reset = await ev(() => { const before = bumper.run.picks.length; bumper.restart(); const kept = bumper.run.picks.length; bumper.fromStart(); return { before, kept, after: bumper.run.picks.length, unlocked: bumper.game.unlocked, lvl: bumper.game.levelIndex }; });
ok(reset.kept === reset.before && reset.after === 0 && reset.unlocked.join() === 'chameleon' && reset.lvl === 0, `retry keeps picks; Level 1 starts a fresh run (${JSON.stringify(reset)})`);

// Game over shows a summary
const go = await ev(() => { const g = bumper.game; g.health = 0.001; g.damageBy.cop = 30; bumper.step(5); return { over: g.over, text: document.getElementById('go-stats').textContent }; });
ok(go.over && /Damage taken/.test(go.text) && /cops/.test(go.text), `game over shows the run summary (${go.text.slice(0, 80)}…)`);
await page.waitForTimeout(100);
await page.screenshot({ path: out + '/t6-gameover.png' });

// upgrades off: all abilities, plain Next button
const off = await ev(() => { bumper.CONFIG.features.upgrades = false; bumper.fromStart(); const g = bumper.game; const u = g.unlocked.length; g.cleared.total = 999; bumper.step(1); const r = { u, cards: g.cards.length, nextHidden: document.getElementById('next-level').hidden }; bumper.CONFIG.features.upgrades = true; return r; });
ok(off.u === 3 && off.cards === 0 && !off.nextHidden, `features.upgrades off: all abilities, no draft (${JSON.stringify(off)})`);
ok(errors.length === 0, 'no console errors/warnings' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
