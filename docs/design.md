# Bumper Block — Game Design

## Pitch

A match-and-explode puzzle game crossed with a demolition derby, viewed
top-down in 2D. You drive a small car around an arena that keeps filling with
AI cars. Shove same-colored cars together; when enough of them touch, they
explode. Get boxed in and it's over.

## Core loop

1. Cars wander into the arena from its edges, faster and faster.
2. You ram and nudge them into clusters.
3. A connected cluster of 3+ same-colored cars explodes, scoring points and
   clearing space. The blast shoves nearby cars, sometimes setting up the
   next match.
4. If you can't clear space fast enough, the arena fills, and once you can't
   move you lose.

The tension is between space (the arena fills up) and setup (you need cars
packed together to make matches).

## Player car

- Always accelerates toward top speed. The player only steers.
- Should feel easy and fun to drive: responsive turning, tight grip, and it
  should never feel like you're fighting the controls.
- Heavier than the AI cars, so ramming moves them in a satisfying,
  predictable way.

## Controls

Minimal by design:

- **Steer left / steer right.** On mobile, hold the left or right half of the
  screen. On desktop, A/D or the arrow keys.
- **Brake / reverse.** Hold both sides at once (or S / Down on desktop): the
  car brakes hard, then slowly reverses. This is for lining up shots.
- **Boost** (right edge, or a quick upward swipe): a short speed burst on a
  recharging meter.
- **Ability slot** (left edge): one equipped ability with its own recharge.
  The small swap button cycles between them. These are prototype candidates
  for future unlocks:
  - **Chameleon:** for a few seconds your car counts as one car toward the 3,
    so a pair plus you explodes.
  - **Phase:** briefly pass through cars and blocks (not the arena walls).
    It's an escape from being boxed in.
  - **Tow:** rope the nearest car and drag it around. The towed car counts as
    part of your chain, so you can deliver it into a group.

## AI cars

- Each vehicle has a **color** and a **type**. Types play differently:
  - **Car:** the baseline.
  - **Motorcycle:** small, light and fast; it slips through gaps.
  - **Bus:** long, heavy and slow, and counts as 2. It makes a great bridge.
  - **Semi:** a cab plus a trailer on a hinge that jackknifes, counting 2.
  - **Police:** runs you down when you're nearby. It's fast, heavy and hard
    to stun, and it rams you while in contact: a hard shove that breaks your
    traction and costs health. At most a few at a time.
- A match containing three different types is a **convoy**, worth ×1.5
  points.
- Later levels mix in the bigger and more dangerous types.
- Most cars wander aimlessly at modest speed. As the level goes on, the crowd
  drifts increasingly toward the player. That makes being boxed in a real
  threat, and aggressive play riskier.
- Later types may behave differently, e.g. **chasers** that target the
  player, **heavies** that are hard to push, or **wildcards** that match any
  color.
- More cars enter as a level goes on.

## Matching

- Cars of the same color that are touching form a group (a connected chain of
  contacts, not just pairs).
- A group of 3 or more explodes after a short delay (~0.3 s) so the player
  can see the match form.
- **The player is part of the chain.** A group explodes only while the
  player's car is touching it. The player also works as a wildcard link:
  red–player–red–red counts as a chain of three reds. The player doesn't count
  toward the three. Pull away before the short delay ends and the match
  cancels, so matches are a deliberate shove-and-hold. Groups the AI forms on
  its own sit *primed* (dashed links, slow glow) until the player joins them.
  Explosions should always feel like something you did.
- **More colors over time.** A level starts with three colors and adds more
  as it goes on (up to six). More colors means fewer same-color neighbors, so
  matches get harder while the arena fills up.
- Bigger groups and quick chains of explosions are worth more.

## Levels: winning

- Each level gives an order to fill, either "Clear 15 cars" or "Clear 6 of
  each color", with progress shown in the HUD.
- Filling the order completes the level. A results screen shows time, health
  left, a bonus, and 1–3 stars against a par time.
- Later levels add colors, start with more cars, and spawn faster. Past the
  scripted levels, orders and pace keep scaling.

## Damage and repair: urgency

- Your car has health. It wears down slowly over time.
- **Damage comes from pressure, not from your own rams:**
  - Being squeezed (slow, pressed against two or more things) hurts steadily.
  - Getting slammed by another car hurts, in proportion to how much of the
    collision was its fault.
  - Boost-rams and fast wall hits cost a little, so boost is a risk/reward
    choice.
  - Normal rams are free, because bumping is the fun part.
- **Repair:** sometimes one color is the repair color, marked by a white
  cross on its cars and a swatch next to the health bar. Exploding it heals
  you. Repair windows come and go: ~18 s with a repair color, then ~12 s with
  none. Each new window picks a different color, so you can't count on a heal
  whenever you want one.
- At zero health you're **wrecked**. Being boxed in still ends the run too.
- The core tension: the order needs blues, the repair color is red, and both
  are in the crowd.

## Pile-ups

- A big clump of touching cars (7 or more, any colors) that holds together
  starts to **rust**. Its cars brown over, blink, and then turn into grey
  **junk**: heavy wreckage that can't be matched, doesn't drive, and still
  boxes you in. Cars that bump into junk get caught in the pile-up too.
- Explosions destroy junk right next to the exploding cars, for bonus points.
  Popping a match inside a blob is the "clean-up save", but only if you get
  there in time.
- This makes "wait for a giant blob, then plow through it" a losing strategy.

## Losing

- **Boxed in:** unable to move for a sustained moment while pressed against
  other cars.
- **Wrecked:** health reaches zero.

## Feel goals

- **Weighty bumps.** Collisions have heft: cars don't glide forever or bounce
  like balloons. A hit moves a car a satisfying distance, and it stops.
- **Readable.** You can always tell which cars are about to match. The arena
  is somewhat larger than the screen; the camera follows the player, and a
  minimap shows the whole arena.
- **Juicy.** Explosions, particles, small screen shake on hard hits.

## Terrain

Arenas have features that change how you drive and where cars pile up:

- **Blocks**: solid walls inside the arena that create chokepoints and corners
  to get trapped in (or to trap cars against).
- **Ice**: almost no grip. Cars keep sliding sideways and coast further.
- **Mud**: heavy drag. Top speed drops to under half.
- Later: ramps, bumpers, conveyor strips, moving walls.

## Presentation

- Landscape phone, full screen, two-thumb play. Holding the phone upright
  shows a "rotate your phone" prompt and pauses.
- Simple shapes and flat colors for now. Art, sound, and music come later.

## Future ideas (not in Phase 1)

- Wildcard cars.
- Run upgrades: pick 1 of 3 after each level. Later this becomes a skill tree
  with exclusive branches, then prestige.
- More abilities: magnet, horn or shockwave, paint bomb, oil slick, junk
  shredder.
- Heavy cars that need a bigger group (e.g. 4+) or two hits to tag.
- Additional abilities (shockwave, brake-spin), power-ups dropped by
  explosions.
- Levels with goals (clear N reds, survive T seconds), progression, menus.
- Sound effects, music, art assets, haptics.
- Accounts, leaderboards.
