import { chromium, URL, out, ok } from './harness.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(URL + '?weather=clear');
await page.waitForTimeout(400);
const clean = `bumper.startLevel(3, 0); const g = bumper.game; for (const c of g.cars) g.world.destroyBody(c.body); g.cars.length = 0; g.spawner.timer = -1e9; g.repairColor = -1; g.repairTimer = 1e9;`;
// 1. Chase: the player drives in a circle (holding right); the cop should catch up fast.
const r1 = await page.evaluate(new Function(`${clean}
  const P = g.player.body; P.setPosition(planck.Vec2(6, 8.5)); P.setAngle(0);
  const c = bumper.spawnAt(1, 6, 18, -Math.PI / 2, 'police'); c.entering = 0;
  let caught = -1;
  for (let i = 0; i < 60 * 8; i++) {
    // player steers in a circle (holding right) to stay in the arena
    if (i === 0) window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));
    bumper.step(1);
    const a = c.body.getPosition(), b = P.getPosition();
    if (caught < 0 && Math.hypot(a.x - b.x, a.y - b.y) < 2.2) caught = i / 60;
  }
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight' }));
  return { caught, speed: c.body.getLinearVelocity().length() };`));
ok(r1.caught > 0 && r1.caught < 5, `cop catches a circling player in ${r1.caught.toFixed(1)}s (cop speed ${r1.speed.toFixed(1)})`);
// 2. Pushes: player nosed into the right wall (barely moving); a cop comes in from above and shoves it along the wall
const r2 = await page.evaluate(new Function(`${clean}
  const P = g.player.body; P.setPosition(planck.Vec2(38.9, 12)); P.setAngle(0);
  bumper.step(30); const y0 = P.getPosition().y;
  const c = bumper.spawnAt(1, 38.5, 4, Math.PI / 2, 'police'); c.entering = 0;
  bumper.step(210);
  return { shoved: P.getPosition().y - y0, hit: g.damageBy.hit + g.damageBy.squeeze + g.damageBy.cop };`));
ok(r2.shoved > 1.5, `cop shoves the player along the wall (${r2.shoved.toFixed(2)} m)`);
ok(r2.hit > 3, `a cop ram/pin costs health (${r2.hit.toFixed(1)} HP)`);
// 3. Shrugs off hits fast
const r3 = await page.evaluate(new Function(`${clean}
  const c = bumper.spawnAt(1, 30, 8, 0, 'police'); const k = bumper.spawnAt(0, 30, 16, 0, 'car');
  return { cop: (window.bumper.game.cars[0].spec.stunTime), car: window.bumper.game.cars[1].spec.stunTime };`));
ok(r3.cop < 0.5 && r3.car > 1.5, `cops recover from stuns fast (${r3.cop}s vs ${r3.car}s for cars)`);
// 4. Cap of 3
const r4 = await page.evaluate(new Function(`${clean}
  for (let i = 0; i < 3; i++) bumper.spawnAt(0, 10 + i * 3, 3, 0, 'police');
  const picks = {}; for (let i = 0; i < 500; i++) { const t = bumper.pickType(); picks[t] = (picks[t] || 0) + 1; }
  return picks;`));
ok(!r4.police, `no more than 3 cops at once (${JSON.stringify(r4)})`);
ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
