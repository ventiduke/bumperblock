// All tuning values for Bumper Block. Units: meters, seconds, kg.
// Tweak here; nothing else needs to change.

export const CONFIG = {
  // Landscape arena. Coordinates: x right, y down, origin top-left.
  arena: {
    width: 25,
    height: 14,
    wallThickness: 1,
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
  },

  spawn: {
    initialCars: 6,
    startInterval: 2.2,     // seconds between spawns at t=0
    minInterval: 0.6,       // fastest spawn interval
    rampTime: 120,          // seconds to go from start to min interval
    maxCars: 40,
    edgeInset: 1.4,         // spawn this far inside the wall
    clearance: 1.3,         // half-size of the box that must be empty to spawn
  },

  // Index order matters only for display. Remove entries for fewer colors.
  colors: ['#ff4d5e', '#3fa9ff', '#ffd23f', '#4ade80'],

  match: {
    // Who can set off a match:
    //  'tagged' - a group explodes only if one of its cars was recently hit by
    //             the player (or by a car the player knocked, or a blast).
    //             Untagged groups sit "primed" until you bump them.
    //  'touch'  - the player must be touching the group.
    //  'any'    - any group explodes on its own (original Phase 1 behavior).
    mode: 'tagged',
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
  terrain: {
    blocks: [
      // Two stubs off the top and bottom walls leave a 7 m gap in the middle
      // (no thin slivers for cars to jam in).
      { x: 12.5, y: 1.75, w: 1.0, h: 3.5 },
      { x: 12.5, y: 12.25, w: 1.0, h: 3.5 },
      { x: 6.5, y: 4.0, w: 1.6, h: 1.6 },
    ],
    zones: [
      { type: 'ice', x: 19.0, y: 4.2, w: 6.5, h: 4.5 },
      { type: 'mud', x: 6.5, y: 10.5, w: 5.5, h: 4.0 },
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
    hudTopPx: 52,           // reserved space for the top HUD bar (when no side room)
    sideHudPx: 84,          // if side margins are at least this wide, HUD moves into them
    boostReservePx: 104,    // space kept under the arena for the boost button, if it fits
  },
};
