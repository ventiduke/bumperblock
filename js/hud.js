// DOM HUD: score, combo, boost meter, game-over panel, debug text.
import { CONFIG } from '../config.js';

export function createHUD() {
  const $ = (id) => document.getElementById(id);
  const el = {
    score: $('score'),
    combo: $('combo'),
    boostBar: $('boost-bar'),
    boostBtn: $('boost'),
    gameover: $('gameover'),
    finalScore: $('final-score'),
    debug: $('debug-text'),
  };
  let last = { score: -1, combo: -1, boost: -1, ready: null };

  return {
    el,
    update(game) {
      if (game.score !== last.score) {
        el.score.textContent = game.score;
        last.score = game.score;
      }
      const combo = game.comboTimer > 0 && game.combo > 1 ? game.combo : 0;
      if (combo !== last.combo) {
        el.combo.textContent = combo ? `COMBO x${combo}` : '';
        last.combo = combo;
      }
      const b = Math.round(game.player.boostCharge * 100) / 100;
      if (b !== last.boost) {
        document.documentElement.style.setProperty('--boost', b);
        last.boost = b;
      }
      const ready = game.player.boostCharge >= CONFIG.boost.cost - 1e-6;
      if (ready !== last.ready) {
        el.boostBar.classList.toggle('ready', ready);
        el.boostBtn.classList.toggle('disabled', !ready);
        last.ready = ready;
      }
    },
    showGameOver(score) {
      el.finalScore.textContent = score;
      el.gameover.hidden = false;
    },
    hideGameOver() {
      el.gameover.hidden = true;
      last = { score: -1, combo: -1, boost: -1, ready: null };
    },
  };
}
