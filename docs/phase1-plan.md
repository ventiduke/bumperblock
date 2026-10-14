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

## Playtest round 1: feedback and changes

Feedback from the first phone playtest:

- It felt fun right away.
- Matches happened at random, so it wasn't clear what the player was doing.
- The car was too fast to position precisely.
- There was never any risk of losing.
- Terrain was requested, and the default orientation should be landscape.

| Feedback | Change |
| --- | --- |
| Random matches, unclear agency | `match.mode = 'tagged'` (default): a group explodes only if a car in it was recently touched by the player (`tagTime`, 4 s). A tagged car passes the tag on only when it hits another car hard (`carryImpulse`), so knock-on shots count but ordinary AI bumps don't spread it. Blasts tag what they shove, so chains still work. Untouched matching groups are **primed** (dashed links and a slow glow) and wait for a bump. Tagged cars get an orange outline. The other modes are `'touch'` (the player must be touching the group) and `'any'` (the original behavior). |
| Hard to position | Holding both sides (or S / Down) brakes at 28 m/s², then reverses up to 3.5 m/s, with white reverse lights. Top speed went from 8.5 to 7 m/s. |
| No risk | The tagged mode removes free clears, so the arena fills. With a random-steering bot, average survival dropped from about 160 s to about 96 s (50 s if it never tries to escape pins), and the board reaches the 40-car cap. |
| Terrain | New `config.terrain`: `blocks` (static walls), plus `zones` of `ice` (grip ×0.08, damping ×0.15) and `mud` (top speed ×0.45, damping ×2.5). These apply to the player and the AI. AI ray-casts ahead and bounces its heading off blocks. The center blocks are attached to the top and bottom walls, because thin gaps between a block and a wall jammed cars. |
| Landscape | The arena is now 25 × 14. The HUD moves into the side margins when they're wide enough (`render.sideHudPx`), with safe-area insets respected. Holding a phone upright shows a "rotate your phone" overlay and pauses the game. Android Chrome also goes full screen and locks to landscape on the first touch. |

**Assumption:** the stuck timer still runs while braking. If you can't move,
you're boxed in, whatever you're pressing.

**Not done yet:** heavy cars that need a group of 4+. These are noted in
`design.md` as a future idea.

## Playtest round 2: feedback and changes

Feedback from the second playtest:

- Much of round 1 worked, but it still felt too easy.
- Try requiring the player to be part of the chain, rather than tagging.
- The arena felt small: add some space so the terrain has room, with a camera
  follow.
- Add more colors as the level goes on.

| Feedback | Change |
| --- | --- |
| Too easy, player should be in the chain | New default `match.mode = 'chain'`. A group arms only while the player's car is within `contactMargin` of one of its cars. The player is a wildcard link that joins every same-color car it touches, but it doesn't count toward `minGroup`. The countdown cancels if the player pulls away; it isn't sticky. A white line from the player to the linked cars shows it's counting. `'tagged'`, `'touch'`, and `'any'` remain as options. |
| Bigger arena, camera | The arena went from 25 × 14 to 40 × 24 m. The camera eases toward the player plus 0.35 s of velocity lead and clamps to the arena (`config.camera`). The view is 14 m tall, so about 30 × 14 m shows on a phone. A minimap (top left) shows terrain, every car, the player, and the current view. Off-screen cars and particles aren't drawn. The terrain was redone for the larger space: two wall stubs, a central island, two pillars, two ice patches, and two mud patches. |
| More colors over time | `colors` holds six colors, and `colorSchedule` sets how many are active over time: 3 at 0 s, 4 at 45 s, 5 at 100 s, 6 at 170 s. A "New color!" toast shows the new swatch. |
| Keep the risk | A bigger arena with wandering AI rarely boxes you in. `spawn.maxCars` went to 80 (about the same density as before) with a faster ramp. **AI drift:** each wander decision heads toward the player with a chance that ramps from 0 to `ai.seekMax` (0.35) over `spawn.rampTime`. |

**Bot measurements** (6 runs each, 4-minute cap, 0.6 s reaction to being
pinned):

- A random-steering bot survives about 187 s and scores about 490.
- A bot that drives at the nearest primed group scores more (about 630 by
  55 s), but dies at about 52 s.

So aggressive play pays but carries risk. With `ai.seekMax` at 0.5 the numbers
barely changed.

**Perf:** 60 cars took about 0.6 ms per physics step and ran at 60 fps
(headless, unthrottled).

## Playtest round 3: urgency and winning

The feedback was that the game still lacked urgency and any sense of winning a
level. The suggestion was damage on impact, repaired by exploding a certain
color. This round adds **level goals** (winning) and **damage and repair**
(urgency). Each can be turned off in `config.features` to compare.

- **Levels** (`js/levels.js`, `config.levels`):
  - Five scripted levels, then scaling (`levelScaling`). Each sets its colors,
    its goal (`{ total }` or `{ each }`), its starting cars, its spawn pace,
    and a par time.
  - Completing a level pauses play and shows the results: time, health, a
    bonus (`levelBonus`), and stars (3 at or under par, 2 within 1.5× par).
  - The score carries into the next level. Retry (↻, R, or the game-over
    button) replays the current level from its starting score. "Level 1"
    starts over.
  - With levels on, the color count is fixed per level and `colorSchedule`
    only applies in endless mode.
- **Damage** (`js/damage.js`, `config.damage`):
  - **Fault-based impacts.** A `pre-solve` hook records each side's closing
    speed before the solver runs. Hits by AI are scaled by the other car's
    share and use their own lower threshold (`hitThreshold`). Boost-rams take
    at least `boostRamMult`, and walls `wallMult`; both use `impactThreshold`.
  - **Squeeze:** while slower than `squeezeSpeed` and touching two or more
    bodies, at least one of them a car.
  - **Wear:** a constant `drainPerSec`.
  - **Repair:** exploding the repair color heals `healPerCar` per car. The
    repair color rotates every `repairRotate` seconds, with a banner.
  - **Feedback:** red flash and a "-N" number on hits, dents as health drops,
    smoke below 50%, and "Wrecked!" at zero.
- **First tuning pass.** Flat impact damage made ramming into packed clusters
  (which chain mode requires) cost about 17 HP per hit, so the game punished
  its own core action. Fault-based damage fixed that: ramming a car pinned to
  a wall now costs 0. Boost-escapes from pins were the next biggest cost, so
  `boostRamMult` went from 0.6 to 0.25. Level 1 went from 20 cars to 15.
- **Bot numbers** (a seeker that drives at primed groups, with 0.6 s
  reactions):
  - Damage is spread across sources: wall, boost, hit, squeeze and wear each
    account for 10–35%.
  - The bot rarely clears level 1, mostly because it gets boxed in or can't
    hold contact long enough to match.
  - Treat this as a weak lower bound, not a target. Real tuning needs a human
    playtest.
- **HUD changes:**
  - The level and goal are shown top center.
  - Health and the repair swatch are on the top right.
  - The top boost bar was removed; the boost button's ring is the meter.
