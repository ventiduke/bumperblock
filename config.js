// All tuning values for Bumper Block. Units: meters, seconds, kg.
// Tweak here; nothing else needs to change.

export const CONFIG = {
  arena: {
    width: 14,
    height: 25,
    wallThickness: 1,
  },

  physics: {
    stepHz: 60,
    velocityIterations: 8,
    positionIterations: 3,
    maxSubSteps: 4,
    restitution: 0.12,      // bounciness of car-car hits (low = thuddy, not floaty)
    friction: 0.35,         // surface friction between bodies when they scrape
  },

  car: {
    length: 1.8,
    width: 1.0,
  },

  player: {
    density: 3.0,           // relative to AI density; heavier = shoves harder
    topSpeed: 8.5,          // m/s
    accel: 22,              // m/s^2 drive acceleration below top speed
    turnRate: 3.6,          // rad/s at full steer
    steerResponse: 14,      // how fast angular velocity reaches target (1/s)
    minTurnFactor: 0.45,    // fraction of turnRate available at zero speed
    fullTurnSpeed: 3,       // speed (m/s) at which full turn rate is available
    lateralGrip: 1.0,       // max sideways-cancel impulse per step, as fraction of mass*m/s
    linearDamping: 0.3,
    angularDamping: 4,
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
  },

  spawn: {
    initialCars: 6,
    startInterval: 2.6,     // seconds between spawns at t=0
    minInterval: 0.7,       // fastest spawn interval
    rampTime: 150,          // seconds to go from start to min interval
    maxCars: 40,
    edgeInset: 1.4,         // spawn this far inside the wall
    clearance: 1.3,         // half-size of the box that must be empty to spawn
  },

  // Index order matters only for display. Remove entries for fewer colors.
  colors: ['#ff4d5e', '#3fa9ff', '#ffd23f', '#4ade80'],

  match: {
    minGroup: 3,
    delay: 0.3,             // seconds a group must hold before exploding
    contactMargin: 0.14,    // sensor padding (m): how close counts as "touching"
    pointsPerCar: 10,
    comboWindow: 1.5,       // seconds; explosions within this chain a combo
    blastRadius: 4.0,
    blastImpulse: 9,        // m/s velocity change at blast center (scaled by mass)
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
    hudTopPx: 52,           // reserved space for the top HUD bar
  },
};
