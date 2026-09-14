const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  screen,
} = require('electron');
const fs = require('node:fs');
const path = require('node:path');

app.setName('桌面宠物');

/** @type {BrowserWindow | null} */
let win = null;
/** @type {Tray | null} */
let tray = null;
/** @type {'tuanzi' | 'maodie'} */
let petId = 'tuanzi';
/** @type {{ x: number, y: number } | null} */
let dragOffset = null;

/** Overlay size per pet — maodie needs a wider stage to roam. */
const PET_SIZE = {
  tuanzi: { width: 180, height: 220 },
  maodie: { width: 280, height: 240 },
};
const MARGIN = 24;
const posFile = () => path.join(app.getPath('userData'), 'window-pos.json');

function petSize(id = petId) {
  return PET_SIZE[id] || PET_SIZE.tuanzi;
}

function trayIcon() {
  const iconPath = path.join(__dirname, 'tray.png');
  let img = nativeImage.createFromPath(iconPath);
  if (img.isEmpty()) {
    img = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAbElEQVRYR+2WMQ4AIAgD7f8/TQ0xGIcR2oKTdGjg0gKAiIh/nYw5Z+99Y8xIKc3M3HtPROydA9YKjDF3ztlaWyLinEpZa60xRmuNtfZJCc65lFLnnFprY8xJCddaxphzLs65/5QAZ+1JCfdS4P8K/ABb0hAhIWqG6wAAAABJRU5ErkJggg==',
    );
  }
  return img.resize({ width: 18, height: 18 });
}

function defaultBounds() {
  const { width, height } = petSize();
  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: Math.round(workArea.x + workArea.width - width - MARGIN),
    y: Math.round(workArea.y + workArea.height - height - MARGIN),
  };
}

function clampToDisplays(x, y, size = petSize()) {
  const { width, height } = size;
  const displays = screen.getAllDisplays();
  for (const d of displays) {
    const a = d.workArea;
    if (
      x + width > a.x &&
      x < a.x + a.width &&
      y + height > a.y &&
      y < a.y + a.height
    ) {
      return {
        x: Math.min(Math.max(Math.round(x), a.x), a.x + a.width - width),
        y: Math.min(Math.max(Math.round(y), a.y), a.y + a.height - height),
      };
    }
  }
  return defaultBounds();
}

/** Grow/shrink overlay around current center when switching pets. */
function applyPetWindowSize(id = petId) {
  if (!win) return;
  const size = petSize(id);
  const [cx, cy] = win.getPosition();
  const [ow, oh] = win.getSize();
  const nx = Math.round(cx + (ow - size.width) / 2);
  const ny = Math.round(cy + (oh - size.height) / 2);
  const safe = clampToDisplays(nx, ny, size);
  win.setBounds({
    x: safe.x,
    y: safe.y,
    width: size.width,
    height: size.height,
  });
  savePos();
}

function loadSavedPos() {
  try {
    const raw = JSON.parse(fs.readFileSync(posFile(), 'utf8'));
    if (typeof raw.x === 'number' && typeof raw.y === 'number') {
      return clampToDisplays(raw.x, raw.y);
    }
  } catch {
    /* first run */
  }
  return defaultBounds();
}

function savePos() {
  if (!win) return;
  const [x, y] = win.getPosition();
  try {
    fs.writeFileSync(posFile(), JSON.stringify({ x, y }));
  } catch {
    /* ignore */
  }
}

