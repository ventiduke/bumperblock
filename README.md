# Bumper Block

Prototype mobile game: a match-and-explode puzzle crossed with a demolition derby.
Bump same-colored cars together; groups of 3+ explode. Get boxed in and it's over.

**Play:** https://ventiduke.github.io/bumperblock/ (debug overlay: add `?debug=1`)

## Controls

Play in landscape.

- **Phone:** hold the left or right half of the screen to steer, hold both halves to brake and then reverse. Boost with the **BOOST** button (right edge, mid-height) or a quick upward swipe. Use your **ability** with the left-edge button; once you've unlocked more than one, the small ⇄ button swaps between them.
- **Desktop:** A/D or arrow keys to steer, S or Down to brake and reverse, Space to boost, F to use your ability, 1 / 2 / 3 to pick Chameleon / Phase / Tow (or Q to cycle), R to restart, M to mute.

A same-color group of 3+ cars explodes only while your car is part of the chain: touching it, or wedged between same-color cars (you're a wildcard link, but don't count toward the 3). Hold contact for a moment; pull away and it cancels. Each level has an order to fill (top center): fill it to win the level, then pick 1 of 3 upgrade cards for the rest of the run (new abilities, stat upgrades, rule-benders). Your car takes damage when squeezed, slammed or boost-ramming, and wears down over time; explode the **repair color** (cars with a white cross, swatch next to the health bar) to heal — but repair windows come and go. Zero health = wrecked. Big clumps of 7+ touching cars rust into grey junk you can't match; explosions clear junk next to them. The minimap (top left) shows the whole arena.

## Development

No build step. Serve the repo root with any static server, e.g. `npx http-server .`,
and open it in a browser. All tuning values live in `config.js`.

Before committing, run `node tools/stamp.mjs`: it version-stamps every script and
stylesheet in `index.html` (by content hash) so a normal refresh picks up deploys.

- `docs/unity-handoff.md` — **start here for the Unity build**: what the prototype proved, each system's intent vs. how the prototype did it, lessons learned, open questions
- `docs/design.md` — full game vision
- `docs/phase1-plan.md` — Phase 1 architecture, assumptions, and findings
- `tests/` — browser behavior tests (`node tests/run-all.mjs`); a checklist of intended behavior to adapt as acceptance criteria
