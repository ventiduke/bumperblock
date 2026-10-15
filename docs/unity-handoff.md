# Bumper Block: Prototype → Unity Handoff

The web prototype (tagged `prototype-v1`, playable at
https://ventiduke.github.io/bumperblock/) was a tool for finding the fun. This
document passes on what we learned. **It is a starting point, not a spec.**

## How to read this

Each system below is split into four parts, with different levels of
confidence.

| Part | What it means | How firmly to hold it |
| --- | --- | --- |
| **Intent** | The experience the system creates, confirmed in phone playtests. | Keep the *feeling*. Change the mechanism if Unity offers a better one. |
| **How the prototype did it** | One approach that worked in a 2D JavaScript / Box2D (Planck.js) build. | Reference only. Replace freely. |
| **Starting numbers** | The values in `config.js` when we stopped. | A baseline to compare against. Expect to retune everything: Unity's solver, mass scale, frame timing and art scale differ. |
| **Room to change** | Things we explicitly didn't settle, or settled only because we had to pick something. | Open. |

A few broader cautions:

- **The physics "works" here; it isn't the physics.** The handling recipe
  below produced the feel we wanted in *this* engine. Unity's Rigidbody2D
  (also Box2D-based) will be close. A 3D or custom vehicle model could reach
  the same feel a different way, and that's fine.
- **Playtests were a single tester on a phone,** over 8 rounds. That's strong
  evidence about direction, but weak evidence about exact difficulty. Treat
  balance numbers as "felt about right to one person".
- **Bots were used to sanity-check pressure, not to tune.** The automated bots
  were bad at the game (see Open questions), so their survival times only
  show relative trends.

Units throughout: meters, seconds, kg (relative mass). The car is 1.8 × 1.0 m,
and the arena is 40 × 24 m.

---

## 1. What the prototype proved

These are the strongest findings. The playtests either confirmed them directly
or arrived at them after a failed alternative.

1. **Bumping cars around is fun on its own.** "Felt fun instantly" came from
   the very first build: an auto-accelerating car, steering only, and weighty
   collisions.
2. **The player must cause every match.** When groups exploded on their own,
   matches felt random and the player's role was unclear. Requiring the
   player's car to be *part of the chain* fixed that.
3. **There has to be a way to lose and a way to win.** Urgency came from
   health that drains plus repairs that come and go. A sense of winning came
   from level goals with a results screen.
4. **Waiting must not be the best strategy.** Letting a giant blob form, then
   plowing through it, was dominant until big clumps started rusting into
   junk.
5. **Enemies need to actively threaten you.** Wandering traffic alone never
   felt dangerous. The crowd drifting toward you, plus police that ram, did.
6. **Variety within a color works.** Vehicle types with different physics
   (motorcycle, bus, semi, police) add decisions without adding rules to
   learn.
7. **Draft choices between levels feel good.** Pick-1-of-3 upgrades landed
   well as the first step toward the planned skill tree.

---

## 2. Core loop

You drive a car around an arena that keeps filling with traffic. You shove
same-colored vehicles together, and your car must be touching the group for it
to explode. Each level gives you an order to fill (e.g. "clear 15 cars" or "6
of each color"). Meanwhile:

- Your health wears down, and you repair it by exploding whichever color is
  the current repair color.
- Clumps of cars rust into junk.
- Police hunt you.
- You lose if you're wrecked (zero health) or boxed in (can't move).
- After each level you pick an upgrade card.

---

## 3. Systems

### 3.1 Driving and handling

**Intent:**
- Easy and fun to drive, with minimal controls: steer left, steer right,
  boost, one ability, and brake/reverse.
- The car always drives forward, so the player only steers.
- Turning feels crisp, and you can always pivot your way out of a pin.
- Brake and reverse exist for lining up shots, not for normal driving.

**How the prototype did it:**
- A dynamic box body. Each physics step:
  1. **Grip:** cancel sideways velocity with an impulse, capped per step
     (`lateralGrip × mass`). The cap is what lets hard hits still slide you.
  2. **Drive:** apply a forward force until reaching top speed.
  3. **Steering:** set the angular velocity directly, lerped toward the target
     very fast (`steerResponse` 45). An early, softer lerp (14) let contact
     friction cancel the steering when you were nosed into a car, and you'd
     freeze. Some turning is also kept at zero speed (`minTurnFactor`).
  4. **Damping:** plain linear and angular damping.
- **Brake:** hold both screen halves (or S/↓) to brake hard, then reverse
  slowly.
- **Touch layout:** steering is the left and right halves of the screen. Boost
  and the ability sit at mid-height on the right and left edges, because the
  bottom corners collided with the steering thumbs. A quick upward swipe also
  boosts.

**Starting numbers:**
- Top speed 7 m/s, accel 22 m/s².
- Turn rate 3.6 rad/s.
- Player density 3× the AI's.
- Brake 28 m/s², reverse up to 3.5 m/s.
- Boost: ×1.8 speed for 0.45 s plus a 6 m/s kick, costs half the meter, 3 s
  to refill.

**Room to change:**
- Top speed was lowered once (8.5 → 7) because positioning was hard. Faster
  could work with a different camera.
- The controls themselves are open: tilt, a virtual stick, or other button
  placements are all fair to explore. What was confirmed is "few inputs", not
  this exact layout.

### 3.2 Collisions and the "weighty" feel

**Intent:** bumps have heft. A shoved car moves a satisfying distance, then
*stops*. Nothing feels floaty or bouncy.

**How the prototype did it:**
- Low restitution (0.12) and low car-to-car friction (0.15), so cars glance
  off each other instead of locking together.
- AI cars have high linear damping and weak sideways grip, so they slide when
  shoved and then settle.
- **Stun:** a hard hit stops an AI car from driving for 1.6 s. This is what
  lets you actually *place* cars. Without it, they drive away before you can
  build a group.
- **Feedback:** sparks, screen shake scaled by impulse, a short freeze-frame
  on big matches, skid marks, and haptics.

**Starting numbers:**
- AI linear damping 1.6 (3.5 while stunned).
- Stun threshold 1.2 N·s.

**Room to change:** the stun mechanic matters more than its numbers. Any
approach where shoved cars stay where you put them should work.

### 3.3 Matching: "you're part of the chain"

**Intent:**
- Three or more touching same-colored cars explode, but **only while your
  car is touching the group**.
- You also act as a wildcard link: red–you–red–red counts as a chain of
  three.
- Your car doesn't count toward the three. (That's what the Chameleon ability
  changes.)
