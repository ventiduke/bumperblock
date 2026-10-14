# Phase 1 Plan — Playable prototype

## Goal

A phone-playable prototype on GitHub Pages: drive, bump, match, explode,
get boxed in, restart. No menus, sound, or art.

## Tech choice

**Plain HTML5 Canvas + ES modules + [Planck.js](https://piqnt.com/planck.js/)
(v1.4.3), no build step.**

- Planck is a JS port of Box2D. Box2D's rigid-body solver handles stacks of
  boxes pushing each other far better than Matter.js, which tends to feel soft
  and jittery when many bodies are packed together. That's exactly our
  "boxed in by 40 cars" case. Box2D's mass and impulse model is also what makes
  bumps feel weighty.
- Box2D has well-known top-down car techniques: kill lateral velocity for
  tire grip, plus linear and angular damping. It also exposes contact lists and
  post-solve impulses, which we need for matching and impact effects.
- Phaser would bring a scene system, a loader, and its own Matter or Arcade
  physics. For a single-screen prototype with no assets, it's weight we don't
  need, and its Matter integration has the same softness issues.
- Planck is **vendored** at `lib/planck.min.js` (MIT, ~300 KB) instead of
  loaded from a CDN, so playtests don't depend on a third-party CDN and the
  version can't drift.
- ES modules with relative paths work under the `/bumperblock/` Pages
  subpath with no build step. `.nojekyll` stops Jekyll from processing the
  site.

## File structure

```
index.html          page shell, HUD markup, loads planck + js/main.js
style.css           full-screen, no-scroll, no-zoom layout; HUD styles
config.js           ALL tuning values (one place to tweak feel)
lib/planck.min.js   physics (vendored)
js/main.js          bootstrap, fixed-timestep loop, game state, restart
js/physics.js       world, arena walls, car bodies, top-down tire model
js/player.js        player drive, steering, boost, stuck detection
js/ai.js            wander AI, stun after hits
js/spawner.js       edge spawning with ramping rate
js/match.js         contact graph -> same-color groups -> timed explosions
js/effects.js       particles, floating score text, screen shake
js/render.js        canvas drawing (arena, cars, effects, debug overlay)
js/input.js         touch halves, keyboard, boost button
js/hud.js           DOM HUD: score, boost meter, game over panel
docs/               design + this plan
```

## Architecture

- **Units.** Physics runs in meters (arena 14 × 25 m, car 1.0 × 1.8 m). The
  renderer scales the whole arena to fit the screen, so the full arena is
  always visible. World +y points down the screen, which keeps the math and
  the drawing in the same frame.
- **Loop.** `requestAnimationFrame` with a fixed 60 Hz physics step and an
  accumulator (max 4 substeps per frame, so a background tab can't cause a
  spiral of catch-up steps). Per step: input → player/AI forces → `world.step`
  → match detection → removals → effects.
- **Car model.** A dynamic box body. Each step:
  - Lateral velocity is cancelled with an impulse capped at `lateralGrip`, so
    cars grip when driving but can be shoved sideways.
  - A drive force along the forward axis is applied up to top speed.
  - Linear and angular damping handle rolling drag.
  - The player sets angular velocity directly (lerped) for crisp steering.
  - AI steers toward a wander heading.
- **Stun.** When an AI car takes a hard hit, it stops driving and gets extra
  damping for `ai.stunTime`. This lets pushed cars stay where you put them,
  which is what makes deliberate grouping possible.
- **Contact sensing.** Each car has a second, slightly larger **sensor**
  fixture (`match.contactMargin` bigger). It only overlaps the solid fixtures
  of other cars, so "touching" means within a few cm. Raw Box2D contacts
  flicker as bodies separate by micrometers; the sensor gives stable groups.
- **Matching.** Each step, walk `world.getContactList()`, union-find
  same-colored car pairs whose sensor contact is touching, and collect
  components of size ≥ `match.minGroup`. Every car in such a component
  accumulates a `matchTimer`. A component explodes when its oldest member's
  timer reaches `match.delay`, so late joiners don't reset the countdown. Cars
  outside a qualifying group reset to 0. Pending cars pulse white, and links
  are drawn between them.
- **Explosion.** Destroy the bodies (outside `world.step`), add particles and a
  radial impulse that shoves and stuns neighbors (this can chain), then score:
  `pointsPerCar × n × (1 + 0.5 × (n − minGroup))`, multiplied by a combo
  counter if it lands within `comboWindow` of the previous explosion.
- **Spawning.** The spawn interval ramps linearly from `startInterval` to
  `minInterval` over `rampTime` seconds, capped at `maxCars`. A spawn point is
  a random spot just inside a random edge, heading inward. It's rejected if an
  AABB query finds anything there, and retried next step.
- **Game over.** When player speed is below `stuck.speed` while the solid body
  touches at least one AI car, `stuckTimer` accumulates; otherwise it decays
  quickly. At `stuck.time` the game is over. A ring around the player fills as
  a warning.
- **Debug (`?debug=1`).** Shows fixture outlines (solid and sensor), contact
  links (colored for same-color, grey otherwise), group ids and timers, FPS,
  car count, spawn interval, and the stuck timer. `window.bumper` exposes
  game internals for automated testing in every mode.

## Task breakdown

1. Docs: design + plan.
2. Scaffold: `index.html`, `style.css`, `config.js`, vendored Planck,
   `.nojekyll`. Full-screen portrait canvas with no scroll or zoom.
3. Physics and player: world, walls, car body and tire model, player drive and
   steer, keyboard and touch input.
4. Boost: charge meter, burst, HUD meter.
5. AI and spawning: wander, stun, edge spawner with ramp.
6. Matching and effects: sensors, union-find groups, delayed explosion,
   particles, score, combo, screen shake on hard hits.
7. Game over and restart, HUD polish.
8. Debug overlay.
9. Verify in headless Chromium: desktop controls, forced match, forced
   box-in, no console errors, 40-car frame time.

## Assumptions and calls made

- **Repo name.** The repo is `ventiduke/bumperblock`, so the Pages URL is
  `https://ventiduke.github.io/bumperblock/`. Relative paths mean the subpath
  doesn't matter.
- **Whole arena on screen**, with no camera follow. Matching needs board
  awareness, like a puzzle grid. The arena aspect (14:25) is close to a phone's
  play area under the HUD bar, and it's letterboxed if the screen differs.
- **4 colors** by default (`colors` in config; drop one to make it easier).
- **The player has no color** and never counts toward matches.
- **"In contact with other cars"** for game over means the solid body touches
  an AI car. Walls alone don't count: you can always steer off a wall.
- **Boost** costs `boost.cost` (half the meter) per use, so you can double
  boost from full. The meter refills over `boost.rechargeTime`.
- **Boost button bottom-right.** It sits over the right steering half, but
  touches on the button never steer. Holding both halves (or neither) means
  go straight.
- **Car cap** of 40 AI cars (`spawn.maxCars`), per the perf target. Once the
  cap is hit, spawning waits until matches free up slots.
- **Steering in place.** The player can still turn slowly at zero speed
  (`player.minTurnFactor`). Otherwise a head-on stop against a car would be an
  instant, unfair loss.
- **Spawning** happens just inside the walls, not through gates. It's checked
  for clearance so it never spawns overlapping.
- **Starting state:** 6 AI cars, placed away from the player.

## Findings from verification

Things headless testing turned up, and the changes made:

- **Sensor filtering.** Sensors detected nothing at first: the solid
  fixture's mask has to include the sensor category too. That's fixed in
  `physics.js`.
- **Spawn clearance.** The broadphase uses fattened AABBs, which made every edge
  spawn look blocked by the wall. `areaClear` now re-checks each fixture's real
  AABB.
- **Unfair box-ins.** Because the player always accelerates, a nose-on push
  into a car turned the whole drive force into contact friction, which
  cancelled the lerped steering. The player froze and lost with only one car
  nearby. The fixes:
  - `player.steerResponse` raised from 14 to 45, so angular velocity is set
    almost directly.
  - Car-car friction lowered to 0.15.
  - A separate, low `wallFriction`.
  - The player is no longer a Box2D `bullet`.

  A pinned player can now pivot free in under a second. A player who doesn't
  steer still loses at 2.0 s.
- **Self-matching.** The AI forms matches on its own (about 13 in 90 s with the
  player parked) because wandering cars bump and stun each other. Spawning was
  ramped up a little to keep pressure on. `ai.stunFromAI` and the color count
  are the knobs for this.
- **Rendering.** Path fills beat pre-rendered sprites in headless Chromium,
  which uses a software rasterizer, so cars are drawn as paths. With 40 cars,
  the physics step costs ~0.3 ms (1.5 ms with 4× CPU throttle). Frame rate was
  60 fps unthrottled and ~36 fps at 4× throttle on the software rasterizer. A
  real phone's GPU-backed canvas should do better. `render.maxDpr` is the
  fill-rate lever if it doesn't.
