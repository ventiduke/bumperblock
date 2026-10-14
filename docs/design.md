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
- **One or two ability buttons.** The first is **Boost**: a short speed burst
  on a recharging meter. Future abilities might include a brake/spin or a
  shockwave.

## AI cars

- Each car has properties. For now that's just **color** (3–4 colors).
- Most cars wander aimlessly at modest speed.
- Later types may behave differently, e.g. **chasers** that target the
  player, **heavies** that are hard to push, or **wildcards** that match any
  color.
- More cars enter as a level goes on.

## Matching

- Cars of the same color that are touching form a group (a connected chain of
  contacts, not just pairs).
- A group of 3 or more explodes after a short delay (~0.3 s) so the player
  can see the match form.
- Bigger groups and quick chains of explosions are worth more.

## Losing

- If you're boxed in, unable to move for a sustained moment while pressed
  against other cars, it's game over.

## Feel goals

- **Weighty bumps.** Collisions have heft: cars don't glide forever or bounce
  like balloons. A hit moves a car a satisfying distance, and it stops.
- **Readable.** You can always see the whole arena and tell which cars are
  about to match.
- **Juicy.** Explosions, particles, small screen shake on hard hits.

## Presentation

- Portrait phone, full screen, one-handed or two-thumb play.
- Simple shapes and flat colors for now. Art, sound, and music come later.

## Future ideas (not in Phase 1)

- Targeting / chaser AI, heavy cars, wildcard cars.
- Additional abilities (shockwave, brake-spin), power-ups dropped by
  explosions.
- Levels with goals (clear N reds, survive T seconds), progression, menus.
- Sound effects, music, art assets, haptics.
- Accounts, leaderboards.
