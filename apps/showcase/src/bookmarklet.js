// Serialized into a bookmark: this function must remain self-contained.
function installPet({ url, pet, locale }) {
  const en = locale === 'en';
  const hosts = document.querySelectorAll('[data-petapp-companion]');
  if (hosts.length >= 4) {
    alert(en ? 'Four pets are already here. Close one before adding another.' : '这里已经有四只宠物了，先关掉一只再添加吧。');
    return;
  }
  const source = new URL(url);
  const newChannel = () => Array.from(crypto.getRandomValues(new Uint32Array(4)), n => n.toString(16)).join('-');
  let channel = newChannel();
  source.searchParams.set('pet', pet);
  source.searchParams.set('lang', locale);
  source.hash = new URLSearchParams({ channel, parent: location.origin }).toString();
  const host = document.createElement('div');
  host.dataset.petappCompanion = channel;
  // Important inline styles keep a site's selectors from moving the outer host.
  const set = (key, value) => host.style.setProperty(key, value, 'important');
  set('all', 'initial'); set('position', 'fixed'); set('z-index', '2147483647');
  set('width', '260px'); set('height', '300px'); set('pointer-events', 'none');
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
  style.textContent = ':host{color-scheme:light}*{box-sizing:border-box}header{position:absolute;top:0;right:8px;display:flex;gap:4px;pointer-events:auto}button{font:13px system-ui;color:#5b4a3a;background:#fffaf2;border:1px solid #dfcbb5;border-radius:12px;min-width:36px;min-height:32px;cursor:pointer}button:focus-visible,a:focus-visible{outline:3px solid #db8b58;outline-offset:2px}.move{cursor:grab;touch-action:none}iframe{position:absolute;top:34px;left:0;width:260px;height:266px;border:0;background:transparent;pointer-events:none}.notice{position:absolute;top:48px;left:16px;right:16px;font:13px/1.6 system-ui;color:#5b4a3a;background:#fffaf2;border:1px solid #dfcbb5;border-radius:14px;padding:16px;pointer-events:auto}.notice[hidden]{display:none}a{color:#8e5b39}';
  const header = document.createElement('header');
  const move = document.createElement('button');
  move.className = 'move'; move.textContent = '⠿';
  move.setAttribute('aria-label', en ? 'Move pet. Arrow keys also work.' : '移动宠物，也可用方向键');
  const close = document.createElement('button');
  close.textContent = '×'; close.setAttribute('aria-label', en ? 'Close pet' : '关闭宠物');
  header.append(move, close);
  const frame = document.createElement('iframe');
  frame.title = en ? 'PetApp web pet' : 'PetApp 网页宠物';
  frame.referrerPolicy = 'no-referrer';
  const coarsePointer = matchMedia('(pointer: coarse)').matches;
  if (coarsePointer) frame.style.pointerEvents = 'auto';
  if (source.origin !== location.origin) frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
  const notice = document.createElement('div');
  notice.className = 'notice'; notice.setAttribute('role', 'status');
  root.append(style, frame, header, notice);
  let disposed = false, ready = false, drag = null, grip = null, pending = null, raf = 0, timeout = 0;
  // An iframe still loading (or showing a browser error page) has a different
  // origin. Only send after its authenticated ready message, including on blur.
  const send = data => {
    if (ready && !disposed) frame.contentWindow?.postMessage({ ...data, channel }, source.origin);
  };
  function remove() {
    if (disposed) return;
    disposed = true;
    clearTimeout(timeout); cancelAnimationFrame(raf); observer.disconnect();
    document.removeEventListener('pointermove', forward, true);
    document.removeEventListener('pointerdown', forward, true);
    document.removeEventListener('pointerup', forward, true);
    document.removeEventListener('pointercancel', forward, true);
    window.removeEventListener('message', receive);
    window.removeEventListener('resize', position);
    window.removeEventListener('pagehide', remove);
    window.removeEventListener('blur', cancel);
    host.remove();
  }
  function cancel() {
    cancelAnimationFrame(raf); raf = 0; pending = null;
    drag = null;
    if (grip && move.hasPointerCapture(grip.id)) move.releasePointerCapture(grip.id);
    grip = null;
    send({ type: 'cancel' });
  }
  function forward(event) {
    if (!ready || disposed) return;
    const data = { type: 'pointer', event: event.type, x: event.clientX - x, y: event.clientY - y - 34,
      screenX: event.screenX, screenY: event.screenY,
      pointerId: event.pointerId, pointerType: event.pointerType, button: event.button, buttons: event.buttons, isPrimary: event.isPrimary };
    if (event.type === 'pointermove') {
      pending = data;
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; send(pending); });
    } else send(data);
  }
  function receive(event) {
    if (disposed || event.source !== frame.contentWindow || event.origin !== source.origin || event.data?.channel !== channel) return;
    const data = event.data;
    if (data.type === 'ready') { ready = true; notice.hidden = true; clearTimeout(timeout); }
    if (data.type === 'hover') frame.style.pointerEvents = coarsePointer || data.active ? 'auto' : 'none';
    if (data.type === 'close') remove();
    if (data.type === 'drag-start' && Number.isFinite(data.x) && Number.isFinite(data.y)) drag = { x, y, px: data.x, py: data.y };
    if (data.type === 'drag-move' && drag && Number.isFinite(data.x) && Number.isFinite(data.y)) {
      x = drag.x + data.x - drag.px; y = drag.y + data.y - drag.py; position();
    }
    if (data.type === 'drag-end') drag = null;
  }
  function unavailable() {
    if (ready || disposed) return;
    notice.replaceChildren(document.createTextNode(en ? 'Your pet could not connect. ' : '暂时未能连接到宠物。'));
    const retry = document.createElement('button');
    retry.type = 'button'; retry.textContent = en ? 'Retry' : '重新加载';
    retry.addEventListener('click', () => load(true));
    const link = document.createElement('a');
    link.href = new URL('./', url).href; link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.textContent = en ? 'Open PetApp' : '打开 PetApp';
    notice.append(retry, document.createTextNode(' '), link);
  }
  function load(retry = false) {
    if (disposed) return;
    ready = false; cancel(); clearTimeout(timeout);
    frame.style.pointerEvents = coarsePointer ? 'auto' : 'none';
    if (retry) {
      // Ignore late messages from the previous document and bypass cached errors.
      channel = newChannel();
      source.searchParams.set('_petappRetry', channel);
      source.hash = new URLSearchParams({ channel, parent: location.origin }).toString();
    }
    notice.hidden = false;
    notice.textContent = en ? 'Your pet is on its way…' : '小伙伴正在赶来…';
    timeout = setTimeout(unavailable, 15000);
    frame.src = source.href;
  }
  const observer = new MutationObserver(() => { if (!host.isConnected) remove(); });
  observer.observe(document.documentElement, { childList: true });
  if (document.body) observer.observe(document.body, { childList: true });
  window.addEventListener('message', receive);
  window.addEventListener('resize', position);
  window.addEventListener('pagehide', remove);
  window.addEventListener('blur', cancel);
  for (const type of ['pointermove', 'pointerdown', 'pointerup', 'pointercancel']) document.addEventListener(type, forward, true);
  close.addEventListener('click', remove);
  move.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary) return;
    grip = { id: event.pointerId, px: event.clientX, py: event.clientY, x, y };
    move.setPointerCapture(event.pointerId);
  });
  move.addEventListener('pointermove', event => {
    if (!grip || grip.id !== event.pointerId) return;
    x = grip.x + event.clientX - grip.px; y = grip.y + event.clientY - grip.py; position();
  });
  const endGrip = () => { grip = null; };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) move.addEventListener(type, endGrip);
  move.addEventListener('keydown', event => {
    const delta = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] }[event.key];
    if (delta) { event.preventDefault(); x += delta[0]; y += delta[1]; position(); }
    if (event.key === 'Escape') cancel();
  });
  // Set the destination before insertion so no same-origin about:blank iframe
  // is installed in the host page, and register listeners before navigation.
  load();
  (document.body || document.documentElement).append(host);
}

export function createPetBookmark({ pet = 'maodie', locale = 'zh-CN', url = new URL('companion.html', location.href).href } = {}) {
  return `javascript:${encodeURIComponent(`void (${installPet.toString()})(${JSON.stringify({ url, pet, locale })})`)}`;
}