- There's a short countdown (~0.3 s) that cancels if you pull away, so a match
  is a deliberate shove-and-hold.
- Groups that form without you sit visibly "primed", waiting for you.

**How the prototype did it:**
- Each car has a slightly larger trigger fixture (+0.14 m) for "touching".
  Raw physics contacts flicker as bodies separate by tiny amounts, and the
  margin keeps groups stable.
- Every step: union-find over same-color trigger contacts, plus the player
  joining every same-color car it touches. A group arms only while the player
  is in it.
- A 4+ match, a convoy, or a combo triggers the freeze-frame.

**Starting numbers:**
- Min group 3, delay 0.3 s.
- 10 points per car, scaled up for bigger groups and combos (1.5 s window).
- Blast radius 4 m.

**Room to change:**
- The *rule* ("the player must be involved") is the validated part. Two
  earlier versions were rejected:
  - **Tagging** (cars you hit stay "tagged" for a few seconds) was too easy.
  - **Explode on their own** made the player's role feel random.
- The exact chain logic, delay, and trigger margin are all tunable.

### 3.4 Levels and goals

**Intent:**
- Each level has a clear order to fill and a satisfying finish: a results
  screen with stars and a bonus.
- Difficulty grows across levels: more colors, faster spawns, bigger and
  more dangerous vehicle types, more cops.

**How the prototype did it:**
- Five scripted levels, then automatic scaling (bigger goals, faster spawns).
- Goals are either `{total}` or `{each}`.
- Stars come from a par time. The bonus is based on health left and time
  under par.

**Starting numbers:** see `levels` in `config.js`. Level 1 is 3 colors, clear
15, with cars, motorcycles and buses only. Level 5 is 6 colors, 6 of each,
with the full vehicle mix.

**Room to change:**
- The level count, goals, and par times are placeholders.
- Hand-designed arenas per level weren't built (see Open questions).

### 3.5 Damage and repair

**Intent:**
- Health creates urgency. It wears down over time, and you get hurt by
  pressure (being squeezed, slammed, or rammed by cops), **not by your own
  rams**, because bumping is the fun part.
- You repair by exploding the current repair color, but repairs **aren't
  always available**, which adds tension.

**How the prototype did it:**
- **Fault-based impact damage:** just before the physics solve, record how
  fast each side was closing. You take only the other car's share. Flat
  impact damage made ramming into packed groups (the core move) cost about
  17 HP per hit, so it had to go.
