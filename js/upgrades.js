// Run upgrades: after each level, pick 1 of 3 cards that last for the rest
// of the run. Cards are ability unlocks, stackable stat upgrades, or unique
// rule-benders. The picks become `mods`, which the game systems read.
import { CONFIG } from '../config.js';

// kind: 'ability' (unlock), 'upgrade' (stacks), 'rule' (once per run).
export const CARDS = [
  { id: 'phase', kind: 'ability', name: 'Phase', desc: 'Unlock Phase: drive through cars and blocks for a moment.' },
  { id: 'tow', kind: 'ability', name: 'Tow hook', desc: 'Unlock Tow: rope a car and drag it into a group.' },

  { id: 'boost', kind: 'upgrade', name: 'Turbo', desc: 'Boost recharges 25% faster.', apply: (m) => { m.boostRecharge *= 1.25; } },
  { id: 'blast', kind: 'upgrade', name: 'Big bang', desc: 'Explosion blasts reach 30% further.', apply: (m) => { m.blastRadius *= 1.3; } },
  { id: 'repairWin', kind: 'upgrade', name: 'Mechanic', desc: 'Repair windows last 50% longer.', apply: (m) => { m.repairOn *= 1.5; } },
  { id: 'shimmer', kind: 'upgrade', name: 'Long shimmer', desc: 'Chameleon lasts 2s longer.', apply: (m) => { m.chameleonPlus += 2; } },
  { id: 'rope', kind: 'upgrade', name: 'Long rope', desc: 'Tow reaches and ropes 1.2m further.', needs: 'tow', apply: (m) => { m.ropePlus += 1.2; } },
  { id: 'junk', kind: 'upgrade', name: 'Scrapper', desc: 'Explosions clear junk 50% further away.', apply: (m) => { m.junkClear *= 1.5; } },
  { id: 'cops', kind: 'upgrade', name: 'Bull bars', desc: 'Police rams hit 30% softer.', apply: (m) => { m.copRam *= 0.7; } },
  { id: 'armor', kind: 'upgrade', name: 'Plating', desc: '+25 max health (and a full repair).', apply: (m) => { m.healthPlus += 25; } },

  { id: 'bigHeal', kind: 'rule', name: 'Feeding frenzy', desc: 'Matches of 4+ heal you 6 HP, any color.', apply: (m) => { m.bigHeal = 6; } },
  { id: 'heavy', kind: 'rule', name: 'Heavy fare', desc: 'Buses and semis count triple.', apply: (m) => { m.heavyCount = 3; } },
  { id: 'slick', kind: 'rule', name: 'Ghost slick', desc: 'Phase leaves a trail of ice behind you.', needs: 'phase', apply: (m) => { m.phaseSlick = true; } },
];

const byId = Object.fromEntries(CARDS.map((c) => [c.id, c]));

export function cardById(id) {
  return byId[id];
}

// A fresh run: no picks yet, starting abilities only.
export function newRun() {
  return { picks: [], unlocked: [...CONFIG.upgrades.startAbilities] };
}

// Defaults that every system reads; cards modify a copy.
export function computeMods(run) {
  const m = {
    boostRecharge: 1, blastRadius: 1, repairOn: 1, chameleonPlus: 0, ropePlus: 0,
    junkClear: 1, copRam: 1, healthPlus: 0, bigHeal: 0, heavyCount: 0, phaseSlick: false,
  };
  if (!CONFIG.features.upgrades) return m;
  for (const id of run.picks) byId[id]?.apply?.(m);
  return m;
}

// Abilities the player can equip this run (all of them with upgrades off).
export function unlockedAbilities(run) {
  if (!CONFIG.features.upgrades) return CONFIG.abilities.list;
  return CONFIG.abilities.list.filter((a) => run.unlocked.includes(a));
}

// Three distinct cards to choose from. Ability cards only if still locked,
// rules at most once, cards with `needs` only once that ability is unlocked.
export function drawCards(run, n = 3, rand = Math.random) {
  const pool = CARDS.filter((c) => {
    if (c.kind === 'ability') return !run.unlocked.includes(c.id);
    if (c.kind === 'rule' && run.picks.includes(c.id)) return false;
    if (c.needs && !run.unlocked.includes(c.needs)) return false;
    return true;
  });
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
}

export function pickCard(run, id) {
  const card = byId[id];
  if (!card) return;
  run.picks.push(id);
  if (card.kind === 'ability' && !run.unlocked.includes(id)) run.unlocked.push(id);
}
