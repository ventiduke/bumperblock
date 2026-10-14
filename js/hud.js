// DOM HUD: score, combo, level goal, health + repair color, boost button
// state, toasts, and the game-over / level-complete panels.
import { CONFIG } from '../config.js';
import { abilityLabel } from './abilities.js';

export function createHUD() {
  const $ = (id) => document.getElementById(id);
  const el = {
    score: $('score'),
    combo: $('combo'),
    goal: $('goal'),
    goalLabel: $('goal-label'),
    goalItems: $('goal-items'),
    health: $('health'),
    healthFill: $('health-fill'),
    repair: $('repair'),
    boostBtn: $('boost'),
    abilityBtn: $('ability'),
    abilityLabel: $('ability-label'),
    cycleBtn: $('ability-cycle'),
    gameover: $('gameover'),
    goTitle: $('go-title'),
    goLevel: $('go-level'),
    finalScore: $('final-score'),
    levelup: $('levelup'),
    luTitle: $('lu-title'),
    luStars: $('lu-stars'),
    luStats: $('lu-stats'),
    toast: $('toast'),
    toastText: document.querySelector('#toast .text'),
    toastSwatch: document.querySelector('#toast .swatch'),
  };
  let last = {};
  let toastTimer = 0;
  // Only touch the DOM when a value changes.
  const changed = (key, value) => {
    if (last[key] === value) return false;
    last[key] = value;
    return true;
  };

  function renderGoal(game) {
    const lv = game.level;
    const c = game.cleared;
    let key, html;
    if (lv.total != null) {
      key = `t${c.total}/${lv.total}`;
      const pct = Math.min(100, (100 * c.total) / lv.total);
      html = `<div class="goal-total"><div class="goal-fill" style="width:${pct}%"></div><span>${Math.min(c.total, lv.total)} / ${lv.total}</span></div>`;
    } else if (lv.each != null) {
      const parts = [];
      for (let i = 0; i < lv.colors; i++) {
        const n = Math.min(c.byColor[i] || 0, lv.each);
        parts.push(`<span class="chip${n >= lv.each ? ' done' : ''}"><i style="background:${CONFIG.colors[i]}"></i>${n}/${lv.each}</span>`);
      }
      key = `e${parts.join('')}`;
      html = parts.join('');
    } else {
      key = 'none';
      html = '';
    }
    if (changed('goal', key)) el.goalItems.innerHTML = html;
    if (changed('goalLabel', game.levelIndex)) {
      el.goalLabel.textContent = CONFIG.features.levels ? `Level ${game.levelIndex + 1}` : '';
    }
  }

  return {
    el,
    update(game) {
      if (changed('score', game.score)) el.score.textContent = game.score;
      const combo = game.comboTimer > 0 && game.combo > 1 ? game.combo : 0;
      if (changed('combo', combo)) el.combo.textContent = combo ? `COMBO x${combo}` : '';

      if (changed('levels', CONFIG.features.levels)) el.goal.hidden = !CONFIG.features.levels;
      if (CONFIG.features.levels) renderGoal(game);

      if (changed('damage', CONFIG.features.damage)) el.health.hidden = !CONFIG.features.damage;
      if (CONFIG.features.damage) {
        const frac = Math.max(0, game.health / CONFIG.damage.maxHealth);
        const pct = Math.round(frac * 100);
        if (changed('hp', pct)) {
          el.healthFill.style.width = `${pct}%`;
          el.healthFill.className = frac < 0.25 ? 'low' : frac < 0.5 ? 'mid' : '';
        }
        if (changed('repair', game.repairColor)) {
          const none = game.repairColor < 0;
          el.repair.classList.toggle('none', none);
          el.repair.style.background = none ? '' : CONFIG.colors[game.repairColor];
          el.repair.title = none ? 'No repair color right now' : 'Repair color: explode these to heal';
        }
        el.health.classList.toggle('hurt', game.hurtFlash > 0.15);
      }

      // Ability: ring shows recharge, or time left (white) while active.
      const pl = game.player;
      const active = pl.abilityTime > 0 || !!pl.towed;
      const A = CONFIG.abilities[pl.ability];
      const ring = active ? Math.max(0, pl.abilityTime) / (pl.ability === 'tow' ? A.maxTime : A.duration) : pl.abilityCharge;
      const rq = Math.round(Math.min(1, ring) * 50) / 50;
      if (changed('abilityRing', rq)) el.abilityBtn.style.setProperty('--ability', rq);
      const label = pl.towed ? 'DROP' : abilityLabel(pl.ability);
      if (changed('abilityLabel', label)) el.abilityLabel.textContent = label;
      if (changed('abilityActive', active)) {
        el.abilityBtn.classList.toggle('active', active);
        el.cycleBtn.classList.toggle('locked', active);
      }
      const aReady = active || pl.abilityCharge >= 1;
      if (changed('abilityReady', aReady)) el.abilityBtn.classList.toggle('disabled', !aReady);

      const b = Math.round(game.player.boostCharge * 100) / 100;
      if (changed('boost', b)) document.documentElement.style.setProperty('--boost', b);
      const ready = game.player.boostCharge >= CONFIG.boost.cost - 1e-6;
      if (changed('ready', ready)) el.boostBtn.classList.toggle('disabled', !ready);
    },
    // Short banner under the HUD, with an optional color swatch.
    announce(text, color = null) {
      el.toastText.textContent = text;
      el.toastSwatch.hidden = !color;
      if (color) el.toastSwatch.style.background = color;
      el.toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2400);
    },
    showGameOver(title, score, levelIndex) {
      el.goTitle.textContent = title;
      el.goLevel.textContent = CONFIG.features.levels ? `Level ${levelIndex + 1} · Score` : 'Score';
      el.finalScore.textContent = score;
      $('restart-first').hidden = !CONFIG.features.levels || levelIndex === 0;
      el.toast.classList.remove('show');
      el.gameover.hidden = false;
    },
    showLevelComplete({ level, time, health, bonus, score, stars, damage }) {
      el.luTitle.textContent = `Level ${level} clear!`;
      el.luStars.innerHTML = [1, 2, 3].map((i) => `<span class="${i <= stars ? 'on' : ''}">★</span>`).join('');
      const rows = [
        ['Time', `${time.toFixed(1)}s`],
        ...(damage ? [['Health left', `${Math.round(health)}`]] : []),
        ['Bonus', `+${bonus}`],
        ['Score', `${score}`],
      ];
      el.luStats.innerHTML = rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
      el.toast.classList.remove('show');
      el.levelup.hidden = false;
    },
    hidePanels() {
      el.gameover.hidden = true;
      el.levelup.hidden = true;
      last = {};
    },
  };
}