- **Wear:** a constant 0.7 HP/s.
- **Squeeze:** 6 HP/s while slow and touching two or more things, at least one
  of them a car.
- **Boost and walls:** boost-rams and fast wall hits cost a quarter-strength
  amount.
- **Repair windows:** a repair color for 18 s, then none for 12 s, and each
  new window picks a different color. Repair-color cars show a white cross,
  and healing is 8 HP per car.
- Health reaching zero means you're "Wrecked".

**Starting numbers:** see the `damage` section of `config.js`.

**Room to change:** every rate, plus whether wear exists at all.

### 3.6 Pile-ups and junk

**Intent:**
- Discourage the "wait for a giant blob, then clean up" strategy, while
  keeping a last-second save possible.
- Waiting should visibly cost you space.

**How the prototype did it:**
- A clump of 7 or more touching AI cars, any colors, rusts.
- After about 6 s each car becomes junk: grey, heavier, it doesn't drive, and
  it never matches.
- Junk counts toward pile size, so it spreads.
- An explosion destroys junk within 2.6 m of the exploding cars.
- If you idle, most of the arena is junk within about 2 minutes.

**Room to change:**
- Thresholds and timing are open.
- The junk could become something else entirely, like a hazard, a resource,
  or a currency, as long as blob-waiting stays costly.

### 3.7 AI traffic

**Intent:**
- Most traffic wanders, but the crowd **drifts toward the player** as a level
  goes on, so boxing-in is a real threat.
- AI shouldn't jam itself into corners or scrape along obstacles.

**How the prototype did it:**
- **Wander:** pick a new heading every 1.5–4 s, steering toward the arena
  center when near a wall.
- **Seek:** a chance, ramping from 0 to 35% over the level, that a new
  heading points at the player.
- **Obstacles:** a short ray ahead; on a hit, mirror the heading off the
  surface and hold it for 0.8 s.
- **Spawning:** from the edges at an increasing rate, keeping clear of the
  player, up to 80 cars.

**Room to change:** this is all simple placeholder AI. Better pathing,
flocking or lanes would all be fine.

### 3.8 Vehicle types

**Intent:** variety within a color, where each type *plays* differently.

| Type | Role | Prototype specifics |
| --- | --- | --- |
| Car | Baseline | Counts 1 |
| Motorcycle | Small, light, fast; slips through gaps | 1.25 × 0.55 m, 3.4 m/s |
| Bus | Long, heavy, slow; a great bridge | 3.6 m, **counts 2** |
| Semi | Cab plus trailer on a hinge (jackknifes) | Matches as one unit, counts 2 |
| Police | Hunts you (see 3.9) | Chases within 16 m |

**Convoy:** a match containing three distinct types scores ×1.5.

**Room to change:** add, remove, or re-role types freely. The convoy bonus was
a light first pass.

### 3.9 Police

**Intent:**
- A real threat that chases you down and *shoves you around*, without being
  unfair.
- Introduce them gradually.

**How the prototype did it:**
- **Chase:** fast (5.5 m/s vs. your 7), aiming 0.4 s ahead of you, heavy, with
  strong grip.
- **Ram:** while touching you, a cop slams you every 0.8 s with a 3.5 m/s
  kick and 3 HP of damage. It also **breaks your traction** for 0.4 s, which
  is what lets the shove actually move you.
- **Stun:** police use their own, much higher stun threshold.
- **Pacing:** none on levels 1–2, then at most 1 cop on level 3 (rarer), 2 on
  level 4, and 3 from level 5 on.

**Room to change:** all numbers, plus things we didn't try: sirens that call
backup, roadblocks, or cops you can match.

### 3.10 Abilities

**Intent:**
- One ability slot next to boost, each ability opening a different play
  style.
- The validated ideas are a *chameleon*, a *phase/escape*, and a
  *deliver-a-car* tool.

| Ability | What it does | Prototype numbers |
| --- | --- | --- |
| Chameleon | Your car counts as one toward the 3, so a pair plus you explodes | 5 s, 14 s recharge |
| Phase | Pass through cars and blocks (not the arena walls). Can't trigger matches while phased. Stays on until you're clear | 1.5 s, 12 s recharge |
| Tow | Rope the nearest car (within 3.5 m). It counts as part of your chain, so you can deliver it into a group | Rope 2.2 m, 6 s recharge |

**How the prototype did it:**
- **Phase:** changes the player's collision layers. Terrain blocks got their
  own collision category so phase passes through them but not the arena walls.
