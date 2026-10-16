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

## Playtest round 4: repair windows, boost placement, pile-ups

Feedback from the fourth playtest:

- It felt good overall.
- For extra difficulty, a health type doesn't always need to be on the field.
- The boost button was too close to where the thumb rests to steer.
- The winning strategy was to wait for a big blob, then plow through it.
  There should be a consequence for letting a blob build, while a "clean-up
  save" stays possible.

| Feedback | Change |
| --- | --- |
| Not always a repair color | Repair windows alternate: a color for `damage.repairOnTime` (18 s), then none for `repairOffTime` (12 s), with a "No repairs for now" banner and a greyed swatch. Each new window picks a different color than the last one. |
| Boost too close to steering | The button moved to the vertical middle of the right edge and shrank to 76 px. A **quick upward swipe** on either side also boosts (`config.input`: 45 px within 350 ms), once per touch. Slow drags don't trigger it, so steering is safe. |
| Blob-waiting strategy | **Pile-ups** (`js/pileup.js`, `config.pileup`, `features.pileups`): touching AI cars of any color are union-found into clumps. Cars in a clump of `size` (7) or more that aren't already counting down build up rust, and turn to junk after `rustTime` ±`rustJitter` (6 ± 1.5 s). Rust drains at `recover` times the rate once the clump breaks up. **Junk** is grey with rust spots, `junkDensity` × heavier, high damping, doesn't drive, and never matches (color −1). It still counts for boxing in, for squeeze damage, and toward pile size. **Clean-up save:** an explosion destroys junk within `clearRadius` (2.6 m) of any exploding car, at `pointsPerJunk` each. |

**Measurement** (player parked, damage off):

- Level 1 has about 8 junk at 40 s, 35 at 80 s, and about 73 of 80 cars at
  120 s.
- Level 3 has about 21 junk at 60 s and 56 at 80 s.

So waiting it out turns the arena into a junkyard within about two minutes.
If that's too harsh, raise `pileup.size` or `rustTime`.

## Round 5: ability slot and vehicle types

This round followed up on the "what next?" discussion. The plan was to
prototype abilities and vehicle variety before building any meta-progression,
since those are what a skill tree would eventually unlock.

- **Abilities** (`js/abilities.js`, `config.abilities`):
  - **Layout and controls:** a left-edge button mirrors boost. The ⇄ button
    (or Q) cycles the equipped ability, and E uses it. `?ability=phase`
    selects one from the URL. The choice persists across levels and retries,
    and you can't swap while an ability is active.
  - **Chameleon (5 s, 14 s recharge):** `match.js` adds 1 to the size of any
    group the player touches. The car shimmers through the active colors.
  - **Phase (1.5 s, 12 s recharge):** the player's solid fixture masks
    everything except `CAT_WALL` (arena walls), and its sensor masks
    everything, so there's no matching while phased. Terrain blocks moved to
    a new `CAT_BLOCK` category so phase passes through them. When the timer
    ends while overlapping something (`testOverlap`), phase extends up to
    `maxExtend`. The car is drawn ghostly.
  - **Tow (6 s recharge after the drop, 10 s max):** a `RopeJoint` from the
    player's rear bumper to the nearer end of the closest car within 3.5 m.
    The towed car doesn't drive and counts as touching the player for chain
    matching, which is how you deliver it into a group. Press again to drop.
    The tow also ends if the car explodes or rusts.
- **Vehicle types** (`config.vehicles`, `vehicleMix`, per-level `types`):
  - Each type overrides `CONFIG.ai` for size, density, speed, accel, turn
    rate and grip, and sets `counts` (its weight toward match size and the
    level order).
  - **Semi:** a cab plus a trailer joined by a `RevoluteJoint` (±1.3 rad).
    Matching always unions the cab and trailer, and each counts 1.
  - **Police:** heads straight at the player within `chaseRange`.
  - **Mix:** level 1 has cars, motorcycles and buses. Level 2 adds semis.
    Level 3 onward uses the full mix, police included.
  - **Spawning:** long vehicles spawn further from the edge, with clearance
    scaled to their length.
- **Convoy:** a group with 3 or more distinct types (a trailer counts as a
  semi) scores ×1.5, with a "CONVOY!" pop-up.
- **Verification:** 24 new checks cover:
  - swapping and persistence of the equipped ability
  - chameleon making a pair explode
  - recharge timing
  - phasing through a wall of cars, arena walls staying solid, and the
    overlap extension
  - tow hook, drag, drop, and delivering a car into a pair
  - each level's vehicle mix
  - bus and semi weights
  - the semi staying hitched
  - per-type speeds
  - police chasing
  - the convoy bonus

  All 47 earlier checks still pass.

**Follow-up:** on desktop, **F** now uses the ability (E still works as an
alias), and **1 / 2 / 3** equip Chameleon / Phase / Tow directly, following
the order in `abilities.list`. Q still cycles. Neither key swaps while an
ability is active.

## Round 6: police tuning

Feedback: "The cops don't feel threatening enough. Maybe they push harder and
chase us down faster?"

