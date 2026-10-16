import { describe, expect, it } from 'vitest';
import { createPetTextureLoader } from '../src/loadPetTextures.js';

function fixture(options = {}) {
  const calls = [];
  const loader = createPetTextureLoader({ imageLoader: { load(url, loaded, progress, failed) {
    calls.push({ url, loaded, failed });
  } }, ...options });
  return { calls, loader };
}

describe('pet frame loading', () => {
  it('limits concurrent requests and reports ready only after every frame', async () => {
    const { loader, calls } = fixture({ concurrency: 2 });
    const frames = ['one', 'two', 'three'].map(url => loader.load(url));
    const ready = loader.ready();
    let settled = false; ready.then(() => { settled = true; });
    expect(calls).toHaveLength(2);
    calls[0].loaded({ width: 1, height: 1 });
    expect(calls).toHaveLength(3);
    calls[1].loaded({ width: 1, height: 1 });
    await Promise.resolve(); expect(settled).toBe(false);
    calls[2].loaded({ width: 1, height: 1 });
    await ready;
    expect(frames.every(frame => frame.image && frame.version === 1)).toBe(true);
  });

  it('retries failures while retaining the frame texture reference', async () => {
    const { loader, calls } = fixture();
    const frame = loader.load('walk/4.png');
    const ready = loader.ready();
    calls[0].failed(); calls[1].failed();
    const image = { width: 139, height: 84 };
    calls[2].loaded(image);
    await ready;
    expect(calls.map(call => call.url)).toEqual(Array(3).fill('walk/4.png'));
    expect(frame.image).toBe(image);
    expect(frame.version).toBe(1);
  });

  it('rejects an incomplete sequence rather than reporting it ready', async () => {
    const { loader, calls } = fixture();
    loader.load('missing.png');
    const ready = loader.ready();
    calls[0].failed(); calls[1].failed(); calls[2].failed();
    await expect(ready).rejects.toThrow('Pet texture unavailable');
    expect(calls).toHaveLength(3);
  });

  it('cancels queued work and ignores late results after disposal', async () => {
    const { loader, calls } = fixture({ concurrency: 1 });
    const frame = loader.load('one'); loader.load('two');
    const ready = loader.ready();
    loader.dispose(); calls[0].loaded({ width: 1, height: 1 });
    await expect(ready).rejects.toThrow('cancelled');
    expect(calls).toHaveLength(1);
    expect(frame.image).toBeNull();
  });
});
