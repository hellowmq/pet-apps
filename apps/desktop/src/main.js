import { createPetRuntime, createPointerGesture } from '@pet-apps/core';
import { createPetById, runtimeOptionsFor } from './pets.js';

const container = document.querySelector('#app');
const api = window.desktopPet;

/** @type {ReturnType<typeof createPetRuntime> | null} */
let runtime = null;
/** @type {'tuanzi' | 'maodie'} */
let currentId = 'tuanzi';

const gesture = createPointerGesture({
  target: window,
  hitTest: (event) => runtime?.hitTestAtEvent(event) ?? false,
  // Window-local coordinates change as the window moves; screen coordinates do not.
  getPoint: (event) => ({ x: event.screenX, y: event.screenY }),
  onPress() {
    document.body.dataset.gesture = 'pressed';
    api?.setIgnoreMouse?.(false);
  },
  onDragStart(event) {
    document.body.dataset.gesture = 'dragging';
    api?.dragStart?.(event.screenX, event.screenY);
  },
  onDragMove: (event) => api?.dragMove?.(event.screenX, event.screenY),
  onTap: () => runtime?.pet.pet(),
  onEnd({ event, cancelled, dragged }) {
    delete document.body.dataset.gesture;
    if (dragged) api?.dragEnd?.();
    if (cancelled) runtime?.resetHover();
    const hovering = !cancelled && event && runtime?.hitTestAtEvent(event);
    api?.setIgnoreMouse?.(!hovering);
  },
});

function mountPet(id) {
  gesture.cancel();
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
      if (gesture.isActive()) return;
      api?.setIgnoreMouse?.(!hovering);
    },
  });
  api?.setIgnoreMouse?.(true);
}

function onContextMenu(e) {
  e.preventDefault();
  if (!runtime) return;
  if (!runtime.hitTestAtEvent(e)) return;
  gesture.cancel();
  api?.openContextMenu?.();
}

window.addEventListener('contextmenu', onContextMenu);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) gesture.cancel();
});
window.addEventListener('pagehide', () => {
  gesture.dispose();
  runtime?.dispose();
});

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
  // Reset the cached hover so the next move over the same pet re-enables input.
  runtime?.resetHover();
  api?.setIgnoreMouse?.(true);
});
