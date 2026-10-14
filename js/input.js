// Steering from touch halves / keyboard, plus boost button and Space.

export function createInput(canvas, boostButton) {
  const touches = new Map(); // pointerId -> -1 | 1
  const keys = new Set();
  let boostQueued = false;

  const sideOf = (e) => (e.clientX < window.innerWidth / 2 ? -1 : 1);

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    touches.set(e.pointerId, sideOf(e));
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (touches.has(e.pointerId)) touches.set(e.pointerId, sideOf(e));
  });
  const release = (e) => touches.delete(e.pointerId);
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

  const STEER_KEYS = ['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight'];
  window.addEventListener('keydown', (e) => {
    if (STEER_KEYS.includes(e.code)) {
      keys.add(e.code);
      e.preventDefault();
    } else if (e.code === 'Space') {
      if (!e.repeat) boostQueued = true;
      e.preventDefault();
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
    consumeBoost() {
      const b = boostQueued;
      boostQueued = false;
      return b;
    },
    reset() {
      boostQueued = false;
    },
  };
}
