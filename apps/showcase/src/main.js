import { createPetRuntime, createPointerGesture } from '@pet-apps/core';
import { createTuanziPet } from '../../tuanzi/src/tuanziPet.js';
import { createMaodiePet } from '../../maodie/src/maodiePet.js';
import tuanziStill from '../../../docs/media/tuanzi-canvas.png?url';
import maodieStill from '../../../docs/media/maodie-canvas.png?url';
import './style.css';
import { mountPetTakeaway } from './petTakeaway.js';

const PETS = {
  tuanzi: {
    still: tuanziStill, create: createTuanziPet,
    boundX: 1.25, cameraDistanceScale: 0.62,
  },
  maodie: {
    still: maodieStill, create: createMaodiePet,
    boundX: 1.55, cameraDistanceScale: 0.62,
  },
};

const MESSAGES = {
  'zh-CN': {
    title: 'PetApp · 互动桌宠展示',
    description: '认识团子和圆头耄耋，摸摸头、喂食，一起跳起来。',
    heading: ['桌面上的小伙伴，', '先在这里认识一下。'],
    lead: '摸摸头、喂点心，看团子和圆头耄耋怎么回应你。',
    demoLabel: '桌宠互动展示',
    petSwitchLabel: '选择宠物',
    actionsLabel: '与宠物互动',
    pets: {
      tuanzi: { name: '团子', secondary: 'Tuanzi', button: '🍡 团子' },
      maodie: { name: '圆头耄耋', secondary: 'Maodie', button: '🐱 圆头耄耋' },
    },
    actions: { pet: '摸摸头', feed: '喂点心', jump: '跳一下' },
    loading: '加载中…',
    preview: (pet) => `${pet}的静态预览`,
    playing: (pet) => `正在和${pet}玩。点它也可以摸摸头。`,
    hints: { tuanzi: '点一下摸头，也可以用下方按钮互动。', maodie: '点它会哈气；忙碌时可能忽略新的互动。' },
    requested: {
      pet: (pet) => `试着和${pet}打个招呼。`,
      feed: (pet) => `给${pet}送上点心，看看它的回应。`,
      jump: (pet) => `邀请${pet}跳一下，看看它的回应。`,
    },
    reducedMotion: '已按你的系统设置减少动态效果。需要时可以主动开启互动。',
    unavailable: '互动暂时不可用，先看看静态预览。',
    start: '开启互动',
    footer: '喜欢它们？把桌宠带到你的电脑上。',
    repo: '查看 PetApp 源码',
  },
  en: {
    title: 'PetApp · Interactive Desktop Pets',
    description: 'Meet Tuanzi and Roundhead Maodie. Pet, feed, and jump with them in your browser.',
    heading: ['Say hello to', 'a little desktop companion.'],
    lead: 'Pet them, offer a snack, and see how Tuanzi and Roundhead Maodie respond.',
    demoLabel: 'Interactive desktop pet demo',
    petSwitchLabel: 'Choose a pet',
    actionsLabel: 'Interact with your pet',
    pets: {
      tuanzi: { name: 'Tuanzi', secondary: '', button: '🍡 Tuanzi' },
      maodie: { name: 'Roundhead Maodie', secondary: '', button: '🐱 Maodie' },
    },
    actions: { pet: 'Pet', feed: 'Feed', jump: 'Jump' },
    loading: 'Loading…',
    preview: (pet) => `Still preview of ${pet}`,
    playing: (pet) => `Playing with ${pet}. Tap or click the pet to say hello.`,
    hints: { tuanzi: 'Tap to pet, or try the buttons below.', maodie: 'Tap for a hiss. New interactions may be ignored while busy.' },
    requested: {
      pet: (pet) => `Saying hello to ${pet}.`,
      feed: (pet) => `Offering ${pet} a snack. Watch for a response.`,
      jump: (pet) => `Inviting ${pet} to jump. Watch for a response.`,
    },
    reducedMotion: 'Motion is reduced to match your system setting. Start the demo when you are ready.',
    unavailable: 'The interactive demo is unavailable. You can still see the preview.',
    start: 'Start interactive demo',
    footer: 'Like them? Bring a desktop pet to your computer.',
    repo: 'View PetApp source',
  },
};

