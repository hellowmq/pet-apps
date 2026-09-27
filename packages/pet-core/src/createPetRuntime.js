import * as THREE from 'three';
import { createBond } from './bond.js';
import { createParticles } from './particles.js';

const UI_HOVER_SEL = '.pet-desktop-ui, .pet-page-actions, .pet-page-ui, .pet-page-hearts';

/**
 * Embeddable pet runtime — size & pointer relative to `container`.
 * @param {object} options
 * @param {HTMLElement} options.container
 * @param {object} options.pet
 * @param {{ mount: Function } | null} [options.ui]
 * @param {number} [options.boundX]
 * @param {string | null} [options.background]
 * @param {boolean} [options.transparent]
 * @param {(hovering: boolean) => void} [options.onHoverChange]
 * @param {boolean} [options.petOnPointerDown=true]  false when host handles click/drag
 * @param {EventTarget} [options.pointerTarget=window]  scope pointer events for embedded hosts
 * @param {HTMLElement} [options.cursorTarget=document.body]  element whose cursor reflects pet hover
 * @param {number} [options.cameraDistanceScale=1]  values below 1 bring the camera closer
 */
export function createPetRuntime(options) {
  const {
    container,
    pet,
    ui = null,
    boundX = 3.6,
    background = '#fdf6ec',
    transparent = false,
    onHoverChange,
    petOnPointerDown = true,
    pointerTarget = window,
    cursorTarget = document.body,
    cameraDistanceScale = 1,
  } = options;

  if (!container || !pet) {
    throw new Error('createPetRuntime requires { container, pet }');
  }

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: transparent,
  });
  if (transparent) renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  if (transparent) {
    scene.background = null;
  } else {
    scene.background = new THREE.Color(background);
    scene.fog = new THREE.Fog(background, 10, 26);
  }

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  const CAM_TARGET = new THREE.Vector3(0, 1, 0);
  const CAM_OFFSET = new THREE.Vector3(0, 1.6, 7.2);
  const CAM_BASE_LEN = CAM_OFFSET.length();
  const cameraBaseLen = CAM_BASE_LEN * Math.max(0.25, cameraDistanceScale);

  scene.add(new THREE.AmbientLight('#fff4e0', 0.9));
  const sun = new THREE.DirectionalLight('#ffffff', 1.6);
  sun.position.set(4, 8, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -6;
  sun.shadow.camera.right = sun.shadow.camera.top = 6;
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(9, 48),
    new THREE.ShadowMaterial({ opacity: transparent ? 0.1 : 0.16 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const bond = createBond();
  const particles = createParticles(scene);

  const ctx = {
    scene,
    camera,
    container,
    boundX,
    addBond: (n) => bond.addBond(n),
    burst: (origin, count) => particles.burst(origin, count),
  };
  pet.mount(ctx);

  const uiHost = container.parentElement || container;
  let uiHandle = null;
  if (ui && typeof ui.mount === 'function') {
    uiHandle = ui.mount(uiHost, {
      title: pet.title,
      hint: pet.hint,
      getBond: () => bond.getBond(),
      subscribeBond: (fn) => bond.subscribe(fn),
      onPet: () => pet.pet(),
      onJump: () => pet.jump(),
      onFeed: () => pet.feed(),
    });
  }

  let lastHover = null;
  function reportHover(hovering) {
    if (hovering === lastHover) return;
    lastHover = hovering;
    onHoverChange?.(hovering);
  }

  function fitCamera(width, height) {
    if (width <= 0 || height <= 0) return;
    camera.aspect = width / height;
    const need =
      (boundX + 0.7) /
      (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    const len = Math.max(cameraBaseLen, need);
    camera.position.copy(CAM_TARGET).addScaledVector(CAM_OFFSET, len / CAM_BASE_LEN);
    camera.lookAt(CAM_TARGET);
    camera.updateProjectionMatrix();
    if (scene.fog) {
      scene.fog.near = len + 3;
      scene.fog.far = len + 19;
    }
  }

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w <= 0 || h <= 0) return;
    renderer.setSize(w, h, false);
    fitCamera(w, h);
  }

  const ro = new ResizeObserver(() => resize());
  ro.observe(container);
  resize();

  const raycaster = new THREE.Raycaster();
  const pointer = { x: 0, y: 0 };
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();

  function setPointerFromEvent(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    return true;
  }

  function onPointerMove(e) {
    const overUi = !!e.target?.closest?.(UI_HOVER_SEL);
    if (!setPointerFromEvent(e)) {
      reportHover(overUi);
      return;
    }
    raycaster.setFromCamera(pointer, camera);
    let planeHit;
    if (raycaster.ray.intersectPlane(groundPlane, hit)) {
      hit.y = 1;
      planeHit = hit;
    }
    pet.onPointerMove?.({ pointer, raycaster, hit: planeHit });
    const hoveringPet = pet.hitTest?.(raycaster) ?? false;
    cursorTarget.style.cursor = hoveringPet || overUi ? 'pointer' : originalCursor;
    reportHover(hoveringPet || overUi);
  }

  function onPointerDown(e) {
    if (!petOnPointerDown) return;
    if (e.target.closest?.('.pet-page-actions, .pet-desktop-ui')) return;
    if (!setPointerFromEvent(e)) return;
    raycaster.setFromCamera(pointer, camera);
    if (pet.hitTest?.(raycaster)) pet.pet();
  }

  /** @returns {boolean} */
  function hitTestAtEvent(e) {
    if (!setPointerFromEvent(e)) return false;
    raycaster.setFromCamera(pointer, camera);
    return pet.hitTest?.(raycaster) ?? false;
  }

  function onPointerLeave() {
    reportHover(false);
    cursorTarget.style.cursor = originalCursor;
  }

  const originalCursor = cursorTarget.style.cursor;
  pointerTarget.addEventListener('pointermove', onPointerMove);
  pointerTarget.addEventListener('pointerdown', onPointerDown);
  pointerTarget.addEventListener('pointerleave', onPointerLeave);
  // Start click-through friendly until first hover
  reportHover(false);

  const clock = new THREE.Clock();
  let alive = true;

  renderer.setAnimationLoop(() => {
    if (!alive) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w <= 0 || h <= 0) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    pet.update(dt);
    particles.update(dt);
    renderer.render(scene, camera);
  });

  function dispose() {
    alive = false;
    renderer.setAnimationLoop(null);
    ro.disconnect();
    pointerTarget.removeEventListener('pointermove', onPointerMove);
    pointerTarget.removeEventListener('pointerdown', onPointerDown);
    pointerTarget.removeEventListener('pointerleave', onPointerLeave);
    cursorTarget.style.cursor = originalCursor;
    reportHover(false);
    uiHandle?.unmount?.();
    pet.dispose?.();
    particles.dispose();
    bond.dispose();
    ground.geometry.dispose();
    ground.material.dispose();
    renderer.dispose();
    if (renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  }

  return {
    dispose,
    getBond: () => bond.getBond(),
    canvas: renderer.domElement,
    scene,
    pet,
    hitTestAtEvent,
  };
}
