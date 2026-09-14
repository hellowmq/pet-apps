/**
 * Compact desktop chrome — drag strip + mini actions + bond.
 */
export const desktopUi = {
  /**
   * @param {HTMLElement} parent
   * @param {{
   *   title: string,
   *   hint: string,
   *   getBond: () => number,
   *   subscribeBond: (fn: (v: number) => void) => () => void,
   *   onPet: () => void,
   *   onJump: () => void,
   *   onFeed: () => void,
   * }} api
   */
  mount(parent, api) {
    const root = document.createElement('div');
    root.className = 'pet-desktop-ui';
    root.innerHTML = `
      <style>
        .pet-desktop-ui {
          position: fixed; inset: 0; z-index: 10; pointer-events: none;
          font-family: -apple-system, "PingFang SC", sans-serif;
        }
        .pet-desktop-ui .drag {
          position: absolute; top: 8px; left: 50%; transform: translateX(-50%);
          width: 72px; height: 10px; border-radius: 999px;
          background: rgba(255,255,255,.55);
          box-shadow: 0 2px 8px rgba(0,0,0,.12);
          pointer-events: auto;
          -webkit-app-region: drag;
          cursor: grab;
        }
        .pet-desktop-ui .bond {
          position: absolute; top: 8px; right: 10px;
          pointer-events: auto; -webkit-app-region: no-drag;
          background: rgba(255,255,255,.8); border-radius: 999px;
          padding: 4px 10px; font-size: 12px; font-weight: 600; color: #e2557b;
        }
        .pet-desktop-ui .name {
          position: absolute; top: 28px; left: 12px;
          pointer-events: none; font-size: 11px; color: rgba(91,74,58,.85);
          text-shadow: 0 1px 2px rgba(255,255,255,.8);
        }
        .pet-desktop-ui .actions {
          position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
          display: flex; gap: 6px; pointer-events: auto; -webkit-app-region: no-drag;
        }
        .pet-desktop-ui .actions button {
          font: 600 12px/1 -apple-system, "PingFang SC", sans-serif;
          color: #5b4a3a; background: rgba(255,255,255,.88);
          border: 1px solid rgba(180,140,100,.28);
          border-radius: 999px; padding: 7px 12px; cursor: pointer;
        }
      </style>
      <div class="drag" title="拖动"></div>
      <div class="bond">❤ <span data-bond>0</span></div>
      <div class="name"></div>
      <div class="actions">
        <button type="button" data-act="pet">摸头</button>
        <button type="button" data-act="feed">喂食</button>
        <button type="button" data-act="jump">跳跃</button>
      </div>
    `;

    root.querySelector('.name').textContent = api.title;
    const bondEl = root.querySelector('[data-bond]');
    const actions = root.querySelector('.actions');

    const onClick = (e) => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const act = btn.getAttribute('data-act');
      if (act === 'pet') api.onPet();
      else if (act === 'jump') api.onJump();
      else if (act === 'feed') api.onFeed();
    };
    actions.addEventListener('click', onClick);

    const unsub = api.subscribeBond((v) => {
      bondEl.textContent = String(v);
    });

    parent.appendChild(root);

    return {
      unmount() {
        actions.removeEventListener('click', onClick);
        unsub();
        root.remove();
      },
    };
  },
};
