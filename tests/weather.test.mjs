import { chromium, URL, out, ok } from './harness.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => { navigator.vibrate = () => true; });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.goto(URL + '?debug=1');
await page.waitForTimeout(500);
const ev = (fn, arg) => page.evaluate(fn, arg);
await page.keyboard.press('KeyX'); // unlock audio
// Weather `name` on level 1 with an empty arena; the player parked at (x, y) facing +x.
const clean = (name, x = 6, y = 12) => ev(([name, x, y]) => {
  const C = bumper.CONFIG; C.features.upgrades = false; C.stuck.time = 1e9;
  bumper.setWeather(name); const g = bumper.game;
  for (const c of g.cars) g.world.destroyBody(c.body); g.cars.length = 0; g.spawner.timer = -1e9; g.repairTimer = 1e9;
  g.weather.strikeTimer = 1e9; g.weather.outageTimer = 1e9;
  const P = g.player.body; P.setPosition(planck.Vec2(x, y)); P.setAngle(0); P.setLinearVelocity(planck.Vec2(0, 0));
}, [name, x, y]);

// --- schedule and presets ---
const sched = await ev(() => { bumper.setWeather(null); const r = []; for (let i = 0; i < 8; i++) { bumper.startLevel(i, 0); r.push(bumper.game.weather.spec.name); } return r; });
ok(sched.slice(0, 5).join() === 'sun,rain,wind,night,snow', `levels 1-5 are sun, rain, wind, night, snow (${sched.slice(0, 5)})`);
ok(sched[5] === 'storm' && sched[6] === 'fog' && sched[7] === 'night+rain', `past the list, the weather cycle continues (${sched.slice(5)})`);
const combo = await ev(() => { bumper.setWeather('night+rain'); const s = bumper.game.weather.spec; return { night: !!s.night, rain: s.rain, label: s.label, icon: s.icon }; });
ok(combo.night && combo.rain === 1 && /Night/.test(combo.label) && /Rain/.test(combo.label) && combo.icon.length >= 2, `presets combine with '+' (${combo.label})`);
const off = await ev(() => { const C = bumper.CONFIG; C.features.weather = false; bumper.setWeather('storm'); const n = bumper.game.weather.spec.name; C.features.weather = true; return n; });
ok(off === 'clear', 'features.weather off: always clear');
const hud = await ev(() => { bumper.setWeather('wind'); bumper.step(2); return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => {
  const el = document.getElementById('weather'); r({ hidden: el.hidden, icon: el.querySelector('.icon').textContent, wind: !el.querySelector('.wind').hidden, title: el.title });
}))); });
ok(!hud.hidden && hud.icon && hud.wind && /Wind/.test(hud.title), `HUD shows the weather icon and a wind arrow (${hud.icon})`);
const clearHud = await ev(() => { bumper.setWeather('clear'); return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(document.getElementById('weather').hidden)))); });
ok(clearHud, 'HUD weather chip hidden in clear weather');
const toast = await ev(() => new Promise(r => { bumper.setWeather('snow'); setTimeout(() => r(document.querySelector('#toast .text').textContent), 2900); }));
ok(/Snow/.test(toast), `the level banner is followed by what the weather does ("${toast}")`);

// --- ground grip ---
const grip = await ev(async () => {
  const T = await import('./js/terrain.js');
  const res = {};
  // Grip on open ground (away from any puddle or drift).
  const open = () => { for (let x = 2; x < 38; x++) { const pt = [x, 12.5]; if (!bumper.game.weather.patches.some(p => Math.hypot(pt[0] - p.x, pt[1] - p.y) < p.rx + 0.5) && !bumper.CONFIG.terrain.zones.concat(bumper.CONFIG.terrain.blocks).some(z => Math.abs(pt[0] - z.x) < z.w / 2 + 0.5 && Math.abs(pt[1] - z.y) < z.h / 2 + 0.5)) return pt; } };
  for (const w of ['clear', 'sun', 'rain', 'storm', 'snow', 'night', 'wind', 'fog']) { bumper.setWeather(w); res[w] = T.surfaceAt(...open()).grip; }
  bumper.setWeather('rain');
  const pud = bumper.game.weather.patches.find(p => p.type === 'puddle');
  res.puddles = bumper.game.weather.patches.length;
  res.puddle = T.surfaceAt(pud.x, pud.y).grip;
  bumper.setWeather('snow');
  const dr = bumper.game.weather.patches.find(p => p.type === 'drift');
  res.drift = T.surfaceAt(dr.x, dr.y).speed;
  res.ice = T.surfaceAt(33, 7).grip;
  return res;
});
ok(grip.clear === 1 && grip.sun === 1 && grip.night === 1 && grip.wind === 1 && grip.fog === 1, 'sun, night, wind and fog leave grip alone');
ok(grip.rain === 0.35 && grip.storm === 0.3 && grip.snow === 0.2, `rain, storm and snow cut grip (${grip.rain}, ${grip.storm}, ${grip.snow})`);
ok(grip.puddles === 6 && Math.abs(grip.puddle - 0.175) < 1e-9, `rain lays ${grip.puddles} puddles, slicker still (grip ${grip.puddle})`);
ok(grip.drift < 0.6 && grip.ice < 0.08, `snow drifts are slow (speed x${grip.drift.toFixed(2)}); ice gets even slicker (${grip.ice.toFixed(3)})`);
const patchesClear = await ev(() => { const C = bumper.CONFIG; let bad = 0;
  for (let i = 0; i < 10; i++) { bumper.setWeather('storm+snow'); for (const p of bumper.game.weather.patches) for (const b of [...C.terrain.blocks, ...C.terrain.zones]) if (Math.abs(p.x - b.x) < b.w / 2 + p.rx && Math.abs(p.y - b.y) < b.h / 2 + p.ry) bad++; }
  return bad; });
