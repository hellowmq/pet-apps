import { createPetBookmark } from './bookmarklet.js';

/** Web-embed host only: native link dragging transfers the displayed pet. */
export function mountPetTakeaway({ canvasHost, still, gesture, hitTest, getDragPreview, locale, name, status }) {
  const en = locale === 'en';
  const bookmark = createPetBookmark({ pet: 'maodie', locale });
  const title = `PetApp · ${name}`;
  const link = document.createElement('a');
  link.id = 'pet-takeaway'; link.href = bookmark; link.draggable = true; link.title = title;
  link.setAttribute('aria-label', en ? `Interact with ${name}, or drag it to your bookmarks bar` : `和${name}互动，或拖到书签栏带走`);
  const label = document.createElement('span');
  label.className = 'takeaway-name'; label.textContent = title;
  still.draggable = false;
  canvasHost.before(link); link.append(still, canvasHost, label);
  const take = document.createElement('button');
  take.type = 'button'; take.id = 'take-pet';
  take.textContent = en ? 'Take along ↗' : '带走这只 ↗';
  document.querySelector('.demo-heading').append(take);
  const hint = document.createElement('p');
  hint.id = 'takeaway-hint';
  hint.textContent = matchMedia('(pointer: coarse)').matches
    ? (en ? 'Tap to interact · Use “Take along” for bookmark instructions' : '轻点互动 · 「带走这只」查看书签用法')
    : (en ? 'Tap to interact · Drag this pet to your bookmarks bar' : '轻点互动 · 抓住它，拖到书签栏带走');
  document.querySelector('#stage').append(hint);
  const dialog = document.createElement('dialog');
  dialog.className = 'takeaway-dialog'; dialog.setAttribute('aria-labelledby', 'takeaway-title');
  const heading = document.createElement('h3');
  heading.id = 'takeaway-title'; heading.textContent = en ? 'Bring this pet along' : '把这只小伙伴带走';
  const close = document.createElement('button'); close.type = 'button'; close.className = 'takeaway-close';
  close.textContent = '×'; close.setAttribute('aria-label', en ? 'Close instructions' : '关闭说明');
  const instructions = document.createElement('p');
  instructions.textContent = en ? 'Drag the pet or the link below to your browser’s bookmarks bar. Then click the saved bookmark on another page.' : '把宠物或下方链接拖到浏览器书签栏。以后打开别的网页，点一下保存的书签，它就会出现。';
  const alternative = document.createElement('a');
  alternative.id = 'pet-bookmark-link'; alternative.href = bookmark; alternative.draggable = true;
  alternative.title = title; alternative.textContent = title;
  alternative.addEventListener('click', event => { event.preventDefault(); });
  const details = document.createElement('details');
  const summary = document.createElement('summary'); summary.textContent = en ? 'Create a bookmark manually' : '手动创建书签';
  const manual = document.createElement('p');
  manual.textContent = en ? 'Create a bookmark named after the pet and paste this entire code into its URL field.' : '新建一个以宠物命名的书签，把下面的完整代码粘贴到网址栏。';
  const code = document.createElement('textarea'); code.readOnly = true; code.value = bookmark; code.rows = 2;
  code.setAttribute('aria-label', en ? 'Complete bookmark URL' : '完整书签网址');
  code.addEventListener('focus', () => code.select());
  details.append(summary, manual, code);
  const note = document.createElement('p'); note.className = 'takeaway-note';
  note.textContent = en ? 'For ordinary web pages. Some sites restrict loading; browser settings pages are unavailable.' : '适用于普通网页。部分网站会限制加载，浏览器设置等内部页面不支持。';
  dialog.append(close, heading, instructions, alternative, details, note);
  document.body.append(dialog);
  take.addEventListener('click', () => dialog.showModal());
  close.addEventListener('click', () => dialog.close());
  let ownsPress = false;
  let pressPoint = null, dragCanvas = null, previewFrame = 0;
  const clearPreview = () => {
    cancelAnimationFrame(previewFrame); previewFrame = 0;
    dragCanvas?.remove(); dragCanvas = null;
  };
  link.addEventListener('pointerdown', event => {
    ownsPress = event.button === 0 && event.isPrimary && (hitTest(event) || !still.hidden);
    pressPoint = ownsPress ? { clientX: event.clientX, clientY: event.clientY } : null;
  }, true);
  link.addEventListener('dragstart', event => {
    if (!ownsPress) { event.preventDefault(); return; }
    gesture.cancel();
    clearPreview();
    let preview;
    try { preview = getDragPreview(pressPoint); } catch { /* Offer instructions if capture is unavailable. */ }
    if (!preview && !still.hidden && still.complete && still.naturalWidth) {
      const canvas = document.createElement('canvas');
      const ratio = Math.min(160 / still.naturalWidth, 160 / still.naturalHeight);
      canvas.width = Math.ceil(still.naturalWidth * ratio); canvas.height = Math.ceil(still.naturalHeight * ratio);
      canvas.getContext('2d').drawImage(still, 0, 0, canvas.width, canvas.height);
      preview = { canvas, offsetX: canvas.width / 2, offsetY: canvas.height / 2 };
    }
    if (!preview) {
      event.preventDefault();
      status.textContent = en ? 'Use “Take along” for bookmark instructions.' : '可点「带走这只」查看书签保存方式。';
      return;
    }
    dragCanvas = preview.canvas;
    dragCanvas.dataset.petDragPreview = '';
    Object.assign(dragCanvas.style, { position: 'fixed', left: '0', top: '0', pointerEvents: 'none', zIndex: '-1' });
    document.body.append(dragCanvas);
    event.dataTransfer.setDragImage(dragCanvas, preview.offsetX, preview.offsetY);
    // Chrome captures the bitmap after dragstart. Remove the temporary element
    // on the next frame; dragend/pagehide also cover cancelled or suspended drags.
    previewFrame = requestAnimationFrame(() => { previewFrame = 0; clearPreview(); });
    // Native URI data is browser-owned. Plain text supplies the intact URL for
    // browsers which sanitize javascript: in a DOM text/uri-list drop.
    event.dataTransfer.setData('text/plain', bookmark);
    event.dataTransfer.effectAllowed = 'copyLink';
    status.textContent = en ? 'Drop onto your bookmarks bar to save.' : '拖到书签栏，松开鼠标保存。';
  });
  link.addEventListener('dragend', () => {
    clearPreview();
    ownsPress = false;
    status.textContent = en ? 'Click a saved bookmark on another page to summon this pet.' : '保存后，在别的网页点书签就能召唤它。';
  });
  link.addEventListener('pointerup', () => { ownsPress = false; });
  link.addEventListener('pointercancel', () => { ownsPress = false; });
  window.addEventListener('blur', () => { ownsPress = false; });
  window.addEventListener('pagehide', clearPreview);
  window.addEventListener('keydown', event => { if (event.key === 'Escape') ownsPress = false; });
  link.addEventListener('click', event => {
    event.preventDefault();
    // Pointer gestures already own body interactions. Keyboard activation opens
    // real instructions instead of evaluating the bookmark on the source page.
    if (event.detail === 0) dialog.showModal();
  });
  document.querySelector('#stage').addEventListener('dragover', event => event.preventDefault());
  document.querySelector('#stage').addEventListener('drop', event => event.preventDefault());
}
