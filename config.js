// All tuning values for Bumper Block. Units: meters, seconds, kg.
// Tweak here; nothing else needs to change.

export const CONFIG = {
  // Turn whole systems on/off to compare feel.
  features: {
    levels: true,           // level goals + results screen (off: endless, colorSchedule)
    damage: true,           // health, impact/squeeze damage, repair color
    pileups: true,          // big clumps of cars rust into junk
    upgrades: true,         // pick 1 of 3 upgrade cards after each level (off: all abilities unlocked)
    weather: true,          // per-level weather and lighting (off: always clear)
  },

  // Run upgrades (see js/upgrades.js for the cards).
  upgrades: {
    startAbilities: ['chameleon'], // the rest are unlocked by cards
    slickEvery: 0.12,       // Ghost slick: seconds between ice patches while phasing
    slickRadius: 1.2,
    slickLife: 6,
  },

  // Each level: colors in play, the goal, spawn pace, and a par time (s) for
  // stars. Goal is { total: N } (any colors) or { each: N } (N of every color).
  // Past the last level, it repeats with bigger goals and faster spawns.
  levels: [
    // `types` (optional) sets the vehicle mix; otherwise vehicleMix is used.
    // `caps` (optional) overrides per-type limits, e.g. how many cops at once.
    { colors: 3, goal: { total: 15 }, par: 90, initialCars: 12, spawn: { startInterval: 1.8, minInterval: 0.8, rampTime: 90 },
      types: { car: 70, motorcycle: 18, bus: 12 }, weather: 'sun' },
    { colors: 4, goal: { each: 6 }, par: 120, initialCars: 14, spawn: { startInterval: 1.5, minInterval: 0.6, rampTime: 100 },
      types: { car: 60, motorcycle: 16, bus: 12, semi: 12 }, weather: 'rain' },
    // Police ease in: 1 at a time (and rarer) on their first level, then 2, then the full 3.
    { colors: 4, goal: { total: 35 }, par: 140, initialCars: 16, spawn: { startInterval: 1.3, minInterval: 0.5, rampTime: 100 },
      types: { car: 58, motorcycle: 15, bus: 12, semi: 11, police: 4 }, caps: { police: 1 }, weather: 'wind' },
    { colors: 5, goal: { each: 6 }, par: 170, initialCars: 16, spawn: { startInterval: 1.2, minInterval: 0.45, rampTime: 120 },
      types: { car: 56, motorcycle: 14, bus: 11, semi: 11, police: 7 }, caps: { police: 2 }, weather: 'night' },
    { colors: 6, goal: { each: 6 }, par: 200, initialCars: 18, spawn: { startInterval: 1.1, minInterval: 0.4, rampTime: 120 },
      weather: 'snow' },
  ],
  // Weather and atmosphere (js/weather.js). Each level names one in
  // `levels[i].weather`; past the list they come from `cycle`. Names combine
  // with '+', e.g. 'night+rain'. ?weather=<name> in the URL forces one
  // (?weather=clear turns it off).
  weather: {
    cycle: ['storm', 'fog', 'night+rain', 'snow+wind', 'sun', 'storm+night'],
    // Ground multipliers (grip, damping, accel, speed) stack with terrain
    // zones. Player grip 1.0 only starts to slide below ~0.42 at full speed
    // and full turn, so these are deliberately low.
    presets: {
      clear: {},
      sun: { label: 'Sunny', icon: '☀', sun: true, floor: '#2b2e37' },
      rain: { label: 'Rain: slick roads, cars slide further', icon: '☂', rain: 1, puddles: 6,
        ground: { grip: 0.35, damping: 0.85 }, dark: 0.16 },
      storm: { label: 'Storm: watch for lightning', icon: '⚡', rain: 1.6, puddles: 8, lightning: true, wind: 0.5,
        ground: { grip: 0.3, damping: 0.85 }, dark: 0.32 },
      snow: { label: 'Snow: low grip, drifts slow you down', icon: '❄', snow: 1, drifts: 5,
        ground: { grip: 0.2, accel: 0.8, speed: 0.92 } },
      night: { label: 'Night: stay in the stadium lights', icon: '☾', night: true },
      wind: { label: 'Wind: gusts push the crowd', icon: '≋', wind: 1 },
      fog: { label: 'Fog: watch the minimap', icon: '☁', fog: true },
    },
    surfaces: {
      puddle: { grip: 0.5, damping: 0.8, accel: 1, speed: 1 },
      drift: { grip: 1, damping: 2, accel: 0.6, speed: 0.6 },
    },
    // Wind: a drift velocity (m/s) for a density-1 car; heavier vehicles (and
    // the player) drift less. Gusts multiply it for a few seconds.
    wind: { base: 0.8, gustMult: 3, gustEvery: [5, 9], gustTime: 2.5, response: 1.5 },
    // Lightning: a warning ring, then a strike that shoves and stuns cars,
    // hurts the player if close, and destroys junk (it can help, too).
    lightning: { first: 8, every: [6, 11], warn: 1.5, nearPlayer: 0.5, onJunk: 0.3,
      radius: 3.2, shove: 10, hitRadius: 2, damage: 12, skid: 0.5 },
    night: { darkness: 0.82, poolRadius: 9.5, headlight: 8, outageEvery: [20, 35], outageTime: 5 },
    fog: { density: 0.86, clearRadius: 3, fadeRadius: 8 },
    snowCoverTime: 30,      // seconds for snow to settle over the floor
  },
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
  // swap button (or Q) cycles through `list`, and 1/2/3 pick directly.
  // F (or E) / the button uses it.
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
    // Police chase the player when within chaseRange, aiming `lead` seconds
    // ahead of where you're going. Heavy and grippy so they shove you around,
    // and they shake off hits fast (short stunTime). At most `max` at a time.
    police: { length: 1.9, width: 1.0, counts: 1, density: 3.0, speed: 5.5, accel: 16, turnRate: 3.4,
      lateralGrip: 0.6, stunTime: 0.4, stunImpulse: 8, chaseRange: 16, lead: 0.4, max: 3,
      // Ram: while touching the player, slam it every ramCooldown seconds with
      // a ramShove (m/s) kick along the cop's heading, costing ramDamage HP.
      // The ram also breaks your traction: grip x ramSkidGrip for ramSkid seconds.
      ramShove: 3.5, ramCooldown: 0.8, ramDamage: 3, ramSkid: 0.4, ramSkidGrip: 0.1, ramSpin: 1.5 },
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

  // Synthesized sound (js/audio.js) and game feel.
  audio: {
    volume: 0.55,           // master
    engine: 0.035,          // engine hum loudness
    siren: 0.09,            // police siren at point-blank range
    impactMin: 3,           // impulse (N*s) below which hits make no sound
    rain: 0.08,             // rain hiss at full intensity
    wind: 0.12,             // wind noise in a full gust
  },
  feel: {
    hitstop: 0.09,          // seconds of freeze-frame on a big match (4+, convoy or combo)
    haptics: true,          // vibrate on hard hits / explosions where supported (Android)
    skidMarks: true,
    skidSlip: 2.2,          // sideways speed (m/s) that leaves tire marks
    skidLife: 4,            // seconds marks take to fade
  },

  render: {
    maxDpr: 2,              // cap device pixel ratio for fill-rate on phones
    minimapWidth: 132,      // px; 0 hides the minimap
  },
};
