// Steering from touch halves / keyboard, plus boost (button, swipe up, Space).
import { CONFIG } from '../config.js';

export function createInput(canvas, boostButton, abilityButton, cycleButton) {
  const touches = new Map(); // pointerId -> -1 | 1
  const swipes = new Map(); // pointerId -> { y, t, fired }
  const keys = new Set();
  let boostQueued = false;
  let abilityQueued = false;
  let cycleQueued = false;

  const sideOf = (e) => (e.clientX < window.innerWidth / 2 ? -1 : 1);

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    touches.set(e.pointerId, sideOf(e));
    swipes.set(e.pointerId, { y: e.clientY, t: performance.now(), fired: false });
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, sideOf(e));
    // Quick upward flick = boost (once per touch); steering carries on.
    const sw = swipes.get(e.pointerId);
    const I = CONFIG.input;
    if (I.swipeBoost && sw && !sw.fired && performance.now() - sw.t <= I.swipeMs && sw.y - e.clientY >= I.swipePx) {
      sw.fired = true;
      boostQueued = true;
    }
  });
  const release = (e) => {
    touches.delete(e.pointerId);
    swipes.delete(e.pointerId);
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('lostpointercapture', release);

  boostButton.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    boostQueued = true;
    boostButton.classList.add('pressed');
  });
  const unpress = () => boostButton.classList.remove('pressed');
  boostButton.addEventListener('pointerup', unpress);
  boostButton.addEventListener('pointercancel', unpress);
  boostButton.addEventListener('pointerleave', unpress);

  // Ability button + swap button (same no-steer handling as boost).
  const tapButton = (btn, fn) => {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      fn();
      btn.classList.add('pressed');
    });
    const up = () => btn.classList.remove('pressed');
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
  };
  tapButton(abilityButton, () => { abilityQueued = true; });
  tapButton(cycleButton, () => { cycleQueued = true; });

  const STEER_KEYS = ['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'KeyS', 'ArrowDown'];
  window.addEventListener('keydown', (e) => {
    if (STEER_KEYS.includes(e.code)) {
      keys.add(e.code);
      e.preventDefault();
    } else if (e.code === 'Space') {
      if (!e.repeat) boostQueued = true;
      e.preventDefault();
    } else if (e.code === 'KeyE' && !e.repeat) {
      abilityQueued = true;
    } else if (e.code === 'KeyQ' && !e.repeat) {
      cycleQueued = true;
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => {
    keys.clear();
    touches.clear();
  });

  // Block iOS pinch / double-tap zoom and long-press menus.
  for (const ev of ['gesturestart', 'gesturechange', 'dblclick', 'contextmenu']) {
    document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  }
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

  return {
    // -1 left, +1 right, 0 straight (none or both held).
    steer() {
      let left = keys.has('KeyA') || keys.has('ArrowLeft');
      let right = keys.has('KeyD') || keys.has('ArrowRight');
      for (const side of touches.values()) {
        if (side < 0) left = true;
        else right = true;
      }
      return (right ? 1 : 0) - (left ? 1 : 0);
    },
    // Both sides held (touch or keys), or S / Down: brake, then reverse.
    brake() {
      if (keys.has('KeyS') || keys.has('ArrowDown')) return true;
      let left = keys.has('KeyA') || keys.has('ArrowLeft');
      let right = keys.has('KeyD') || keys.has('ArrowRight');
      for (const side of touches.values()) {
        if (side < 0) left = true;
        else right = true;
      }
      return left && right;
    },
    consumeBoost() {
      const b = boostQueued;
      boostQueued = false;
      return b;
    },
    consumeAbility() {
      const a = abilityQueued;
      abilityQueued = false;
      return a;
    },
    consumeCycle() {
      const c = cycleQueued;
      cycleQueued = false;
      return c;
    },
    reset() {
      boostQueued = false;
      abilityQueued = false;
      cycleQueued = false;
    },
  };
}
