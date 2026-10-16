import * as THREE from 'three';

/** Render the existing pose once into an alpha target, without advancing it. */
export function capturePetDragImage({ renderer, scene, camera, roots, point, maxSize = 180 }) {
  const rect = renderer.domElement.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const ratio = Math.min(1, 1024 / Math.max(rect.width, rect.height));
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  const target = new THREE.WebGLRenderTarget(width, height);
  target.texture.colorSpace = THREE.SRGBColorSpace;
  const previousTarget = renderer.getRenderTarget();
  const color = renderer.getClearColor(new THREE.Color()).clone();
  const alpha = renderer.getClearAlpha();
  const background = scene.background, fog = scene.fog;
  const hidden = new Map();
  const hide = object => { hidden.set(object, object.visible); object.visible = false; };
  const pixels = new Uint8Array(width * height * 4);
  try {
    for (const object of scene.children) if (!object.isLight && !roots.has(object)) hide(object);
    for (const root of roots) root.traverse(object => {
      // A contact shadow belongs on the ground, not in the carried pet image.
      if (object.geometry?.type === 'CircleGeometry' && object.material?.transparent && object.material.opacity < 1) hide(object);
    });
    scene.background = null; scene.fog = null;
    renderer.setRenderTarget(target);
    renderer.setClearColor(0, 0);
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
  } finally {
    scene.background = background; scene.fog = fog;
    for (const [object, visible] of hidden) object.visible = visible;
    renderer.setRenderTarget(previousTarget);
    renderer.setClearColor(color, alpha);
    target.dispose();
  }
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!pixels[(y * width + x) * 4 + 3]) continue;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, height - 1 - y); maxY = Math.max(maxY, height - 1 - y);
  }
  if (maxX < minX) return null;
  const cropWidth = maxX - minX + 1, cropHeight = maxY - minY + 1;
  const crop = document.createElement('canvas');
  crop.width = cropWidth; crop.height = cropHeight;
  const context = crop.getContext('2d');
  const image = context.createImageData(cropWidth, cropHeight);
  for (let y = 0; y < cropHeight; y++) for (let x = 0; x < cropWidth; x++) {
    const source = ((height - 1 - minY - y) * width + minX + x) * 4;
    const dest = (y * cropWidth + x) * 4;
    const a = pixels[source + 3];
    // WebGL blending writes premultiplied color. ImageData expects straight RGB.
    for (let channel = 0; channel < 3; channel++) image.data[dest + channel] = a ? Math.min(255, Math.round(pixels[source + channel] * 255 / a)) : 0;
    image.data[dest + 3] = a;
  }
  context.putImageData(image, 0, 0);
  const scale = Math.min(1 / ratio, (maxSize - 4) / Math.max(cropWidth, cropHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(maxSize, Math.ceil(cropWidth * scale) + 4);
  canvas.height = Math.min(maxSize, Math.ceil(cropHeight * scale) + 4);
  canvas.getContext('2d').drawImage(crop, 2, 2, canvas.width - 4, canvas.height - 4);
  const offsetX = point ? 2 + ((point.clientX - rect.left) * ratio - minX) * scale : canvas.width / 2;
  const offsetY = point ? 2 + ((point.clientY - rect.top) * ratio - minY) * scale : canvas.height / 2;
  return {
    canvas,
    offsetX: Math.round(Math.max(0, Math.min(canvas.width, offsetX))),
    offsetY: Math.round(Math.max(0, Math.min(canvas.height, offsetY))),
  };
}
