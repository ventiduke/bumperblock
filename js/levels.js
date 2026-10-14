// Level definitions, goal tracking, and results.
import { CONFIG } from '../config.js';
import { colorCount } from './spawner.js';

// Normalized level i (0-based). Past the list, the last level repeats with
// bigger goals and faster spawns.
export function getLevel(i) {
  const list = CONFIG.levels;
  const base = list[Math.min(i, list.length - 1)];
  const extra = Math.max(0, i - (list.length - 1));
  const S = CONFIG.levelScaling;
  const f = Math.pow(S.spawnFactor, extra);
  const colors = Math.min(base.colors, CONFIG.colors.length);
  const grow = extra * S.goalPerLevel;
  return {
    index: i,
    colors,
    total: base.goal.total != null ? base.goal.total + grow * 2 : null,
    each: base.goal.each != null ? base.goal.each + grow : null,
    par: base.par,
    types: base.types ?? null,
    initialCars: base.initialCars ?? CONFIG.spawn.initialCars,
    spawn: {
      startInterval: (base.spawn?.startInterval ?? CONFIG.spawn.startInterval) * f,
      minInterval: (base.spawn?.minInterval ?? CONFIG.spawn.minInterval) * f,
      rampTime: base.spawn?.rampTime ?? CONFIG.spawn.rampTime,
    },
  };
}

// Endless mode (features.levels off): no goal, colors follow colorSchedule.
export function endlessLevel() {
  return {
    index: -1,
    colors: null,
    total: null,
    each: null,
    par: 0,
    types: null,
    initialCars: CONFIG.spawn.initialCars,
    spawn: {
      startInterval: CONFIG.spawn.startInterval,
      minInterval: CONFIG.spawn.minInterval,
      rampTime: CONFIG.spawn.rampTime,
    },
  };
}

export function activeColors(level, elapsed) {
  return level.colors ?? colorCount(elapsed);
}

export function goalText(level) {
  if (level.total != null) return `Clear ${level.total} cars`;
  if (level.each != null) return `Clear ${level.each} of each color`;
  return 'Survive';
}

// True once the level's goal is met.
export function goalMet(level, cleared) {
  if (level.total != null) return cleared.total >= level.total;
  if (level.each != null) {
    for (let c = 0; c < level.colors; c++) if ((cleared.byColor[c] || 0) < level.each) return false;
    return true;
  }
  return false;
}

// Stars: 3 at or under par, 2 within 1.5x par, else 1.
export function starsFor(level, time) {
  if (time <= level.par) return 3;
  if (time <= level.par * 1.5) return 2;
  return 1;
}

export function levelBonus(level, time, health) {
  const B = CONFIG.levelBonus;
  return Math.round(Math.max(0, health) * B.perHealth + Math.max(0, level.par - time) * B.perSecondUnderPar);
}