- **Root cause:** a cop pressing steadily against the player produced contact
  impulses above the normal 1.2 N·s stun threshold every step. So it stunned
  itself continuously and stopped pushing. Stun thresholds are now per type
  (`stunImpulse`), and police use 8: they only stop for genuinely hard hits,
  and recover in 0.4 s (`stunTime`).
- **Chase:**
  - Speed went from 3.6 to 5.5 m/s, with accel 16 and turn rate 3.4.
  - They spot you from 16 m (was 12) and aim 0.4 s ahead of your velocity
    (`lead`).
  - A cop catches a circling player in about 2.3 s.
- **Push:** density went from 1.3 to 3.0, and lateral grip to 0.6. Even so,
  the player's tire grip (about 3× any car's drive force) made steady pushing
  ineffective. So cops now **ram**: while touching the player they apply a
  `ramShove` (3.5 m/s) kick along their heading every `ramCooldown` (0.8 s),
  cost `ramDamage` (3 HP), and cut the player's grip to 10% for 0.4 s, plus a
  little spin. Pinned against a wall by one cop, the player gets shoved about
  2.7 m and loses about 16 HP over 3.5 s.
- **Cap:** at most `police.max` (3) on the field. The spawn pick falls back to
  a car beyond that.

## Round 7: upgrade draft, run summary, cache-busting

This prototypes the "choices" half of the skill tree idea before building any
persistence.

- **Upgrade draft** (`js/upgrades.js`, `features.upgrades`,
  `config.upgrades`):
  - A run starts with `startAbilities` (Chameleon). Clearing a level offers 3
    distinct cards on the results screen; click one, or press 1 / 2 / 3.
  - Ability cards appear only while that ability is locked. Rule cards appear
    once per run. Cards with `needs` (Long rope needs Tow, Ghost slick needs
    Phase) appear only once that ability is unlocked.
  - Picks become `game.mods`, which the systems read:
    - Player: boost recharge.
    - Blasts: radius.
    - Damage: repair window length, cop ram damage, max health.
    - Abilities: chameleon duration, tow range and rope length, phase slick.
    - Pile-ups: junk clear radius.
    - Matching: Heavy fare weights.
    - Explosions: Feeding frenzy heal.
  - Ghost slick drops short-lived ice circles (`terrain.slicks`), which
    `surfaceAt` checks before the static zones.
  - A newly unlocked ability is equipped automatically. Retry keeps the run;
    "Level 1" resets it. Number keys and swapping only reach unlocked
    abilities, and the swap button hides while only one is unlocked.
- **Run summary:** per-level stats (`game.stats`) are shown on both the results
  and game-over screens:
  - matches, cars cleared and biggest match
  - convoys and junk cleared
  - ability uses
  - total damage, with the top 3 sources by share
- **Cache-busting:** `tools/stamp.mjs` writes an import map into `index.html`
  that points every module at `file.js?v=<content hash>`, and stamps
  `style.css` and `planck.min.js` the same way. Only changed files get new
  URLs, so a normal refresh picks up a deploy. **Run `node tools/stamp.mjs`
  before every commit.** Browsers without import maps (iOS before 16.4) still
  work, they just don't get the cache-busting.
- **Verification:** 24 new checks:
  - every request is stamped, and the stamps match file contents
  - run start state, and locked abilities can't be equipped
  - the draft offers 3 distinct, valid cards, and the summary is shown
  - ability cards unlock and equip; key picks work
  - each card's effect
  - retry and fresh-run behavior
  - the game-over summary
  - `features.upgrades` off

  The older suites (47 + 27, plus 5 cop checks) were adjusted for the draft
  and still pass.

**Follow-up:** cops were too frequent on their first level. Levels now take
an optional `caps` (per-type limits that override `vehicles.<type>.max`):

| Level | Police spawn weight | Max police at once |
| --- | --- | --- |
| 3 | 4 | 1 |
| 4 | 7 | 2 |
| 5 and later | default | 3 |

In a 2-minute run of each level, the highest count seen was 1, 2 and 3
respectively.

## Round 8: sound and feel

- **`js/audio.js`:** Web Audio synthesis, so there are no asset files.
  - **Startup:** the context starts on the first pointer or key event, which
    browsers require. Master gain feeds a compressor/limiter so stacked
    sounds don't clip.
  - **One-shots:** throttled per sound so a pile-up doesn't machine-gun.
    - `impact(strength)`: filtered noise plus a low thump, scaled by impulse.
    - `arm()`: rising tone over `match.delay`.
    - `explode(weight, combo, convoy)`: a boom plus a chime arpeggio
      transposed up by the combo, with a longer arpeggio for convoys.
    - `boost`, `ability(name)`, `drop`, `ram`, `rust`, `heal`, `heartbeat`,
      `warn`, `ding`, `click`, `win(stars)`, `lose`.
  - **Loops:** an engine hum (sawtooth through a lowpass, pitch from speed)
    and a siren (square wave with a square LFO) whose level is
    `(1 − distance / chaseRange)²` for the nearest cop. Both are silent while
    paused or on a results screen.
  - **Hooks:** `main.js` calls these from the existing events. Pile-ups
    (`onJunk`) and healing (`onHeal`) got small callbacks for this.