function createWindow() {
  const size = petSize();
  const pos = loadSavedPos();
  win = new BrowserWindow({
    width: size.width,
    height: size.height,
    x: pos.x,
    y: pos.y,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    title: '桌面宠物',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setAlwaysOnTop(true, 'floating');
  win.setIgnoreMouseEvents(true, { forward: true });

  const indexHtml = path.join(__dirname, '..', 'dist', 'index.html');
  win.loadFile(indexHtml);

  win.once('ready-to-show', () => {
    const safe = clampToDisplays(...win.getPosition());
    win.setPosition(safe.x, safe.y);
    win.show();
    win.focus();
  });

  win.on('moved', () => savePos());
  win.on('closed', () => {
    win = null;
    dragOffset = null;
  });
}

function ensureWindow() {
  if (!win) createWindow();
  return win;
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label: petId === 'tuanzi' ? '✓ 团子' : '团子',
      click: () => switchPet('tuanzi'),
    },
    {
      label: petId === 'maodie' ? '✓ 圆头耄耋' : '圆头耄耋',
      click: () => switchPet('maodie'),
    },
    { type: 'separator' },
    {
      label: '显示',
      click: () => {
        ensureWindow().show();
        win.focus();
      },
    },
    {
      label: '隐藏',
      click: () => win?.hide(),
    },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]);
}

function switchPet(id) {
  petId = id;
  tray?.setContextMenu(buildTrayMenu());
  ensureWindow();
  applyPetWindowSize(id);
  win.show();
  win.webContents.send('pet:switch', id);
}

function createTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip('桌面宠物');
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', () => {
    ensureWindow();
    if (win.isVisible()) win.hide();
    else {
      win.show();
      win.focus();
    }
  });
}

function popupPetMenu() {
  if (!win) return;
  win.setIgnoreMouseEvents(false);
  const menu = Menu.buildFromTemplate([
    { label: '摸头', click: () => win.webContents.send('pet:action', 'pet') },
    { label: '喂食', click: () => win.webContents.send('pet:action', 'feed') },
    { label: '跳跃', click: () => win.webContents.send('pet:action', 'jump') },
    { type: 'separator' },
    {
      label: petId === 'tuanzi' ? '✓ 团子' : '切换到团子',
      click: () => switchPet('tuanzi'),
    },
    {
      label: petId === 'maodie' ? '✓ 圆头耄耋' : '切换到圆头耄耋',
      click: () => switchPet('maodie'),
    },
    { type: 'separator' },
    { label: '隐藏', click: () => win.hide() },
    { label: '退出', click: () => app.quit() },
  ]);
  menu.popup({
    window: win,
    callback: () => {
      win?.setIgnoreMouseEvents(true, { forward: true });
      win?.webContents.send('pet:menu-closed');
    },
  });
}

ipcMain.on('pet:set-ignore-mouse', (_e, ignore) => {
  if (!win || dragOffset) return;
  if (ignore) win.setIgnoreMouseEvents(true, { forward: true });
  else win.setIgnoreMouseEvents(false);
});

ipcMain.on('pet:get-id', (e) => {
  e.returnValue = petId;
});

ipcMain.on('pet:set-window-size', (_e, id) => {
  if (id === 'tuanzi' || id === 'maodie') {
    petId = id;
    applyPetWindowSize(id);
  }
});

ipcMain.on('pet:context-menu', () => {
  popupPetMenu();
});

ipcMain.on('pet:drag-start', (_e, { screenX, screenY }) => {
  if (!win) return;
  const [wx, wy] = win.getPosition();
  dragOffset = { x: screenX - wx, y: screenY - wy };
  win.setIgnoreMouseEvents(false);
});

ipcMain.on('pet:drag-move', (_e, { screenX, screenY }) => {
  if (!win || !dragOffset) return;
  win.setPosition(
    Math.round(screenX - dragOffset.x),
    Math.round(screenY - dragOffset.y),
  );
});

ipcMain.on('pet:drag-end', () => {
  dragOffset = null;
  savePos();
  win?.setIgnoreMouseEvents(true, { forward: true });
  win?.webContents.send('pet:menu-closed');
});

app.whenReady().then(() => {
  // Keep Dock visible for discoverability (npm run desktop ≠ .app in /Applications)
  createWindow();
  createTray();
});

app.on('before-quit', () => savePos());

app.on('window-all-closed', () => {
  /* keep tray */
});
