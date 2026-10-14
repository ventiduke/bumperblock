// All tuning values for Bumper Block. Units: meters, seconds, kg.
// Tweak here; nothing else needs to change.

export const CONFIG = {
  // Turn whole systems on/off to compare feel.
  features: {
    levels: true,           // level goals + results screen (off: endless, colorSchedule)
    damage: true,           // health, impact/squeeze damage, repair color
    pileups: true,          // big clumps of cars rust into junk
  },

  // Each level: colors in play, the goal, spawn pace, and a par time (s) for
  // stars. Goal is { total: N } (any colors) or { each: N } (N of every color).
  // Past the last level, it repeats with bigger goals and faster spawns.
  levels: [
    // `types` (optional) sets the vehicle mix; otherwise vehicleMix is used.
    { colors: 3, goal: { total: 15 }, par: 90, initialCars: 12, spawn: { startInterval: 1.8, minInterval: 0.8, rampTime: 90 },
      types: { car: 70, motorcycle: 18, bus: 12 } },
    { colors: 4, goal: { each: 6 }, par: 120, initialCars: 14, spawn: { startInterval: 1.5, minInterval: 0.6, rampTime: 100 },
      types: { car: 60, motorcycle: 16, bus: 12, semi: 12 } },
    { colors: 4, goal: { total: 35 }, par: 140, initialCars: 16, spawn: { startInterval: 1.3, minInterval: 0.5, rampTime: 100 } },
    { colors: 5, goal: { each: 6 }, par: 170, initialCars: 16, spawn: { startInterval: 1.2, minInterval: 0.45, rampTime: 120 } },
    { colors: 6, goal: { each: 6 }, par: 200, initialCars: 18, spawn: { startInterval: 1.1, minInterval: 0.4, rampTime: 120 } },
  ],
  levelScaling: { goalPerLevel: 2, spawnFactor: 0.92 }, // applied per level past the list
  levelBonus: { perHealth: 2, perSecondUnderPar: 5 },

  damage: {
    maxHealth: 100,
    // Impacts: damage = (impulse - threshold) * perImpulse * fault, where
    // fault is the other car's share of the closing speed (so your own rams
    // are free, getting slammed isn't), at least boostRamMult while boosting,
    // and wallMult for walls/blocks.
    impactThreshold: 14,    // walls and boost-rams
    hitThreshold: 5,        // getting hit by another car (fault-scaled)
    perImpulse: 0.6,
    boostRamMult: 0.25,
    wallMult: 0.25,
    // Squeeze: while slow and touching 2+ things (at least one car).
    squeezeSpeed: 1.5,
    squeezePerSec: 6,
    drainPerSec: 0.7,       // constant wear: ~140 s from full without repairs
    // Repair: exploding the repair color heals. Repair windows come and go:
    // a color is the repair color for repairOnTime, then there's no repair
    // color for repairOffTime, then a new one is picked.
    healPerCar: 8,
    repairOnTime: 18,
    repairOffTime: 12,
  },
  // Landscape arena, bigger than the screen; the camera follows the player.
  // Coordinates: x right, y down, origin top-left.
  arena: {
    width: 40,
    height: 24,
    wallThickness: 1,
  },

  camera: {
    viewHeight: 14,         // meters of arena visible vertically (zoom)
    minViewWidth: 20,       // on narrow screens, zoom out to show at least this much width
    lookAhead: 0.35,        // seconds of velocity to lead the camera by
    follow: 5,              // how quickly the camera catches up (1/s)
  },

  physics: {
    stepHz: 60,
    velocityIterations: 8,
    positionIterations: 3,
    maxSubSteps: 4,
    restitution: 0.12,      // bounciness of car-car hits (low = thuddy, not floaty)
    friction: 0.15,         // car-car scrape friction (low = cars glance off, easier to pivot free)
    wallFriction: 0.05,     // low so cars slide along walls instead of sticking nose-first
  },

  car: {
    length: 1.8,
    width: 1.0,
  },

  player: {
    density: 3.0,           // relative to AI density; heavier = shoves harder
    topSpeed: 7,            // m/s
    accel: 22,              // m/s^2 drive acceleration below top speed
    turnRate: 3.6,          // rad/s at full steer
    steerResponse: 45,      // how fast angular velocity reaches target (1/s); high = crisp, and lets you pivot out of pins
    minTurnFactor: 0.45,    // fraction of turnRate available at zero speed
    fullTurnSpeed: 3,       // speed (m/s) at which full turn rate is available
    lateralGrip: 1.0,       // max sideways-cancel impulse per step, as fraction of mass*m/s
    linearDamping: 0.3,
    angularDamping: 4,
    brakeDecel: 28,         // m/s^2 when braking (both sides held, or S / Down)
    reverseAccel: 9,        // m/s^2 once stopped and still braking
    reverseSpeed: 3.5,      // max reverse speed (m/s)
  },

  input: {
    swipeBoost: true,       // a quick upward swipe on either side also boosts
    swipePx: 45,
    swipeMs: 350,
  },

  // Second ability slot (left edge). One is equipped at a time; the small
  // swap button (or Q) cycles through `list`. E / the button uses it.
  abilities: {
    list: ['chameleon', 'phase', 'tow'],
    start: 'chameleon',
    // Chameleon: your car counts as one car toward minGroup for any group it
    // touches, so a pair + you explodes.
    chameleon: { duration: 5, cooldown: 14 },
    // Phase: pass through cars and blocks (not the arena walls). Stays on past
    // `duration` while still overlapping something, up to maxExtend.
    phase: { duration: 1.5, cooldown: 12, maxExtend: 1.5 },
    // Tow: rope the nearest car within `range`; press again to drop it.
    tow: { range: 3.5, ropeLength: 2.2, maxTime: 10, cooldown: 6 },
  },

  boost: {
    speedMultiplier: 1.8,   // top speed multiplier while boosting
    accelMultiplier: 3.0,   // drive accel multiplier while boosting
    kick: 6,                // instant forward velocity added on activation (m/s)
    duration: 0.45,         // seconds
    cost: 0.5,              // fraction of the meter per boost
    rechargeTime: 3.0,      // seconds to refill an empty meter
  },

  ai: {
    density: 1.0,
    speed: 2.2,             // wander cruise speed (m/s)
    accel: 6,
    turnRate: 1.6,
    lateralGrip: 0.12,      // low = slides when shoved sideways
    linearDamping: 1.6,     // high = stops soon after a shove (weighty, not floaty)
    angularDamping: 5,
    wanderMinTime: 1.5,     // seconds between heading changes
    wanderMaxTime: 4.0,
    wanderMaxTurn: 1.6,     // radians, max heading change per decision
    wallAvoidDist: 2.2,     // start steering toward center within this of a wall
    stunTime: 1.6,          // seconds AI stops driving after a hard hit
    stunImpulse: 1.2,       // normal impulse (N*s) that counts as a hard hit
    stunDamping: 3.5,       // linear damping while stunned
    stunFromAI: true,       // AI-AI and AI-wall hits also stun (more natural clumping)
    // Pressure: chance that a wander decision heads toward the player instead,
    // ramping from seekStart to seekMax over spawn.rampTime. The crowd drifts
    // your way as the level goes on, which is what makes boxing-in possible.
    seekStart: 0.0,
    seekMax: 0.35,
  },

  spawn: {
    initialCars: 10,
    startInterval: 1.6,     // seconds between spawns at t=0
    minInterval: 0.45,      // fastest spawn interval
    rampTime: 120,          // seconds to go from start to min interval
    maxCars: 80,            // ~0.08 cars/m^2 in the 40x24 arena
    edgeInset: 1.4,         // spawn this far inside the wall
    clearance: 1.3,         // half-size of the box that must be empty to spawn
  },

  // AI vehicle types. Values override CONFIG.ai for that type. `counts` is how
  // much each body counts toward match size and level goals.
  vehicles: {
    car: { length: 1.8, width: 1.0, counts: 1 },
    motorcycle: { length: 1.25, width: 0.55, counts: 1, density: 0.7, speed: 3.4, accel: 9, turnRate: 2.6, lateralGrip: 0.2 },
    bus: { length: 3.6, width: 1.2, counts: 2, density: 1.5, speed: 1.6, accel: 4, turnRate: 1.0 },
    // Semi: a cab plus a trailer on a hinge; each body counts 1 (2 total).
    semi: { length: 1.7, width: 1.15, counts: 1, density: 1.3, speed: 1.8, accel: 5, turnRate: 1.2,
      trailer: { length: 3.4, width: 1.15, density: 1.1, lateralGrip: 0.3 }, hingeLimit: 1.3 },
    // Police chase the player when within chaseRange.
    police: { length: 1.9, width: 1.0, counts: 1, density: 1.3, speed: 3.6, accel: 9, turnRate: 2.4, chaseRange: 12 },
  },
  vehicleMix: { car: 55, motorcycle: 14, bus: 11, semi: 10, police: 10 }, // spawn weights
  convoy: { types: 3, mult: 1.5 },  // match with 3+ vehicle types: points x1.5

  // Car colors, in the order they're introduced.
  colors: ['#ff4d5e', '#3fa9ff', '#ffd23f', '#4ade80', '#a970ff', '#ff8a3d'],
  // How many of those colors are in play from time t (seconds). More colors
  // means fewer same-color neighbors, so matches get harder.
  colorSchedule: [
    { t: 0, count: 3 },
    { t: 45, count: 4 },
    { t: 100, count: 5 },
    { t: 170, count: 6 },
  ],

  match: {
    // Who can set off a match:
    //  'chain'  - the player must be part of the chain: touching the group, or
    //             bridging same-color cars on either side (player is a wildcard
    //             link but doesn't count toward minGroup). Pull away before
    //             the delay ends and the countdown cancels.
    //  'tagged' - a group explodes only if one of its cars was recently hit by
    //             the player (or by a car the player knocked, or a blast).
    //  'touch'  - the player must have touched the group (countdown sticks).
    //  'any'    - any group explodes on its own (original Phase 1 behavior).
    //  Groups that qualify but aren't set off show as "primed".
    mode: 'chain',
    tagTime: 4.0,           // seconds a car stays tagged after the player hits it
    tagCarry: 0.75,         // fraction of tag passed on when a tagged car hits another
    carryImpulse: 5,        // min impulse (N*s) for a tag to pass on; above AI cruising bumps
    minGroup: 3,
    delay: 0.3,             // seconds a group must hold before exploding
    contactMargin: 0.14,    // sensor padding (m): how close counts as "touching"
    pointsPerCar: 10,
    comboWindow: 1.5,       // seconds; explosions within this chain a combo
    blastRadius: 4.0,
    blastImpulse: 9,        // m/s velocity change at blast center (scaled by mass)
  },

  // Terrain. Rects are centered at (x, y) with size w x h, in meters.
  // Blocks either touch a wall or leave >= 3 m gaps, so cars don't jam in slivers.
  terrain: {
    blocks: [
      { x: 14, y: 3, w: 1, h: 6 },         // stub off the top wall
      { x: 26, y: 21, w: 1, h: 6 },        // stub off the bottom wall
      { x: 20, y: 12, w: 4, h: 2 },        // central island
      { x: 7, y: 6, w: 1.6, h: 1.6 },
      { x: 33, y: 18, w: 1.6, h: 1.6 },
    ],
    zones: [
      { type: 'ice', x: 33, y: 7, w: 10, h: 7 },
      { type: 'ice', x: 19, y: 20, w: 6, h: 3 },
      { type: 'mud', x: 8, y: 18.5, w: 9, h: 6 },
      { type: 'mud', x: 20, y: 5, w: 5, h: 3 },
    ],
    // Multipliers applied to a car whose center is inside the zone.
    types: {
      ice: { grip: 0.08, damping: 0.15, accel: 0.55, speed: 1.0 },
      mud: { grip: 1.0, damping: 2.5, accel: 0.6, speed: 0.45 },
    },
  },

  // Pile-ups: a connected clump of at least `size` touching AI cars (any
  // colors) that holds together starts rusting. Each car rusts into junk after
  // rustTime (+/- rustJitter) seconds in a pile-up: grey, heavy, unmatchable.
  // An explosion destroys junk within clearRadius of the exploding cars.
  pileup: {
    size: 7,
    rustTime: 6,
    rustJitter: 1.5,
    recover: 2,             // rust timer drains this many times faster outside a pile-up
    junkDensity: 3,         // x AI density
    junkDamping: 4,
    clearRadius: 2.6,
    pointsPerJunk: 5,
  },

  stuck: {
    speed: 0.6,             // player speed (m/s) considered "not moving"
    time: 2.0,              // seconds stuck before game over
    decay: 3.0,             // stuck timer drains this many times faster than it fills
  },

  fx: {
    shakeImpulse: 4,        // impulse involving player that triggers shake
    shakeMax: 0.35,         // max shake offset (m)
    shakeDecay: 6,
    particlesPerCar: 14,
    maxParticles: 600,
    sparkImpulse: 3,
  },

  render: {
    maxDpr: 2,              // cap device pixel ratio for fill-rate on phones
    minimapWidth: 132,      // px; 0 hides the minimap
  },
};