const searchParams = new URLSearchParams(window.location.search);
const embedMode = searchParams.get('embed') === 'maodie';
document.documentElement.classList.toggle('embed', embedMode);

function readLocale() {
  try {
    return localStorage.getItem('daftken.language') === 'en' ? 'en' : 'zh-CN';
  } catch {
    return 'zh-CN';
  }
}

const locale = readLocale();
const copy = MESSAGES[locale];

const canvasHost = document.querySelector('#pet-canvas');
const still = document.querySelector('#stage-still');
const name = document.querySelector('#pet-name');
const status = document.querySelector('#status');
const message = document.querySelector('#stage-message');
const messageText = document.querySelector('#stage-message-text');
const startButton = document.querySelector('#start-demo');
const actionButtons = document.querySelectorAll('[data-action]');
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const petSwitch = document.querySelector('.pet-switch');
const switchIndicator = document.querySelector('.switch-indicator');

function applyPageCopy() {
  document.documentElement.lang = locale;
  document.title = copy.title;
  document.querySelector('meta[name="description"]').content = copy.description;
  const heading = document.querySelector('.intro h1');
  heading.replaceChildren(document.createTextNode(copy.heading[0]), document.createElement('br'), document.createTextNode(copy.heading[1]));
  document.querySelector('.lead').textContent = copy.lead;
  document.querySelector('.demo').setAttribute('aria-label', copy.demoLabel);
  document.querySelector('.pet-switch').setAttribute('aria-label', copy.petSwitchLabel);
  document.querySelector('.actions').setAttribute('aria-label', copy.actionsLabel);
  document.querySelectorAll('[data-pet]').forEach((button) => {
    button.textContent = copy.pets[button.dataset.pet].button;
  });
  actionButtons.forEach((button) => {
    button.textContent = copy.actions[button.dataset.action];
  });
  startButton.textContent = copy.start;
  document.querySelector('.site-footer span').textContent = copy.footer;
  document.querySelector('.site-footer a').firstChild.textContent = `${copy.repo} `;
  status.textContent = copy.loading;
}

let selectedId = embedMode ? 'maodie' : 'tuanzi';
let runtime = null;
let pendingPet = null;
let mountVersion = 0;
let contextLostHandler = null;
let manuallyStarted = false;
const gesture = createPointerGesture({
  target: canvasHost,
  hitTest: (event) => runtime?.hitTestAtEvent(event) ?? false,
  threshold: 8,
  onTap: () => requestAction('pet'),
});
if (embedMode) mountPetTakeaway({ canvasHost, still, gesture, locale,
  name: copy.pets.maodie.name, status, hitTest: event => runtime?.hitTestAtEvent(event) ?? false,
  getDragPreview: point => runtime?.captureDragImage(point) });

function moveIndicator() {
  const selected = petSwitch.querySelector('[aria-pressed="true"]');
  switchIndicator.style.width = `${selected.offsetWidth}px`;
  switchIndicator.style.transform = `translateX(${selected.offsetLeft}px)`;
}
const switchResize = new ResizeObserver(moveIndicator);
switchResize.observe(petSwitch);

