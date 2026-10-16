import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, mkdtemp } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PETAPP_PLAYWRIGHT_PATH || 'playwright');
const dist = resolve('apps/showcase/dist');
const output = process.env.PETAPP_TEST_OUTPUT || resolve(tmpdir(), 'petapp-portable-results');
await mkdir(output, { recursive: true });
const strictPolicy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'self'";
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname.startsWith('/fixture/')) {
    let policy = strictPolicy;
    if (pathname.endsWith('/images-blocked')) policy = policy.replace("img-src 'self' data:", "img-src 'none'");
    res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Security-Policy': policy });
    res.end('<!doctype html><html><head><title>Strict host policy</title><style>body{background:#15191d;color:white;font:18px system-ui;padding:32px}button{padding:8px}#under{position:fixed;right:20px;bottom:20px;width:260px;height:300px}</style><script src="/fixture.js" defer></script></head><body><h1>Strict host policy</h1><p>No external frames, scripts or connections allowed.</p><label>Host input <input id="host-input"></label><button id="under">Host page remains clickable</button></body></html>'); return;
  }
  if (pathname === '/fixture.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    res.end("window.policyViolations=[];document.addEventListener('securitypolicyviolation',e=>policyViolations.push({directive:e.effectiveDirective,uri:e.blockedURI}));document.querySelector('#under').addEventListener('click',()=>document.querySelector('#under').dataset.clicked='yes');"); return;
  }
  const file = resolve(dist, '.' + decodeURIComponent(pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(dist + sep)) { res.writeHead(403).end(); return; }
  try { const bytes = await readFile(file); res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }); res.end(bytes); }
  catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const launchOptions = { headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] };
const browser = await chromium.launch(launchOptions);
const report = { platform: process.platform, browser: browser.version(), checks: [], external: [] };
let bookmark;

async function execute(page, url = bookmark) {
  const cdp = await page.context().newCDPSession(page);
  // User-invoked bookmark code, without relaxing the page's resource policies.
  const result = await cdp.send('Runtime.evaluate', {
    expression: decodeURIComponent(url.slice('javascript:'.length)),
    userGesture: true, awaitPromise: false, allowUnsafeEvalBlockedByCSP: false,
  });
  await cdp.detach();
  assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails));
}
const pets = page => page.locator('[data-petapp-companion]');
async function ready(page) { await page.waitForFunction(() => document.querySelector('[data-petapp-companion]')?.dataset.state === 'ready', undefined, { timeout: 15000 }); }
async function pixels(page) {
  return page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => {
    const c = document.querySelector('[data-petapp-companion]').shadowRoot.querySelector('canvas');
    const gl = c.getContext('webgl2'), data = new Uint8Array(c.width * c.height * 4);
    gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
    let visible = 0; for (let i = 3; i < data.length; i += 4) if (data[i]) visible++;
    resolve(visible);
  })));
}
async function petPoint(page) {
  return page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => {
    const c = document.querySelector('[data-petapp-companion]').shadowRoot.querySelector('canvas');
    const gl = c.getContext('webgl2'), data = new Uint8Array(c.width * c.height * 4);
    gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
    let minX = c.width, minY = c.height, maxX = 0, maxY = 0;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      if (data[(y * c.width + x) * 4 + 3] > 128) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
    const r = c.getBoundingClientRect();
    resolve({ x: r.left + (minX + maxX) / 2 / c.width * r.width, y: r.top + (1 - (minY + maxY) / 2 / c.height) * r.height });
  })));
}
async function fixture(name, task, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(`${origin}/fixture/${name}`);
    await task(page, context);
    assert.deepEqual(errors, [], `Unexpected page exceptions in ${name}`);
    report.checks.push({ name, result: 'passed' });
  } catch (error) {
    await page.screenshot({ path: resolve(output, `failed-${name}.png`) }).catch(() => {});
    report.checks.push({ name, result: 'failed', error: String(error) }); throw error;
  } finally { await context.close(); }
}

