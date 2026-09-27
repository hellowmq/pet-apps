import { createPetRuntime } from '@pet-apps/core';
import { createTuanziPet } from '../../tuanzi/src/tuanziPet.js';
import { createMaodiePet } from '../../maodie/src/maodiePet.js';
import tuanziStill from '../../../docs/media/tuanzi-canvas.png?url';
import maodieStill from '../../../docs/media/maodie-canvas.png?url';
import './style.css';

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
    acted: {
      pet: (pet) => `摸了摸${pet}的头。`,
      feed: (pet) => `给${pet}喂了点心。`,
      jump: (pet) => `${pet}跳起来了。`,
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
    acted: {
      pet: (pet) => `Petted ${pet}.`,
      feed: (pet) => `Fed ${pet} a snack.`,
      jump: (pet) => `${pet} jumped.`,
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
let contextLostHandler = null;
let manuallyStarted = false;

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
  if (runtime?.canvas && contextLostHandler) {
    runtime.canvas.removeEventListener('webglcontextlost', contextLostHandler);
  }
  runtime?.dispose();
  runtime = null;
  contextLostHandler = null;
  canvasHost.replaceChildren();
}

function startRuntime() {
  if (runtime) return;
  try {
    runtime = createPetRuntime({
      container: canvasHost,
      pet: PETS[selectedId].create(),
      boundX: PETS[selectedId].boundX,
      background: embedMode ? '#1a241e' : '#fdf6ec',
      pointerTarget: canvasHost,
      cursorTarget: canvasHost,
      cameraDistanceScale: PETS[selectedId].cameraDistanceScale,
    });
    contextLostHandler = (event) => {
      event.preventDefault();
      showStill(copy.unavailable);
    };
    runtime.canvas.addEventListener('webglcontextlost', contextLostHandler);
    actionButtons.forEach((button) => { button.disabled = false; });
    still.hidden = true;
    message.hidden = true;
    status.textContent = copy.playing(copy.pets[selectedId].name);
  } catch (error) {
    console.warn('PetApp demo could not start:', error);
    showStill(copy.unavailable);
  }
}

function selectPet(id) {
  if (!PETS[id]) return;
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
  document.querySelectorAll('[data-pet]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.pet === id));
  });
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
    const action = button.dataset.action;
    runtime.pet[action]?.();
    status.textContent = copy.acted[action](copy.pets[selectedId].name);
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

window.addEventListener('pagehide', stopRuntime);
window.addEventListener('pageshow', (event) => {
  if (event.persisted) selectPet(selectedId);
});
window.addEventListener('storage', (event) => {
  if (embedMode && event.key === 'daftken.language') window.location.reload();
});
applyPageCopy();
selectPet(selectedId);
