import { createPetRuntime } from '@pet-apps/core';
import { createPetById, runtimeOptionsFor } from './pets.js';

const container = document.querySelector('#app');
const api = window.desktopPet;
const DRAG_THRESHOLD = 5;

/** @type {ReturnType<typeof createPetRuntime> | null} */
let runtime = null;
/** @type {'tuanzi' | 'maodie'} */
let currentId = 'tuanzi';

/** @type {{ x: number, y: number, screenX: number, screenY: number } | null} */
let press = null;
let dragging = false;

function mountPet(id) {
  runtime?.dispose();
  currentId = id;
  const pet = createPetById(id);
  const opts = runtimeOptionsFor(id);
  api?.setWindowSize?.(id);
  runtime = createPetRuntime({
    container,
    pet,
    ui: null,
    transparent: true,
    background: null,
    boundX: opts.boundX,
    petOnPointerDown: false,
    onHoverChange(hovering) {
      if (dragging) return;
      api?.setIgnoreMouse?.(!hovering);
    },
  });
  api?.setIgnoreMouse?.(true);
}

function onPointerDown(e) {
  if (e.button !== 0 || !runtime) return;
  if (!runtime.hitTestAtEvent(e)) return;
  press = {
    x: e.clientX,
    y: e.clientY,
    screenX: e.screenX,
    screenY: e.screenY,
  };
  dragging = false;
  api?.setIgnoreMouse?.(false);
}

function onPointerMove(e) {
  if (!press || !runtime) return;
  const dx = e.clientX - press.x;
  const dy = e.clientY - press.y;
  if (!dragging && Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
    dragging = true;
    api?.dragStart?.(press.screenX, press.screenY);
  }
  if (dragging) {
    api?.dragMove?.(e.screenX, e.screenY);
  }
}

function onPointerUp(e) {
  if (!press || !runtime) return;
  if (dragging) {
    api?.dragEnd?.();
  } else if (e.button === 0 && runtime.hitTestAtEvent(e)) {
    runtime.pet.pet();
  }
  press = null;
  dragging = false;
}

function onContextMenu(e) {
  e.preventDefault();
  if (!runtime) return;
  if (!runtime.hitTestAtEvent(e)) return;
  api?.openContextMenu?.();
}

window.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerUp);
window.addEventListener('contextmenu', onContextMenu);

mountPet(api?.getPet?.() || 'tuanzi');

api?.onSwitchPet?.((id) => {
  if (id === currentId) return;
  mountPet(id);
});

api?.onAction?.((action) => {
  if (!runtime?.pet) return;
  if (action === 'pet') runtime.pet.pet();
  else if (action === 'feed') runtime.pet.feed();
  else if (action === 'jump') runtime.pet.jump();
});

api?.onMenuClosed?.(() => {
  // Re-evaluate hover on next move; default to passthrough
  api?.setIgnoreMouse?.(true);
});
