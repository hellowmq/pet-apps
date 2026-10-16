import { createPetRuntime, createPointerGesture } from '@pet-apps/core';
import { createMaodiePet } from '../../maodie/src/maodiePet.js';
import { createTuanziPet } from '../../tuanzi/src/tuanziPet.js';
import assetUrls from 'virtual:petapp-portable-frames';

export function install({ pet = 'maodie', locale = 'zh-CN' } = {}) {
  const en = locale === 'en';
  const hosts = document.querySelectorAll('[data-petapp-companion]');
  if (hosts.length >= 4) {
    alert(en ? 'Four pets are already here. Close one before adding another.' : '这里已经有四只宠物了，先关掉一只再添加吧。');
    return;
  }
  const host = document.createElement('div');
  host.dataset.petappCompanion = 'portable-v2'; host.dataset.state = 'loading';
  const set = (key, value) => host.style.setProperty(key, value, 'important');
  for (const [key, value] of Object.entries({ all: 'initial', position: 'fixed', 'z-index': '2147483647', width: '260px', height: '300px', 'pointer-events': 'none' })) set(key, value);
  let x = Math.max(0, innerWidth - 280 - hosts.length * 24);
  let y = Math.max(0, innerHeight - 320 - hosts.length * 24);
  function position() {
    x = Math.max(0, Math.min(x, Math.max(0, innerWidth - 260)));
    y = Math.max(0, Math.min(y, Math.max(0, innerHeight - 300)));
    set('left', x + 'px'); set('top', y + 'px');
  }
  position();
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = ':host{color-scheme:light}*{box-sizing:border-box}header{position:absolute;top:0;right:8px;display:flex;gap:4px;pointer-events:auto}button{font:11px system-ui;color:#5b4a3a;background:#fffaf2;border:1px solid #dfcbb5;border-radius:999px;min-height:32px;padding:6px 10px;cursor:pointer}header button{font-size:13px;min-width:36px}button:disabled{opacity:.5;cursor:default}button:focus-visible{outline:3px solid #db8b58;outline-offset:2px}.move{cursor:grab;touch-action:none}.stage{position:absolute;top:34px;left:0;width:260px;height:208px;touch-action:none}.actions{position:absolute;top:242px;left:0;width:260px;display:flex;justify-content:center;gap:6px;pointer-events:auto}.status{position:absolute;top:274px;left:12px;right:12px;font:10px/1.3 system-ui;color:#5b4a3a;text-align:center;background:rgba(255,250,242,.9);border-radius:6px}.notice{position:absolute;top:72px;left:14px;right:14px;font:12px/1.6 system-ui;color:#5b4a3a;background:#fffaf2;border:1px solid #dfcbb5;border-radius:14px;padding:14px;pointer-events:auto}.notice[hidden]{display:none}';
  const header = document.createElement('header'); header.style.pointerEvents = 'auto';
  const move = document.createElement('button');
  move.className = 'move'; move.textContent = '⠿'; move.setAttribute('aria-label', en ? 'Move pet. Arrow keys also work.' : '移动宠物，也可用方向键');
  const close = document.createElement('button');
  close.textContent = '×'; close.setAttribute('aria-label', en ? 'Close pet' : '关闭宠物');
  header.append(move, close);
  const stage = document.createElement('div'); stage.className = 'stage';
  const actions = document.createElement('div'); actions.className = 'actions';
  const status = document.createElement('div'); status.className = 'status'; status.setAttribute('role', 'status');
  const notice = document.createElement('div'); notice.className = 'notice'; notice.setAttribute('role', 'status');
  // Keep a readable, dismissible error even when a host rejects our stylesheet.
  for (const [key, value] of Object.entries({ position: 'absolute', top: '72px', left: '14px', right: '14px', color: '#5b4a3a', background: '#fffaf2', padding: '14px', 'border-radius': '14px', 'pointer-events': 'auto', font: '12px/1.6 system-ui' })) notice.style.setProperty(key, value);
  root.append(style, stage, header, actions, status, notice);
  (document.body || document.documentElement).append(host);

  let disposed = false, runtime = null, pendingPet = null, version = 0, deadline = 0;
  let drag = null, grip = null;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const labels = en ? { pet: 'Pet', feed: 'Feed', jump: 'Jump' } : { pet: '摸摸头', feed: '喂点心', jump: '跳一下' };
  const buttons = [];
  for (const [id, label] of Object.entries(labels)) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.disabled = true;
    button.dataset.action = id; button.addEventListener('click', () => action(id));
    buttons.push(button); actions.append(button);
  }
  const gesture = createPointerGesture({
    target: stage, hitTest: event => runtime?.hitTestAtEvent(event) ?? false,
    getPoint: event => ({ x: event.screenX, y: event.screenY }),
    onTap: () => action('pet'),
    onDragStart: event => { drag = { x, y, px: event.screenX, py: event.screenY }; },
    onDragMove: event => {
      if (!drag) return;
      x = drag.x + event.screenX - drag.px; y = drag.y + event.screenY - drag.py; position();
    },
    onEnd: () => { drag = null; runtime?.resetHover(); stage.style.pointerEvents = coarse ? 'auto' : 'none'; },
  });
  function action(id) {
    if (!runtime || disposed) return;
    runtime.pet[id]?.();
    status.textContent = en ? `Trying: ${labels[id]}. Watch for a response.` : `试着${labels[id]}，看看它的回应。`;
  }
  function cancel() {
    gesture.cancel(); drag = null;
    if (grip && move.hasPointerCapture(grip.id)) move.releasePointerCapture(grip.id);
    grip = null; runtime?.resetHover(); stage.style.pointerEvents = coarse ? 'auto' : 'none';
  }
  function stop() {
    version++; clearTimeout(deadline); cancel();
    pendingPet?.dispose(); pendingPet = null;
    runtime?.dispose(); runtime = null;
    stage.replaceChildren(); buttons.forEach(button => { button.disabled = true; });
  }
  function fallback(text, state = 'error') {
    stop(); host.dataset.state = state;
    notice.hidden = false; notice.replaceChildren(document.createTextNode(text), document.createElement('br'));
    const retry = document.createElement('button'); retry.type = 'button';
    retry.textContent = state === 'paused' ? (en ? 'Start' : '开启互动') : (en ? 'Retry' : '重新加载');
    retry.addEventListener('click', run); notice.append(retry); status.textContent = '';
    if (state === 'paused' && pet === 'maodie') {
      const still = document.createElement('img'); still.src = assetUrls['maodie/calm.png'];
      still.alt = en ? 'Pet preview' : '宠物静态预览';
      Object.assign(still.style, { width: '100%', height: '100%', objectFit: 'contain' }); stage.append(still);
    }
  }
  async function run() {
    if (disposed) return;
    stop(); const attempt = version;
    if (!stage.clientWidth || !stage.clientHeight) { fallback(en ? 'This page blocks the pet display styles.' : '此页面的安全策略禁止了桌宠显示样式。'); return; }
    host.dataset.state = 'loading'; notice.hidden = false;
    notice.textContent = en ? 'Loading the saved pet…' : '正在加载已保存的宠物…';
    deadline = setTimeout(() => { if (!disposed && version === attempt) fallback(en ? 'The pet could not start on this page.' : '宠物未能在此页面启动，请重试。'); }, 10000);
    try {
      const loadingPet = pet === 'tuanzi' ? createTuanziPet() : createMaodiePet({ assetUrls });
      pendingPet = loadingPet;
      await loadingPet.ready;
      if (disposed || version !== attempt) return;
      pendingPet = null;
      try {
        runtime = createPetRuntime({ container: stage, pet: loadingPet, boundX: pet === 'tuanzi' ? 1.2 : 2.2, transparent: true,
          petOnPointerDown: false, pointerTarget: document, cursorTarget: stage,
          onHoverChange: active => { stage.style.pointerEvents = coarse || active || !!drag ? 'auto' : 'none'; } });
      } catch (error) { loadingPet.dispose(); throw error; }
      runtime.canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); if (!disposed) fallback(en ? 'Graphics unavailable. Try again.' : '图形渲染暂时不可用，可以重试。'); });
      clearTimeout(deadline); notice.hidden = true; host.dataset.state = 'ready';
      buttons.forEach(button => { button.disabled = false; });
      status.textContent = en ? 'Tap to interact · Drag to move' : '轻点互动 · 按住移动';
    } catch {
      if (!disposed && version === attempt) fallback(en ? 'This page could not display the saved pet.' : '此页面未能显示已保存的宠物，可以重试。');
    }
  }
  function policy(event) {
    if (host.dataset.state === 'loading' && event.disposition === 'enforce' && event.effectiveDirective === 'img-src' && event.blockedURI.startsWith('data')) {
      fallback(en ? 'This page blocks embedded pet images.' : '此页面的安全策略禁止显示内嵌宠物图片。');
    }
  }
  function remove() {
    if (disposed) return;
    disposed = true; stop(); gesture.dispose(); observer.disconnect();
    document.removeEventListener('securitypolicyviolation', policy);
    window.removeEventListener('resize', position); window.removeEventListener('pagehide', remove); window.removeEventListener('blur', cancel);
    host.remove();
  }
  const observer = new MutationObserver(() => { if (!host.isConnected) remove(); });
  observer.observe(document.documentElement, { childList: true });
  if (document.body) observer.observe(document.body, { childList: true });
  close.addEventListener('click', remove);
  move.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary) return;
    grip = { id: event.pointerId, px: event.clientX, py: event.clientY, x, y }; move.setPointerCapture(event.pointerId);
  });
  move.addEventListener('pointermove', event => {
    if (!grip || grip.id !== event.pointerId) return;
    x = grip.x + event.clientX - grip.px; y = grip.y + event.clientY - grip.py; position();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) move.addEventListener(type, () => { grip = null; });
  move.addEventListener('keydown', event => {
    const delta = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] }[event.key];
    if (delta) { event.preventDefault(); x += delta[0]; y += delta[1]; position(); }
    if (event.key === 'Escape') cancel();
  });
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && event.target !== move) { if (drag || grip) cancel(); else remove(); }
  });
  document.addEventListener('securitypolicyviolation', policy);
  window.addEventListener('resize', position); window.addEventListener('pagehide', remove); window.addEventListener('blur', cancel);
  if (!stage.clientWidth || !stage.clientHeight) fallback(en ? 'This page blocks the pet display styles.' : '此页面的安全策略禁止了桌宠显示样式。');
  else if (motion.matches) fallback(en ? 'Motion is reduced. Start when ready.' : '已减少动态效果，需要时开启互动。', 'paused');
  else run();
}
