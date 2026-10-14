# Bumper Block

Prototype mobile game: a match-and-explode puzzle crossed with a demolition derby.
Bump same-colored cars together; groups of 3+ explode. Get boxed in and it's over.

**Play:** https://ventiduke.github.io/bumperblock/ (debug overlay: add `?debug=1`)

## Controls

Play in landscape.

- **Phone:** hold the left or right half of the screen to steer, hold both halves to brake and then reverse. Boost with the **BOOST** button (right edge, mid-height) or a quick upward swipe. Use your **ability** with the left-edge button; the small ⇄ button swaps between Chameleon, Phase and Tow.
- **Desktop:** A/D or arrow keys to steer, S or Down to brake and reverse, Space to boost, F to use your ability, 1 / 2 / 3 to pick Chameleon / Phase / Tow (or Q to cycle), R to restart.

A same-color group of 3+ cars explodes only while your car is part of the chain: touching it, or wedged between same-color cars (you're a wildcard link, but don't count toward the 3). Hold contact for a moment; pull away and it cancels. Each level has an order to fill (top center): fill it to win the level. Your car takes damage when squeezed, slammed or boost-ramming, and wears down over time; explode the **repair color** (cars with a white cross, swatch next to the health bar) to heal — but repair windows come and go. Zero health = wrecked. Big clumps of 7+ touching cars rust into grey junk you can't match; explosions clear junk next to them. The minimap (top left) shows the whole arena.

## Development

No build step. Serve the repo root with any static server, e.g. `npx http-server .`,
and open it in a browser. All tuning values live in `config.js`.

- `docs/design.md` — full game vision
- `docs/phase1-plan.md` — Phase 1 architecture, assumptions, and findings
