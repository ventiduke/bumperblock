# Behavior tests

Browser tests that drive the prototype through Playwright and check that the
game does what the design intends. They're written as a readable checklist,
one line per behavior. For example:

- "chain: pair + player does not explode"
- "cops: at most 1 at a time on level 3"
- "sandwiched between wall and car: squeeze drains ~6 HP/s"

**For the Unity build:** use them as acceptance criteria to adapt, not code to
port. The numbers in them are the prototype's tuning, so check the behavior,
and expect the exact values to change.

| File | Covers |
| --- | --- |
| `core.test.mjs` | Layout and camera, brake and reverse, chain matching, colors, terrain, game over, levels and goals, damage and repair, pile-ups, boost placement and swipe, feature toggles, performance |
| `abilities-vehicles.test.mjs` | Ability keys and swapping, chameleon, phase, tow; vehicle mix, bus and semi weights, the semi hinge, per-type speeds, police chase, convoy |
| `police.test.mjs` | Police catching up, the ram shove and its damage, fast stun recovery, the per-level cap |
| `upgrades.test.mjs` | Version stamping, the upgrade draft, each card's effect, retry vs. fresh run, the run summary |
| `sound-feel.test.mjs` | Every sound event fires, freeze-frame, skid marks, haptics, mute persistence, 60 fps with sound |
| `weather.test.mjs` | Weather per level, grip, puddles and drifts, wind drift by vehicle weight, lightning, night and fog visibility, 60 fps in a night storm |

## Running

```sh
npm i -D playwright && npx playwright install chromium   # once
npx http-server . -p 8080 -c-1                            # serve the repo root
node tests/run-all.mjs                                    # all suites, with a summary
node tests/core.test.mjs                                  # or a single suite
```

- `BB_URL` points the tests at another address. The default is
  `http://localhost:8080/`.
- `PLAYWRIGHT_MODULE` points them at an existing Playwright install.
- Screenshots go to `tests/out/`, which isn't committed.
- The suites other than `weather.test.mjs` load the game with `?weather=clear`,
  so weather doesn't change their physics.

The tests use the page's debug hook (`window.bumper`) to set up scenarios
directly, e.g. placing three red cars and parking the player against them,
then step the physics. A few checks depend on randomness, such as which cards
get drawn, and are written to hold for any draw.
