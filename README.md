# Bumper Block

Prototype mobile game: a match-and-explode puzzle crossed with a demolition derby.
Bump same-colored cars together; groups of 3+ explode. Get boxed in and it's over.

**Play:** https://ventiduke.github.io/bumperblock/ (debug overlay: add `?debug=1`)

## Controls

- **Phone:** hold the left or right half of the screen to steer; tap **BOOST** (bottom right).
- **Desktop:** A/D or arrow keys to steer, Space to boost, R to restart.

## Development

No build step. Serve the repo root with any static server, e.g. `npx http-server .`,
and open it in a browser. All tuning values live in `config.js`.

- `docs/design.md` — full game vision
- `docs/phase1-plan.md` — Phase 1 architecture, assumptions, and findings
