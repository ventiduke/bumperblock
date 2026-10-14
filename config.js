// All tuning values for Bumper Block. Units: meters, seconds, kg.
// Tweak here; nothing else needs to change.

export const CONFIG = {
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