- **Feel** (`config.feel`):
  - `hitstop`: 0.09 s with the simulation frozen (still rendering) after a
    match of 4+, a convoy, or a combo.
  - `skidMarks`: rear-wheel segments while sideways slip exceeds `skidSlip`
    or during a ram skid, fading over `skidLife`, with at most 600 segments.
  - `haptics`: `navigator.vibrate` on impacts over 12 N·s, explosions, cop
    rams and game over. Android only; iOS Safari has no vibration API.
- **Mute:** a HUD button and the M key, stored in `localStorage`. It also
  stops vibration.
- **Verification:** 16 new checks:
  - audio starts on a gesture
  - each event's sound plays
  - the freeze-frame triggers and actually pauses the simulation
  - vibration fires, and stops when muted
  - skid marks appear and fade
  - mute persists across a reload
  - 60 fps with sound running

  The older suites still pass (47 + 27 + 24 + 5). Actual sound quality can't
  be judged headless; it needs your ears.

## Wrap-up: prototype complete

- **`docs/unity-handoff.md`** passes on what was learned without locking the
  Unity build into this implementation. Every system is split into four
  parts:
  - **Intent:** validated in playtests.
  - **How the prototype did it:** reference only.
  - **Starting numbers:** a baseline to retune.
  - **Room to change.**

  It also covers what the prototype proved, a lessons-learned table
  (symptom → cause → fix), alternatives we tried, open questions, and
  possible Unity equivalents.
- **`tests/`:** the 120 browser behavior checks written during development,
  made portable (`BB_URL`, the standard `playwright` import, a non-zero exit
  on failure) with a `run-all` script and a README.
- **Tag `prototype-v1`:** suggested, to mark the final prototype. It wasn't
  pushed, because this environment can't push tags. If you create it, put it
  on the latest commit on `main`, which includes weather (below). The Pages
  build stays live as the reference.

## Round 9: weather and atmosphere

- **`js/weather.js`:** presets in `CONFIG.weather.presets`, combinable with
  `+`.
  - Each level has its own: sun, rain, wind, night, snow. Later levels cycle
    through storm, fog, night+rain, snow+wind, sun, and storm+night.
  - `?weather=<name>` forces one; `?weather=clear` turns it off.
  - `features.weather` turns the whole system off.
- **Gameplay hooks:** these are the only ways weather touches the rules.
  - `terrain.setGround()`: ground multipliers, plus puddle and drift
    patches, checked before the terrain zones.
  - `physics.wind`: `applyGrip(body, grip, drift)` holds lateral velocity to
    the wind's drift instead of to zero, and `updateWind` adds
    mass × damping × drift as a force. A free-rolling car therefore settles
    at exactly the drift speed, scaled by 1 / density.
  - Lightning `strike()`: shoves and stuns cars, damages the player within
    `hitRadius`, and destroys junk for points.
- **Tuning found along the way:** the first pass of grip numbers (rain ×0.5,
  snow ×0.35) didn't change the player's handling at all. The player's
  grip cap of 1.0 only gives way below about ×0.42 at full speed and full
  lock. Measured peak sideways slip on a full-lock turn:

  | Ground grip | Peak slip |
  | --- | --- |
  | ×1 | 0.4 m/s |
  | ×0.35 | 1.5 m/s |
  | ×0.3 | 2.8 m/s |
  | ×0.2 | 5.7 m/s |
  | ×0.08 | 9.4 m/s |

  Rain, storm and snow now use ×0.35, ×0.3 and ×0.2.
- **Rendering:**
  - Rain, snow and wind particles live in a 48 × 30 m tile wrapped around
    the camera, so there's no spawning.
  - Night and fog use a half-resolution canvas filled with darkness or fog,
    with soft holes cut out using `destination-out`. Cop light bars and
    explosions are then added with `lighter`.
  - The lightning flash goes under the bolt so the bolt stays visible.
- **HUD:** a weather chip (icon, plus a wind arrow that turns and grows with
  gusts). The level banner is followed by a one-line toast saying what the
  weather does.
- **Sound:** looping rain hiss and wind noise (pitch follows the gusts),
  thunder (a close crack or a distant rumble), a crackle before strikes, and
  a clunk when a floodlight cuts out.
- **Verification:** `tests/weather.test.mjs`, 36 checks:
  - the level schedule, presets combining, and the feature toggle
  - the HUD chip and toast
  - grip per preset, and patches avoiding terrain
  - shoved cars sliding further in rain
  - the player sliding in snow
  - drifts slowing you, and tracks in snow
  - wind pushing light vehicles further than heavy ones, gusts, and no wind
    elsewhere
  - lightning's warning time, shove, junk clearing, player damage and
    targeting
  - night and fog luminance, and floodlight outages
  - thunder and crackle sounds
  - screenshots of every preset
  - 59–60 fps in a night storm with 60 cars

  The older suites now load with `?weather=clear` so their physics checks
  stay deterministic. All 156 checks pass.