ok(patchesClear === 0, 'puddles and drifts never overlap blocks or terrain zones');

// A shoved car slides further in the rain.
const slide = async (w) => { await clean(w, 30, 20); return ev(() => { const c = bumper.spawnAt(0, 8, 12, 0); c.body.setLinearVelocity(planck.Vec2(0, -5)); bumper.step(120); return 12 - c.body.getPosition().y; }); };
const dClear = await slide('clear'), dRain = await slide('rain');
ok(dRain > dClear * 1.3, `a car shoved sideways slides further in rain (${dRain.toFixed(2)} m vs ${dClear.toFixed(2)} m)`);

// The player slides wide on a full-lock turn in snow.
const turn = async (w) => { await clean(w, 20, 18); return ev(async () => { const T = await import('./js/terrain.js'); T.patches.length = 0; // no drifts in the way
  const g = bumper.game; const P = g.player.body; P.setPosition(planck.Vec2(30, 16)); P.setAngle(Math.PI);
  bumper.step(60); let slip = 0;
  for (let i = 0; i < 90; i++) { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' })); bumper.step(1);
    const v = P.getLinearVelocity(), a = P.getAngle(); slip = Math.max(slip, Math.abs(-Math.sin(a) * v.x + Math.cos(a) * v.y)); }
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' })); return slip; }); };
const sClear = await turn('clear'), sSnow = await turn('snow');
ok(sSnow > sClear * 4 && sSnow > 2.2, `snow: the player slides on a full-lock turn (sideways ${sSnow.toFixed(2)} m/s vs ${sClear.toFixed(2)})`);

const driftSpeed = await ev(async () => { bumper.setWeather('snow'); const g = bumper.game; for (const c of g.cars) g.world.destroyBody(c.body); g.cars.length = 0; g.spawner.timer = -1e9;
  const d = g.weather.patches.find(p => p.type === 'drift'); const P = g.player.body; P.setAngle(0);
  let v = 0; for (let i = 0; i < 90; i++) { P.setPosition(planck.Vec2(d.x, d.y)); bumper.step(1); v = P.getLinearVelocity().length(); } return v; });
ok(driftSpeed < bumper_top() * 0.65, `snow drifts hold the player well under top speed (${driftSpeed.toFixed(2)} m/s)`);
function bumper_top() { return 7; }

// Snow: you leave tracks even driving straight.
const tracks = async (w) => { await clean(w); return ev(() => { const g = bumper.game; g.marks.length = 0; bumper.step(90); return g.marks.length; }); };
const tClear = await tracks('clear'), tSnow = await tracks('snow');
ok(tClear === 0 && tSnow > 50, `snow leaves tire tracks driving straight (${tSnow} segments; clear ${tClear})`);
const cover = await ev(() => { bumper.setWeather('snow'); const g = bumper.game; const a = g.weather.cover; bumper.step(60 * 15); return [a, g.weather.cover]; });
ok(cover[0] === 0 && cover[1] > 0.4 && cover[1] < 0.6, `snow settles over the floor (${cover[1].toFixed(2)} after 15 s)`);

// --- wind ---
const wind = await ev(() => { bumper.setWeather('wind'); const g = bumper.game; for (const c of g.cars) g.world.destroyBody(c.body); g.cars.length = 0; g.spawner.timer = -1e9;
  g.weather.windAngle = 0; g.weather.gust = 1e9; // a steady full gust toward +x
  const c = bumper.spawnAt(0, 14, 9, Math.PI / 2); const m = bumper.spawnAt(1, 14, 15, Math.PI / 2, 'motorcycle'); const b = bumper.spawnAt(2, 14, 21, Math.PI / 2, 'bus');
  for (const x of [c, m, b]) { x.stun = 1e9; x.body.setLinearDamping(x.spec.stunDamping); }
  const P = g.player.body; P.setPosition(planck.Vec2(3, 2)); P.setAngle(Math.PI / 2);
  const x0 = [c, m, b].map(x => x.body.getPosition().x); const p0 = P.getPosition().x;
  bumper.step(180);
  const dx = [c, m, b].map((x, i) => x.body.getPosition().x - x0[i]);
  return { car: dx[0], moto: dx[1], bus: dx[2], player: P.getPosition().x - p0, strength: g.weather.windStrength };
});
ok(wind.car > 2, `a gust pushes a stalled car downwind (${wind.car.toFixed(2)} m in 3 s at ${wind.strength.toFixed(1)} m/s)`);
ok(wind.moto > wind.car && wind.car > wind.bus && wind.bus > 0, `light vehicles blow further than heavy ones (moto ${wind.moto.toFixed(2)}, car ${wind.car.toFixed(2)}, bus ${wind.bus.toFixed(2)})`);
ok(wind.player > 0.3 && wind.player < wind.car * 0.6, `the player drifts too, but less (${wind.player.toFixed(2)} m)`);
const gusts = await ev(() => { bumper.setWeather('wind'); const g = bumper.game; g.health = 1e9; let lo = 1e9, hi = 0;
  for (let i = 0; i < 60 * 25; i++) { bumper.step(1); lo = Math.min(lo, g.weather.windStrength); hi = Math.max(hi, g.weather.windStrength); g.player.stuckTimer = 0; } return { lo, hi }; });
ok(gusts.hi > gusts.lo * 2, `wind comes in gusts (${gusts.lo.toFixed(2)} - ${gusts.hi.toFixed(2)} m/s)`);
const still = await ev(async () => { const P = await import('./js/physics.js'); bumper.setWeather('rain'); return Math.hypot(P.wind.x, P.wind.y); });
ok(still === 0, 'no wind outside windy weather');

// --- lightning ---
const warn = await ev(() => { bumper.setWeather('storm'); const g = bumper.game; g.health = 1e9; const n = g.weather.stats.strikes; let first = -1;
  for (let i = 0; i < 60 * 30 && first < 0; i++) { bumper.step(1); g.player.stuckTimer = 0; if (g.weather.strikes.length) first = g.weather.strikes[0].t; }
  let steps = 0; while (g.weather.stats.strikes === n && steps < 200) { bumper.step(1); steps++; }
  return { first, steps }; });
ok(warn.first > 1.4 && Math.abs(warn.steps / 60 - bumper_warn()) < 0.1, `storms strike, with a ${(warn.steps / 60).toFixed(2)} s warning ring first`);
function bumper_warn() { return 1.5; }
await clean('storm', 6, 4);
const hit = await ev(() => { const g = bumper.game; g.health = 100;
  const c = bumper.spawnAt(0, 29, 13, Math.PI / 2); const j = bumper.spawnAt(1, 27.5, 15.5, 0); j.junk = true; const far = bumper.spawnAt(2, 36, 13, 0);
  const score = g.score; bumper.strike(28, 13);
  const v = c.body.getLinearVelocity();
  return { vx: v.x, stun: c.stun, junkGone: !g.cars.includes(j), farOk: g.cars.includes(far) && far.stun <= 0, score: g.score - score, health: g.health, cleared: g.weather.stats.junk };
});
ok(hit.vx > 2 && hit.stun > 0, `a strike shoves and stuns nearby cars (${hit.vx.toFixed(1)} m/s)`);
ok(hit.junkGone && hit.cleared === 1 && hit.score === 5, 'lightning destroys junk in range (+5)');
ok(hit.farOk && hit.health === 100, "cars out of range and a distant player aren't touched");
const zap = await ev(() => { const g = bumper.game; g.health = 100; const p = g.player.body.getPosition(); bumper.strike(p.x + 1, p.y); return { hp: g.health, skid: g.player.skid, zapped: g.weather.stats.zapped, by: g.damageBy.lightning }; });
ok(zap.hp === 88 && zap.skid > 0 && zap.zapped === 1 && zap.by === 12, `a strike next to the player costs 12 HP and a skid (${zap.hp} HP left)`);
const target = await ev(() => { bumper.setWeather('storm'); const g = bumper.game; const p = g.player.body.getPosition(); let near = 0;
  for (let i = 0; i < 400; i++) { g.weather.strikeTimer = 0; g.weather.strikes.length = 0; bumper.step(1); const s = g.weather.strikes[0]; if (Math.hypot(s.x - p.x, s.y - p.y) < 9) near++; g.player.stuckTimer = 0; }
  return near / 400; });
ok(target > 0.45 && target < 0.85, `about half the strikes hunt the player (${Math.round(target * 100)}% land within 9 m)`);

// --- night and fog: darker / foggier where there's no light ---
const lum = async (w) => { await clean(w, 20, 9); return ev(() => new Promise(r => {
  const g = bumper.game; g.camera.x = 20; g.camera.y = 9; bumper.step(2); requestAnimationFrame(() => requestAnimationFrame(() => {
    const cv = document.getElementById('game'); const c2 = document.createElement('canvas'); c2.width = cv.width; c2.height = cv.height; const x = c2.getContext('2d', { willReadFrequently: true }); x.drawImage(cv, 0, 0);
    const lumAt = (fx, fy) => { const d = x.getImageData(Math.floor(cv.width * fx) - 20, Math.floor(cv.height * fy) - 20, 40, 40).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; return s / (d.length / 4); };
    r({ edge: lumAt(0.5, 0.92), near: lumAt(0.58, 0.5) });
  }));
})); };
const lClear = await lum('clear'), lNight = await lum('night'), lFog = await lum('fog');
ok(lNight.edge < lClear.edge * 0.6, `night is dark away from the lights (${lNight.edge.toFixed(0)} vs ${lClear.edge.toFixed(0)})`);
ok(lNight.near > lNight.edge * 1.5, `headlights light up the road ahead (${lNight.near.toFixed(0)} vs ${lNight.edge.toFixed(0)})`);
ok(lFog.edge > lClear.edge * 1.8 && lFog.near < lFog.edge, `fog washes out the distance but not the space around you (${lFog.edge.toFixed(0)} far, ${lFog.near.toFixed(0)} near)`);
const towers = await ev(() => { bumper.setWeather('night'); const g = bumper.game; g.weather.outageTimer = 0; const lv = [];
  for (let i = 0; i < 60 * 8; i++) { bumper.step(1); g.player.stuckTimer = 0; lv.push(Math.min(...g.weather.towers.map(t => t.level))); }
  return { n: g.weather.towers.length, out: lv.some(l => l === 0), back: lv[lv.length - 1] === 1 }; });
ok(towers.n === 4 && towers.out && towers.back, 'night: four floodlights; one cuts out now and then, then comes back');

// --- sound ---
const snd = await ev(() => { const c0 = { ...bumper.sfx.counts }; bumper.setWeather('storm'); const g = bumper.game; g.weather.strikeTimer = 0; bumper.step(2); bumper.strike(5, 5);
  const c = bumper.sfx.counts; return { crackle: (c.crackle || 0) - (c0.crackle || 0), thunder: (c.thunder || 0) - (c0.thunder || 0) }; });
ok(snd.crackle >= 1 && snd.thunder >= 1, `lightning crackles before and thunders after (${JSON.stringify(snd)})`);

// --- every preset runs cleanly, with screenshots ---
for (const w of ['sun', 'rain', 'storm', 'snow', 'night', 'wind', 'fog', 'night+rain', 'snow+wind']) {
  await ev((w) => { const C = bumper.CONFIG; C.features.damage = false; bumper.setWeather(w); bumper.step(60 * 8); C.features.damage = true; }, w);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/weather-${w.replace('+', '-')}.png` });
}
ok(true, 'screenshots of every preset in tests/out/weather-*.png');

// Heaviest case: night storm, 60 cars.
const perf = await ev(() => new Promise(r => { const C = bumper.CONFIG; C.features.damage = false; bumper.setWeather('storm+night'); const g = bumper.game;
  for (let x = 2; x < 39; x += 3) for (let y = 2; y < 23; y += 3.2) if (g.cars.length < 60 && bumper.areaClear(x, y, 1)) bumper.spawnAt(Math.floor(Math.random() * 5), x, y, 0);
  let f = 0; const s = performance.now(); const tick = () => { f++; if (performance.now() - s < 2000) requestAnimationFrame(tick); else { C.features.damage = true; r(f / 2); } }; requestAnimationFrame(tick); }));
ok(perf > 55, `60 fps in a night storm with 60 cars (${perf.toFixed(0)})`);
ok(errors.length === 0, 'no console errors/warnings' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
