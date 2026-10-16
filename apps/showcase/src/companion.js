import { createPetRuntime, createPointerGesture } from '@pet-apps/core';
import { createTuanziPet } from '../../tuanzi/src/tuanziPet.js';
import { createMaodiePet } from '../../maodie/src/maodiePet.js';
import tuanziStill from '../../../docs/media/tuanzi-canvas.png?url';
import maodieStill from '../../../docs/media/maodie-canvas.png?url';
import './companion.css';

const query = new URLSearchParams(location.search);
const fragment = new URLSearchParams(location.hash.slice(1));
const channel = fragment.get('channel');
const parentOrigin = fragment.get('parent');
const en = query.get('lang') === 'en';
const maodie = query.get('pet') !== 'tuanzi';
document.documentElement.lang = en ? 'en' : 'zh-CN';
const container = document.querySelector('#canvas');
const still = document.querySelector('#still');
still.src = maodie ? maodieStill : tuanziStill;
still.alt = en ? 'Pet preview' : '宠物静态预览';
const status = document.querySelector('#status');
const fallback = document.querySelector('#fallback');
const start = document.querySelector('#start');
start.textContent = en ? 'Start' : '开启互动';
const buttons = [...document.querySelectorAll('[data-action]')];
const labels = en ? { pet: 'Pet', feed: 'Feed', jump: 'Jump' } : { pet: '摸摸头', feed: '喂点心', jump: '跳一下' };
buttons.forEach(button => { button.textContent = labels[button.dataset.action]; });
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let runtime = null, loss = null, manuallyStarted = false, forwardedPress = false, buttonPress = null;
let pendingPet = null, mountVersion = 0;
const send = data => {
  if (channel && parentOrigin && parent !== window) parent.postMessage({ ...data, channel }, parentOrigin);
};
const gesture = createPointerGesture({
  target: container,
  hitTest: event => runtime?.hitTestAtEvent(event) ?? false,
  getPoint: event => ({ x: event.screenX, y: event.screenY }),
  threshold: 8,
  onTap: () => action('pet'),
  onPress: event => send({ type: 'hover', active: event.isTrusted }),
  onDragStart: event => send({ type: 'drag-start', x: event.screenX, y: event.screenY }),
  onDragMove: event => send({ type: 'drag-move', x: event.screenX, y: event.screenY }),
  onEnd: () => send({ type: 'drag-end' }),
});
function action(id) {
  if (!runtime) return;
  runtime.pet[id]?.();
  status.textContent = en ? `Trying: ${labels[id]}. Watch for a response.` : `试着${labels[id]}，看看它的回应。`;
}
buttons.forEach(button => button.addEventListener('click', () => action(button.dataset.action)));
function stop() {
  mountVersion++;
  pendingPet?.dispose(); pendingPet = null;
  gesture.cancel();
  if (runtime && loss) runtime.canvas.removeEventListener('webglcontextlost', loss);
  runtime?.dispose(); runtime = null; loss = null;
  buttons.forEach(button => { button.disabled = true; });
}
function preview(text) {
  stop(); still.hidden = false; fallback.hidden = false;
  document.querySelector('#fallback-text').textContent = text;
  status.textContent = '';
}
async function run() {
  if (runtime || pendingPet) return;
  const version = ++mountVersion;
  try {
    const pet = maodie ? createMaodiePet() : createTuanziPet();
    pendingPet = pet;
    still.hidden = false;
    fallback.hidden = true;
    buttons.forEach(button => { button.disabled = true; });
    status.textContent = en ? 'Loading…' : '加载中…';
    await pet.ready;
    if (version !== mountVersion) return;
    runtime = createPetRuntime({ container, pet,
      boundX: maodie ? 2.2 : 1.2, transparent: true, petOnPointerDown: false,
      pointerTarget: container, cursorTarget: container });
    pendingPet = null;
    loss = event => { event.preventDefault(); preview(en ? 'Interaction unavailable. Try again.' : '互动暂时不可用，可以重试。'); };
    runtime.canvas.addEventListener('webglcontextlost', loss);
    still.hidden = true; fallback.hidden = true;
    buttons.forEach(button => { button.disabled = false; });
    status.textContent = en ? 'Tap to interact · Drag to move' : '轻点互动 · 按住移动';
  } catch {
    if (version !== mountVersion) return;
    preview(en ? 'Interaction unavailable. Try again.' : '互动暂时不可用，可以重试。');
  }
}
function refresh() {
  if (motion.matches && !manuallyStarted) preview(en ? 'Motion is reduced. Start when ready.' : '已减少动态效果，需要时开启互动。');
  else run();
}
start.addEventListener('click', () => { manuallyStarted = true; run(); });
motion.addEventListener('change', () => { manuallyStarted = false; refresh(); });
function receive(event) {
  if (event.source !== parent || event.origin !== parentOrigin || event.data?.channel !== channel) return;
  const data = event.data;
  if (data.type === 'cancel') { forwardedPress = false; buttonPress = null; gesture.cancel(); runtime?.resetHover(); return; }
  if (data.type !== 'pointer' || !['pointermove', 'pointerdown', 'pointerup', 'pointercancel'].includes(data.event)
    || !Number.isFinite(data.x) || !Number.isFinite(data.y)) return;
  const pointer = new PointerEvent(data.event, { bubbles: true, clientX: data.x, clientY: data.y,
    screenX: data.screenX, screenY: data.screenY, pointerId: data.pointerId,
    pointerType: data.pointerType, isPrimary: data.isPrimary, button: data.button, buttons: data.buttons });
  const button = [...buttons, start].find(element => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && data.x >= rect.left && data.x <= rect.right && data.y >= rect.top && data.y <= rect.bottom;
  });
  if (data.event === 'pointerdown' && data.button === 0) {
    forwardedPress = !!button || !!runtime?.hitTestAtEvent(pointer);
    if (button) buttonPress = { button, x: data.x, y: data.y, id: data.pointerId };
  }
  if (data.event === 'pointermove') container.dispatchEvent(pointer);
  const active = gesture.isActive() || !!button || !!runtime?.hitTestAtEvent(pointer);
  send({ type: 'hover', active: active && !forwardedPress });
  if (data.event !== 'pointermove') container.dispatchEvent(pointer);
  if (data.event === 'pointerup' || data.event === 'pointercancel') {
    if (data.event === 'pointerup' && data.button === 0 && buttonPress?.id === data.pointerId && button === buttonPress.button
      && Math.hypot(data.x - buttonPress.x, data.y - buttonPress.y) < 8) button.click();
    forwardedPress = false; buttonPress = null;
    send({ type: 'hover', active });
  }
}
window.addEventListener('message', receive);
// Capture first so Escape can distinguish cancelling a drag from closing a pet.
window.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (gesture.isActive()) gesture.cancel(); else send({ type: 'close' });
}, true);
document.addEventListener('visibilitychange', () => { if (document.hidden) gesture.cancel(); });
window.addEventListener('pagehide', () => { stop(); gesture.dispose(); window.removeEventListener('message', receive); });
refresh();
send({ type: 'ready' });