- **Tow:** a rope (max-distance) joint.

**Room to change:** this list was a first slate. Other candidates we
discussed but didn't build:
- magnet
- horn/shockwave
- paint bomb
- oil slick
- junk shredder (a "minigun" variant that doesn't bypass matching)

### 3.11 Run upgrades (the start of the skill tree)

**Intent:**
- Meaningful choices between levels.
- These are the prototype of the planned skill tree, where you can't take
  everything and later prestige.

**How the prototype did it:**
- A run starts with Chameleon only. After each level you pick 1 of 3 cards:
  - **Ability unlocks** (Phase, Tow).
  - **Stackable stat upgrades:**
    - Turbo: boost recharge.
    - Big bang: blast radius.
    - Mechanic: repair windows.
    - Long shimmer: chameleon duration.
    - Long rope: tow.
    - Scrapper: junk clearing.
    - Bull bars: cop rams.
    - Plating: max health.
  - **One-off rules:**
    - Feeding frenzy: matches of 4+ heal.
    - Heavy fare: buses and semis count triple.
    - Ghost slick: phase leaves ice.
- Retrying a level keeps the picks. Level 1 resets the run.

**Room to change:**
- Everything about the card list.
- The persistent tree, its currency, and prestige weren't built. Which cards
  players keep picking is the input for designing them.

### 3.12 Terrain

**Intent:** terrain changes how you drive and where cars pile up.

**How the prototype did it:**
- **Solid blocks:** stubs off the walls, a central island, pillars.
- **Ice:** grip ×0.08, so you keep sliding.
- **Mud:** top speed ×0.45, heavy drag.
- Zones are axis-aligned rectangles checked at each car's center.

**Room to change:** layouts, shapes, and new surfaces are all open.

### 3.13 Camera, presentation, HUD

**Intent:**
- Landscape, full screen.
- An arena somewhat bigger than the screen, so terrain has room, without
  getting huge.
- You can always find the action, and you can tell what's about to match.

**How the prototype did it:**
- **Camera:** follows the player with a 0.35 s velocity lead, showing about
  14 m of height, clamped to the arena.
- **Minimap:** shows every car.
- **HUD:** level order, health and repair swatch, a boost ring, an ability
  ring, and mute.
- **Visual cues:**
  - Primed groups: dashed links and a slow glow.
  - Armed groups: white links and pulsing.
  - Rusting cars: brown, then blinking.
- **Portrait phones:** a "rotate your phone" prompt that pauses the game.

**Room to change:** everything visual. The prototype is flat shapes on
purpose.

### 3.14 Sound and feel

**Intent:** every action has audible and tactile feedback, and pressure can be
*heard* (the siren, the low-health heartbeat).

**How the prototype did it:**
- Synthesized Web Audio placeholders.
- Hitstop of 0.09 s, skid marks, and haptics on Android.

**Room to change:** all of it. Sound quality is explicitly deferred to the
Unity build.

---

## 4. Lessons learned

Some of these are specific to Box2D/Planck and may not happen in Unity. The
*symptom* is the useful part: if you see it, this is a likely cause.

| Symptom | Cause we found | What fixed it |
| --- | --- | --- |
| Player freezes when nosed into a car, even while steering | Drive force becomes contact friction, which cancels a soft steering lerp | Near-direct angular velocity (`steerResponse` 45), plus lower car friction |
| Police stop pushing the moment they touch you | Steady pushing produced contact impulses above the stun threshold every frame, so they stunned *themselves* | Per-type stun thresholds; police only stop for genuinely hard hits |
| Shoves barely move the player sideways | Player tire grip is about 3× any car's drive force | A traction-breaking skid on cop rams (grip ×0.1 for 0.4 s) |
| Ramming into groups (the core move) wrecked the player | Flat impact damage treated your own rams as hits | Fault-based damage: only the other car's share of the closing speed counts |
| AI cars jam and scrape beside obstacles | 1.5 m gaps between blocks and walls; wall-avoid steering pointed back through blocks | Blocks touch walls or leave ≥ 3 m gaps; a bounce heading that holds for 0.8 s |
| Matching groups flicker or don't register | Raw contacts toggle at tiny separations; first attempt also had a collision filter blocking triggers | A slightly larger trigger per car, and making sure trigger-vs-body pairs aren't filtered out |
| Spawning silently never happens | The broadphase "fat" bounding boxes made every edge spot look blocked by the wall | Re-check exact bounds before rejecting a spawn |
| Blob-waiting dominates | No cost to letting clumps grow | Pile-ups rust into junk |
| The game felt solved (too easy) | Matches happened without the player | The player must be part of the chain |
| Deploys didn't show up (web only) | Browser caching of scripts | Content-hash stamping (`tools/stamp.mjs`). Not relevant to Unity |

---

## 5. Decisions and alternatives we tried

These were reasonable calls for the prototype. **Revisit any of them** if
Unity or new playtests point elsewhere.

- **Matching rule:** tried "any group explodes", then "tagged by the player",
  then "player must be in the chain" (kept). Config modes for all four still
  exist in the prototype, if you want to A/B test them.
- **Orientation:** started in portrait; the playtester asked for landscape.
- **Arena size:** it was 14 × 25 m with the whole arena on screen. It grew to
  40 × 24 m with a camera follow so terrain has room.
- **Colors:** first a time-based schedule (3 → 6 colors), then per level once
  levels existed.
- **Cops:** first wandering pushers (not threatening), then fast rammers
  paced by level.
- **Repair:** first an always-present rotating color, then windows that come
  and go (harder).
- **Progression:** chose an in-run draft before any persistent tree, to test
  whether the choices themselves are fun.

---

## 6. Open questions and untested areas

- **Difficulty with real players.** The bots were poor proxies: they drive
  straight into crowds and can't hold contact to match. One human tester is
  the only real signal.
- **Which upgrade cards get picked**, and which feel essential vs. ignorable.
  The run summary and card picks were built to collect this.
- **Onboarding:** there are many mechanics. First-time hints were planned
  but not built.
- **Arena variety per level:** planned (maze, open ice rink, mud-pit ring)
  but not built. All levels share one layout.
- **Persistent progression:** the skill tree with exclusive branches, a
  currency, and prestige.
- **Readability at scale:** six colors, five vehicle types, junk, slicks, and
  three cops on a phone screen at once. Accessibility for colorblind players
  (shapes or patterns per color) hasn't been addressed.
- **Performance target:** the prototype held 60 fps with 60–80 cars in a
  browser. Unity's budget and art will change this.

---

## 7. Possible Unity mapping (suggestions only)

| Prototype piece | A natural Unity equivalent |
| --- | --- |
| Planck body + damping | `Rigidbody2D` with `linearDamping` / `angularDamping` (`drag` / `angularDrag` before Unity 6) |
| Grip / drive / steer per step | `FixedUpdate` applying impulses and forces, and setting `angularVelocity` |
| Touch trigger fixture | A child `Collider2D` with `isTrigger`, slightly larger than the body |
| Pre-solve closing speeds | Read `relativeVelocity` and contact normals in `OnCollisionEnter2D` |
| Post-solve impulse | `ContactPoint2D.normalImpulse` |
| Collision categories (phase) | Physics2D layers and the collision matrix, or `Physics2D.IgnoreLayerCollision` while phasing |
| Semi hinge | `HingeJoint2D` with angle limits |
| Tow rope | `DistanceJoint2D` with `maxDistanceOnly`, or a `SpringJoint2D` |
| `config.js` | ScriptableObjects per system, so designers can keep tuning in the editor |
| Union-find matching | Same algorithm over trigger overlaps; it's engine-agnostic |

---

## 8. Reference

- **Playable build:** https://ventiduke.github.io/bumperblock/ (git tag
  `prototype-v1`). Add `?debug=1` for collision shapes, contact links, FPS and
  live stats.
- **All tuning values:** `config.js`, commented.
- **Behavior tests:** `tests/` (see its README). They read as a checklist of
  intended behavior, useful as acceptance criteria. Adapt them; don't port
  them literally.
- **History:**
  - `docs/phase1-plan.md` has every round's feedback and changes, with
    measurements.
  - `docs/design.md` has the game vision.
- **Code map:**

| File | What it covers |
| --- | --- |
| `js/physics.js` | Car bodies and the grip/drive model |
| `js/player.js` | Player driving, boost, brake, stuck detection |
| `js/ai.js` | Wander, seek, police, vehicle types |
| `js/match.js` | Chain matching |
| `js/damage.js` | Health, fault, repair |
| `js/pileup.js` | Rust and junk |
| `js/abilities.js` | Chameleon, phase, tow |
| `js/upgrades.js` | Upgrade cards |
| `js/levels.js` | Level definitions and scaling |
| `js/terrain.js` | Blocks and surface zones |
| `js/audio.js` | Synthesized sound |
| `js/main.js` | Game loop and the glue between systems |