try {
  const sourcePage = await browser.newPage();
  await sourcePage.goto(`${origin}/?embed=maodie`);
  await sourcePage.locator('#pet-takeaway').waitFor();
  bookmark = await sourcePage.locator('#pet-takeaway').getAttribute('href');
  assert.ok(bookmark.startsWith('javascript:'));
  assert.ok(bookmark.length < 1900000, `Bookmark too long: ${bookmark.length}`);
  report.bookmarkBytes = Buffer.byteLength(bookmark);
  await sourcePage.close();

  // Save/read the complete URL through Chromium's actual bookmarks API in an
  // empty disposable profile. No existing browser/profile/bookmarks are used.
  const scratch = await mkdtemp(resolve(tmpdir(), 'petapp-bookmark-storage-'));
  const extension = resolve(scratch, 'extension'); await mkdir(extension);
  await writeFile(resolve(extension, 'manifest.json'), JSON.stringify({ manifest_version: 3, name: 'PetApp bookmark storage check', version: '1.0', permissions: ['bookmarks'], background: { service_worker: 'background.js' } }));
  await writeFile(resolve(extension, 'background.js'), 'chrome.runtime.onInstalled.addListener(() => {});');
  const storage = await chromium.launchPersistentContext(resolve(scratch, 'profile'), { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  try {
    const worker = storage.serviceWorkers()[0] || await storage.waitForEvent('serviceworker');
    const saved = await worker.evaluate(async url => {
      const item = await chrome.bookmarks.create({ title: 'PetApp portable storage test', url });
      const [loaded] = await chrome.bookmarks.get(item.id);
      return { exact: loaded.url === url, length: loaded.url.length };
    }, bookmark);
    assert.ok(saved.exact); assert.equal(saved.length, bookmark.length);
    report.checks.push({ name: 'chromium-bookmark-storage-roundtrip', result: 'passed', bytes: saved.length });
  } finally { await storage.close(); }

  await fixture('negative-control', async page => {
    await page.evaluate(() => { const f = document.createElement('iframe'); f.src = 'https://tech.wenmq.cn/petapp/companion.html'; document.body.append(f); });
    await page.waitForFunction(() => window.policyViolations.some(x => x.directive === 'frame-src'));
  });
  await fixture('strict-and-offline', async (page, context) => {
    await context.setOffline(true);
    const requests = []; page.on('request', req => { if (/^https?:/.test(req.url())) requests.push(req.url()); });
    await execute(page); await ready(page);
    assert.equal(await pets(page).locator('iframe').count(), 0);
    assert.ok(await pixels(page) > 200, 'Pet canvas has no visible pixels');
    await pets(page).getByRole('button', { name: '摸摸头', exact: true }).click();
    await pets(page).locator('.status').filter({ hasText: '试着摸摸头' }).waitFor();
    const before = await pets(page).evaluate(e => parseFloat(e.style.left));
    await pets(page).getByRole('button', { name: '移动宠物，也可用方向键', exact: true }).press('ArrowLeft');
    assert.equal(await pets(page).evaluate(e => parseFloat(e.style.left)), before - 16);
    await page.waitForTimeout(1400); // Let the authored hiss/particles finish before locating the moving body.
    const point = await petPoint(page);
    const beforeDrag = await pets(page).evaluate(e => parseFloat(e.style.left));
    await page.mouse.move(point.x, point.y); await page.mouse.down();
    await page.mouse.move(point.x - 20, point.y, { steps: 4 }); await page.mouse.up();
    assert.ok(await pets(page).evaluate(e => parseFloat(e.style.left)) < beforeDrag - 8, 'Pet did not drag');
    const bounds = await pets(page).boundingBox();
    await page.mouse.click(bounds.x + 40, bounds.y + 45);
    assert.equal(await page.locator('#under').getAttribute('data-clicked'), 'yes', 'Transparent area intercepted host click after drag');
    await page.locator('#host-input').fill('Host input still works');
    assert.equal(await page.locator('#host-input').inputValue(), 'Host input still works');
    await page.screenshot({ path: resolve(output, 'strict-and-offline.png') });
    await pets(page).getByRole('button', { name: '关闭宠物', exact: true }).click();
    assert.equal(await pets(page).count(), 0);
    assert.deepEqual(requests, [], 'Saved pet made network requests');
    assert.deepEqual(await page.evaluate(() => window.policyViolations), []);
  });
  await fixture('images-blocked', async page => {
    await execute(page);
    await page.waitForFunction(() => document.querySelector('[data-petapp-companion]')?.dataset.state === 'error');
    assert.match(await pets(page).locator('.notice').innerText(), /安全策略/);
    await page.screenshot({ path: resolve(output, 'images-blocked.png') });
    await pets(page).getByRole('button', { name: '关闭宠物', exact: true }).click();
  });
  await fixture('reduced-motion', async page => {
    await execute(page);
    assert.equal(await pets(page).getAttribute('data-state'), 'paused');
    await pets(page).getByRole('button', { name: '开启互动', exact: true }).click();
    await ready(page);
  }, { reducedMotion: 'reduce' });
  await fixture('multiple-and-cancel', async page => {
    await execute(page); await ready(page);
    await execute(page); await page.waitForFunction(() => [...document.querySelectorAll('[data-petapp-companion]')].every(e => e.dataset.state === 'ready'));
    assert.equal(await pets(page).count(), 2);
    await pets(page).first().getByRole('button', { name: '关闭宠物', exact: true }).click();
    assert.equal(await pets(page).count(), 1);
    await pets(page).first().getByRole('button', { name: '关闭宠物', exact: true }).click();
    await execute(page);
    await pets(page).getByRole('button', { name: '关闭宠物', exact: true }).click();
    assert.equal(await pets(page).count(), 0);
  });
  await fixture('narrow-viewport', async page => {
    await execute(page); await ready(page);
    const bounds = await pets(page).boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390);
    await page.screenshot({ path: resolve(output, 'narrow-viewport.png') });
  }, { viewport: { width: 390, height: 844 } });
  const noGraphics = await chromium.launch({ headless: true, args: ['--disable-webgl'] });
  try {
    const context = await noGraphics.newContext(); const page = await context.newPage();
    await page.goto(`${origin}/fixture/no-webgl`); await execute(page);
    await page.waitForFunction(() => document.querySelector('[data-petapp-companion]')?.dataset.state === 'error');
    assert.match(await pets(page).locator('.notice').innerText(), /未能显示/);
    await page.screenshot({ path: resolve(output, 'no-webgl.png') });
    report.checks.push({ name: 'no-webgl-fails-clearly', result: 'passed' });
  } finally { await noGraphics.close(); }
  // These real sites run in a fresh logged-out browser on the CI host. Record
  // upstream denial/challenges separately; never turn them into a claimed pass.
  for (const target of ['https://x.com/', 'https://godot.com/', 'https://godotengine.org/']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const record = { url: target };
    try {
      const response = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30000 });
      record.status = response?.status(); record.title = await page.title(); record.finalUrl = page.url();
      record.policy = response?.headers()['content-security-policy'] || null;
      await execute(page); await ready(page);
      record.visiblePixels = await pixels(page);
      assert.ok(record.visiblePixels > 200);
      record.result = record.status < 400 ? 'pet-rendered' : 'upstream-denied-pet-rendered';
      await page.screenshot({ path: resolve(output, `live-${new URL(target).hostname}.png`) });
    } catch (error) { record.result = 'unavailable'; record.error = String(error); }
    finally { report.external.push(record); await context.close(); }
  }
} finally {
  await writeFile(resolve(output, 'results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close(); server.close();
}
