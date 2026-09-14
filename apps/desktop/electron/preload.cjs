const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopPet', {
  setIgnoreMouse(ignore) {
    ipcRenderer.send('pet:set-ignore-mouse', !!ignore);
  },
  getPet() {
    return ipcRenderer.sendSync('pet:get-id');
  },
  setWindowSize(id) {
    ipcRenderer.send('pet:set-window-size', id);
  },
  onSwitchPet(cb) {
    ipcRenderer.on('pet:switch', (_e, id) => cb(id));
  },
  onAction(cb) {
    ipcRenderer.on('pet:action', (_e, action) => cb(action));
  },
  onMenuClosed(cb) {
    ipcRenderer.on('pet:menu-closed', () => cb());
  },
  openContextMenu() {
    ipcRenderer.send('pet:context-menu');
  },
  dragStart(screenX, screenY) {
    ipcRenderer.send('pet:drag-start', { screenX, screenY });
  },
  dragMove(screenX, screenY) {
    ipcRenderer.send('pet:drag-move', { screenX, screenY });
  },
  dragEnd() {
    ipcRenderer.send('pet:drag-end');
  },
});