function requestAction(action) {
  if (!runtime) return;
  runtime.pet[action]?.();
  // A pet can ignore a request while busy. Feedback describes input, not success.
  status.replaceChildren(document.createTextNode(copy.requested[action](copy.pets[selectedId].name)));
  if (motionPreference.matches) return;
  const button = document.querySelector(`[data-action="${action}"]`);
  button.getAnimations().forEach((animation) => animation.cancel());
  button.animate([
    { transform: 'scale(.96)' }, { transform: 'scale(1)' },
  ], { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' });
  status.getAnimations().forEach((animation) => animation.cancel());
  status.animate([{ opacity: .55 }, { opacity: 1 }], { duration: 180 });
}

function showStill(text, canStart = false) {
  stopRuntime();
  actionButtons.forEach((button) => { button.disabled = true; });
  still.hidden = false;
  message.hidden = !text;
  messageText.textContent = text || '';
  startButton.hidden = !canStart;
  status.textContent = text || copy.preview(copy.pets[selectedId].name);
}

function stopRuntime() {
  mountVersion++;
  pendingPet?.dispose();
  pendingPet = null;
  gesture.cancel();
  status.getAnimations().forEach((animation) => animation.cancel());
  actionButtons.forEach((button) => button.getAnimations().forEach((animation) => animation.cancel()));
  if (runtime?.canvas && contextLostHandler) {
    runtime.canvas.removeEventListener('webglcontextlost', contextLostHandler);
  }
  runtime?.dispose();
  runtime = null;
  contextLostHandler = null;
  canvasHost.replaceChildren();
}

async function startRuntime() {
  if (runtime || pendingPet) return;
  const version = ++mountVersion;
  try {
    const pet = PETS[selectedId].create();
    pendingPet = pet;
    actionButtons.forEach(button => { button.disabled = true; });
    still.hidden = false;
    message.hidden = true;
    startButton.hidden = true;
    status.textContent = copy.loading;
    await pet.ready;
    if (version !== mountVersion) return;
    runtime = createPetRuntime({
      container: canvasHost,
      pet,
      boundX: PETS[selectedId].boundX,
      background: embedMode ? '#1a241e' : '#fdf6ec',
      pointerTarget: canvasHost,
      cursorTarget: canvasHost,
      petOnPointerDown: false,
      cameraDistanceScale: PETS[selectedId].cameraDistanceScale,
    });
    pendingPet = null;
    contextLostHandler = (event) => {
      event.preventDefault();
      showStill(copy.unavailable);
    };
    runtime.canvas.addEventListener('webglcontextlost', contextLostHandler);
    actionButtons.forEach((button) => { button.disabled = false; });
    still.hidden = true;
    message.hidden = true;
    status.textContent = selectedId === 'maodie' ? copy.hints.maodie : copy.playing(copy.pets[selectedId].name);
  } catch (error) {
    if (version !== mountVersion) return;
    console.warn('PetApp demo could not start:', error);
    showStill(copy.unavailable, true);
  }
}

function selectPet(id, force = false) {
  if (!PETS[id]) return;
  if (!force && id === selectedId) return;
  stopRuntime();
  selectedId = id;
  const pet = PETS[id];
  const petCopy = copy.pets[id];
  name.replaceChildren(document.createTextNode(petCopy.name));
  if (petCopy.secondary) {
    const secondary = document.createElement('span');
    secondary.textContent = ` ${petCopy.secondary}`;
    name.append(secondary);
  }
  still.src = pet.still;
  still.alt = copy.preview(petCopy.name);
  document.querySelector('#pet-hint').textContent = copy.hints[id];
  document.querySelectorAll('[data-pet]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.pet === id));
  });
  moveIndicator();
  if (motionPreference.matches && !manuallyStarted) {
    showStill(copy.reducedMotion, true);
  } else {
    startRuntime();
  }
}

document.querySelectorAll('[data-pet]').forEach((button) => {
  button.addEventListener('click', () => selectPet(button.dataset.pet));
});

actionButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (!runtime) {
      if (motionPreference.matches && !manuallyStarted) {
        showStill(copy.reducedMotion, true);
      }
      return;
    }
    requestAction(button.dataset.action);
  });
});

startButton.addEventListener('click', () => {
  manuallyStarted = true;
  startRuntime();
});

motionPreference.addEventListener('change', () => {
  if (motionPreference.matches) {
    manuallyStarted = false;
    showStill(copy.reducedMotion, true);
  } else {
    startRuntime();
  }
});

window.addEventListener('pagehide', () => {
  stopRuntime();
  switchResize.disconnect();
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    switchResize.observe(petSwitch);
    selectPet(selectedId, true);
  }
});
window.addEventListener('storage', (event) => {
  if (embedMode && event.key === 'daftken.language') window.location.reload();
});
applyPageCopy();
selectPet(selectedId, true);
