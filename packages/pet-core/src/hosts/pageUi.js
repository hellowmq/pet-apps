/**
 * Full-page cream chrome (title / hint / bond / actions). Optional host UI.
 */
export const pageUi = {
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
    const ui = document.createElement('div');
    ui.className = 'pet-page-ui';
    ui.innerHTML = `<h1></h1><p></p>`;
    const titleEl = ui.querySelector('h1');
    const hintEl = ui.querySelector('p');
    titleEl.textContent = api.title;
    hintEl.textContent = api.hint;

    const hearts = document.createElement('div');
    hearts.className = 'pet-page-hearts';
    hearts.innerHTML = `❤ 亲密度 <span data-bond>0</span>`;
    const bondEl = hearts.querySelector('[data-bond]');

    const actions = document.createElement('div');
    actions.className = 'pet-page-actions';
    actions.innerHTML = `
      <button type="button" data-act="pet">摸头</button>
      <button type="button" data-act="feed">喂食 🍪</button>
      <button type="button" data-act="jump">跳跃</button>
    `;

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

    parent.append(ui, hearts, actions);

    return {
      unmount() {
        actions.removeEventListener('click', onClick);
        unsub();
        ui.remove();
        hearts.remove();
        actions.remove();
      },
    };
  },
};
