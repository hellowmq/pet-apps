const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'docs', 'media');
const PET_ID = process.argv.includes('--maodie') ? 'maodie' : 'tuanzi';
const PET_SIZE = PET_ID === 'maodie'
  ? { width: 280, height: 240 }
  : { width: 180, height: 220 };

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureOutputDir() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function waitForCanvas(win) {
  await win.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const started = Date.now();
      const check = () => {
        const canvas = document.querySelector('canvas');
        if (canvas && canvas.width > 0 && canvas.height > 0) {
          resolve(true);
          return;
        }
        if (Date.now() - started > 10000) {
          reject(new Error('Timed out waiting for the pet canvas'));
          return;
        }
        requestAnimationFrame(check);
      };
      check();
    })
  `);
}

async function recordCanvas(win, durationMs) {
  const dataUrlPromise = win.webContents.executeJavaScript(`
    (async () => {
      const canvas = document.querySelector('canvas');
      if (!canvas) throw new Error('Pet canvas not found');
      const mimeType = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
      ].find((type) => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error('This Electron runtime cannot record WebM');

      const stream = canvas.captureStream(30);
      const chunks = [];
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      const stopped = new Promise((resolve, reject) => {
        recorder.onerror = () => reject(recorder.error || new Error('MediaRecorder failed'));
        recorder.onstop = resolve;
      });
      recorder.start();
      await new Promise((resolve) => setTimeout(resolve, ${durationMs}));
      recorder.stop();
      await stopped;
      stream.getTracks().forEach((track) => track.stop());

      const blob = new Blob(chunks, { type: mimeType });
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error || new Error('Failed to read recording'));
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    })()
  `);
  const dataUrl = await dataUrlPromise;
  if (typeof dataUrl !== 'string') throw new Error('MediaRecorder returned a non-string payload');
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

function convertToGif(webmPath, gifPath) {
  const result = spawnSync('ffmpeg', [
    '-y',
    '-i', webmPath,
    '-vf', 'fps=12,scale=360:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=sierra2_4a',
    gifPath,
  ], { encoding: 'utf8' });
  if (result.error) {
    throw new Error(`ffmpeg is required to make the GIF: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || 'ffmpeg failed to make the GIF');
  }
}

async function main() {
  ensureOutputDir();
  const distPath = path.join(ROOT, 'apps', 'desktop', 'dist', 'index.html');
  const preloadPath = path.join(ROOT, 'apps', 'desktop', 'electron', 'preload.cjs');
  if (!fs.existsSync(distPath)) {
    throw new Error('apps/desktop/dist/index.html is missing; run npm run build:desktop first');
  }

  const win = new BrowserWindow({
    ...PET_SIZE,
    show: false,
    offscreen: true,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  ipcMain.on('pet:get-id', (event) => {
    event.returnValue = PET_ID;
  });
  ipcMain.on('pet:set-window-size', (_event, id) => {
    if (id === 'tuanzi' || id === 'maodie') win.setSize(PET_SIZE.width, PET_SIZE.height);
  });
  win.webContents.startPainting();
  win.webContents.setFrameRate(30);

  await win.loadFile(distPath);
  await waitForCanvas(win);
  await wait(800);

  const prefix = PET_ID === 'maodie' ? 'maodie-canvas' : 'tuanzi-canvas';
  const still = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT_DIR, `${prefix}.png`), still.toPNG({ scaleFactor: 1 }));

  const recording = recordCanvas(win, 5200);
  setTimeout(() => win.webContents.send('pet:action', 'pet'), 900);
  setTimeout(() => win.webContents.send('pet:action', 'feed'), 2100);
  setTimeout(() => win.webContents.send('pet:action', 'jump'), 3400);
  const webm = await recording;
  const webmPath = path.join(OUT_DIR, `${prefix}.webm`);
  const gifPath = path.join(OUT_DIR, `${prefix}.gif`);
  fs.writeFileSync(webmPath, webm);
  convertToGif(webmPath, gifPath);
  fs.unlinkSync(webmPath);

  await win.close();
  console.log(`Captured ${prefix}.png and ${prefix}.gif`);
}

app.whenReady().then(() => main()
  .then(() => app.quit())
  .catch((error) => {
    console.error(error.stack || error);
    app.exit(1);
  }));
