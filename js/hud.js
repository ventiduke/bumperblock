// DOM HUD: score, combo, level goal, health + repair color, boost button
// state, toasts, and the game-over / level-complete panels.
import { CONFIG } from '../config.js';
import { abilityLabel } from './abilities.js';

// <tr> rows for [label, value] pairs.
function statRows(rows) {
  return rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
}

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
    weather: $('weather'),
    weatherIcon: document.querySelector('#weather .icon'),
    weatherWind: document.querySelector('#weather .wind'),
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
        const frac = Math.max(0, game.health / game.maxHealth);
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

      const ws = game.weather?.spec;
      if (ws && changed('weather', ws.name)) {
        el.weather.hidden = !ws.icon;
        el.weatherIcon.textContent = ws.icon;
        el.weather.title = ws.label;
        el.weatherWind.hidden = !ws.wind;
      }
      if (ws?.wind) {
        const w = game.weather;
        const deg = Math.round((w.windAngle * 180) / Math.PI / 5) * 5;
        const k = Math.round(Math.min(1, w.windStrength / (CONFIG.weather.wind.base * ws.wind * CONFIG.weather.wind.gustMult)) * 10) / 10;
        if (changed('wind', `${deg},${k}`)) {
          el.weatherWind.style.transform = `rotate(${deg}deg) scale(${0.8 + 0.6 * k})`;
          el.weatherWind.style.opacity = 0.5 + 0.5 * k;
        }
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
      if (changed('canSwap', game.unlocked.length > 1)) el.cycleBtn.hidden = game.unlocked.length < 2;
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
    setMuted(m) {
      $('mute').classList.toggle('muted', m);
      $('mute').setAttribute('aria-label', m ? 'Unmute sound' : 'Mute sound');
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
    showGameOver(title, score, levelIndex, summary = []) {
      $('go-stats').innerHTML = statRows(summary);
      el.goTitle.textContent = title;
      el.goLevel.textContent = CONFIG.features.levels ? `Level ${levelIndex + 1} · Score` : 'Score';
      el.finalScore.textContent = score;
      $('restart-first').hidden = !CONFIG.features.levels || levelIndex === 0;
      el.toast.classList.remove('show');
      el.gameover.hidden = false;
    },
    // Set by main: called with the index of the card the player picks.
    onPickCard: null,
    showLevelComplete({ level, time, health, bonus, score, stars, damage, summary = [], cards = [], picks = [] }) {
      el.luTitle.textContent = `Level ${level} clear!`;
      el.luStars.innerHTML = [1, 2, 3].map((i) => `<span class="${i <= stars ? 'on' : ''}">★</span>`).join('');
      const rows = [
        ['Time', `${time.toFixed(1)}s`],
        ...(damage ? [['Health left', `${Math.round(health)}`]] : []),
        ['Bonus', `+${bonus}`],
        ['Score', `${score}`],
      ];
      el.luStats.innerHTML = statRows(rows);
      $('lu-summary').innerHTML = statRows(summary);
      // Upgrade draft: pick one card to continue (or a plain Next button).
      const cardsEl = $('lu-cards');
      cardsEl.innerHTML = cards.map((c, i) => `
        <button class="card ${c.kind}" type="button" data-i="${i}">
          <span class="tag">${{ ability: 'New ability', upgrade: 'Upgrade', rule: 'Rule' }[c.kind]}</span>
          <b>${c.name}</b><span class="desc">${c.desc}</span><span class="key">${i + 1}</span>
        </button>`).join('');
      cardsEl.querySelectorAll('.card').forEach((b) => b.addEventListener('click', () => this.onPickCard?.(Number(b.dataset.i))));
      $('lu-pick').hidden = !cards.length;
      $('next-level').hidden = cards.length > 0;
      $('lu-picks').textContent = picks.length ? `This run: ${picks.join(', ')}` : '';
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
