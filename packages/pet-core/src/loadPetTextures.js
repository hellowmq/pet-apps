import * as THREE from 'three';

/** Keep frame references stable while loading/retrying a bounded image queue. */
export function createPetTextureLoader({ imageLoader = new THREE.ImageLoader(), concurrency = 4, retries = 2 } = {}) {
  const queue = [], jobs = [];
  let active = 0, disposed = false;
  function pump() {
    while (!disposed && active < concurrency && queue.length) {
      const job = queue.shift();
      active++;
      imageLoader.load(job.url, image => {
        active--;
        if (!disposed) { job.texture.image = image; job.texture.needsUpdate = true; job.resolve(); }
        pump();
      }, undefined, () => {
        active--;
        if (!disposed) {
          if (job.attempt++ < retries) queue.push(job);
          else job.reject(new Error(`Pet texture unavailable: ${job.url}`));
        }
        pump();
      });
    }
  }
  return {
    load(url) {
      if (disposed) throw new Error('Pet texture loader disposed');
      const texture = new THREE.Texture();
      texture.colorSpace = THREE.SRGBColorSpace;
      let resolve, reject;
      const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
      // Hosts that don't await readiness must not create unhandled rejections.
      promise.catch(() => {});
      const job = { url, texture, attempt: 0, promise, resolve, reject };
      jobs.push(job); queue.push(job); pump();
      return texture;
    },
    ready: () => Promise.all(jobs.map(job => job.promise)),
    dispose() {
      disposed = true; queue.length = 0;
      for (const job of jobs) job.reject(new Error('Pet texture loading cancelled'));
    },
  };
}
