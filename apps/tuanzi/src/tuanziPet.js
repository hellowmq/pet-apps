import * as THREE from 'three';
import { gsap } from 'gsap';

const BODY_COLOR = '#ffd9a0';
const BODY_MAX_TURN = 0.55;

/**
 * Procedural 3D dumpling pet (团子).
 * @returns {import('@pet-apps/core').Pet}
 */
export function createTuanziPet() {
  /** @type {import('three').Scene | null} */
  let scene = null;
  /** @type {(n?: number) => void} */
  let addBond = () => {};
  /** @type {(o: THREE.Vector3, n?: number) => void} */
  let burst = () => {};

  const pet = new THREE.Group();
  const squash = new THREE.Group();
  pet.add(squash);

  function ball(r, color, x = 0, y = 0, z = 0, parent = squash) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(r, 32, 32),
      new THREE.MeshStandardMaterial({ color, roughness: 0.55 }),
    );
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  }

  const body = ball(1, BODY_COLOR, 0, 1, 0);
  body.scale.set(1, 0.92, 0.96);
  const belly = ball(0.55, '#ffeccf', 0, 0.58, 0.58);
  belly.scale.set(1.1, 0.95, 0.7);
  const earL = ball(0.28, BODY_COLOR, -0.54, 1.74, 0.06);
  const earR = ball(0.28, BODY_COLOR, 0.54, 1.74, 0.06);
  ball(0.13, '#f4a4b8', -0.54, 1.76, 0.2);
  ball(0.13, '#f4a4b8', 0.54, 1.76, 0.2);
  ball(0.24, BODY_COLOR, -0.78, 0.85, 0.45);
  ball(0.24, BODY_COLOR, 0.78, 0.85, 0.45);
  ball(0.3, BODY_COLOR, -0.42, 0.12, 0.25);
  ball(0.3, BODY_COLOR, 0.42, 0.12, 0.25);

  const eyeMat = new THREE.MeshStandardMaterial({ color: '#3a2c22', roughness: 0.3 });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.125, 20, 20), eyeMat);
  const eyeR = eyeL.clone();
  eyeL.position.set(-0.32, 1.22, 0.88);
  eyeR.position.set(0.32, 1.22, 0.88);
  squash.add(eyeL, eyeR);
  const hlMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  for (const eye of [eyeL, eyeR]) {
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 10), hlMat);
    hl.position.set(0.045, 0.05, 0.105);
    eye.add(hl);
  }

  const cheekL = ball(0.13, '#ff9eb0', -0.52, 1.05, 0.76);
  cheekL.scale.set(1, 0.7, 0.45);
  const cheekR = ball(0.13, '#ff9eb0', 0.52, 1.05, 0.76);
  cheekR.scale.set(1, 0.7, 0.45);

  const nose = ball(0.05, '#e2857b', 0, 1.08, 0.945);
  nose.scale.set(1.25, 0.8, 0.7);
  const mouthMat = new THREE.MeshStandardMaterial({ color: '#a8514a', roughness: 0.5 });
  for (const sx of [-1, 1]) {
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.017, 10, 20, Math.PI), mouthMat);
    lip.position.set(sx * 0.052, 1.03, 0.955);
    lip.rotation.x = Math.PI;
    squash.add(lip);
  }

  const state = { busy: false };
  const headWorld = new THREE.Vector3();
  const lookTarget = new THREE.Vector3(0, 1, 5);
  const smoothLook = new THREE.Vector3().copy(lookTarget);
  const attention = { x: 0, y: 0, tx: 0, ty: 0 };
  const EYE_L_BASE = new THREE.Vector3(-0.32, 1.22, 0.88);
  const EYE_R_BASE = new THREE.Vector3(0.32, 1.22, 0.88);

  /** @type {gsap.core.Tween[]} */
  const idleTweens = [];

  function happyJump(big = false) {
    if (state.busy) return;
    state.busy = true;
    headWorld.setFromMatrixPosition(body.matrixWorld);
    burst(headWorld, big ? 22 : 12);
    addBond(big ? 3 : 1);
    const h = big ? 1.6 : 0.9;
    gsap.timeline({ onComplete: () => { state.busy = false; } })
      .to(squash.scale, { x: 1.25, y: 0.72, z: 1.25, duration: 0.12, ease: 'power2.out' })
      .to(squash.scale, { x: 0.85, y: 1.2, z: 0.85, duration: 0.16, ease: 'power2.in' })
      .to(pet.position, { y: h, duration: 0.28, ease: 'power2.out' }, '<')
      .to(pet.rotation, { y: pet.rotation.y + Math.PI * 2, duration: 0.5, ease: 'power1.inOut' }, '<')
      .to(pet.position, { y: 0, duration: 0.3, ease: 'bounce.out' })
      .to(squash.scale, { x: 1, y: 1, z: 1, duration: 0.3, ease: 'elastic.out(1, 0.45)' }, '<');
  }

  function feed() {
    if (state.busy || !scene) return;
    state.busy = true;
    const cookie = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.08, 20),
      new THREE.MeshStandardMaterial({ color: '#c98d4b', roughness: 0.8 }),
    );
    cookie.castShadow = true;
    cookie.position.set(pet.position.x, 5, pet.position.z + 0.9);
    scene.add(cookie);
    gsap.timeline({
      onComplete: () => { state.busy = false; },
    })
      .to(cookie.position, { y: 0.35, duration: 0.45, ease: 'bounce.out' })
      .to(squash.scale, { x: 1.18, y: 0.8, z: 1.18, duration: 0.2, yoyo: true, repeat: 3 }, '+=0.15')
      .to(cookie.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.25 }, '-=0.3')
      .call(() => {
        scene.remove(cookie);
        cookie.geometry.dispose();
        cookie.material.dispose();
        headWorld.setFromMatrixPosition(body.matrixWorld);
        burst(headWorld, 18);
        addBond(2);
        gsap.timeline()
          .to(pet.position, { y: 0.7, duration: 0.24, ease: 'power2.out' })
          .to(pet.position, { y: 0, duration: 0.28, ease: 'bounce.out' });
      });
  }

  function startIdle() {
    idleTweens.push(
      gsap.to(squash.scale, { y: 1.05, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
    );
    (function blink() {
      if (!scene) return;
      gsap.to([eyeL.scale, eyeR.scale], {
        y: 0.08, duration: 0.07, yoyo: true, repeat: 1,
        onComplete: () => gsap.delayedCall(1.6 + Math.random() * 2.8, blink),
      });
    })();
    (function earWiggle() {
      if (!scene) return;
      gsap.to([earL.rotation, earR.rotation], {
        z: (i) => (i === 0 ? -0.25 : 0.25), duration: 0.3, yoyo: true, repeat: 3,
        onComplete: () => gsap.delayedCall(3 + Math.random() * 4, earWiggle),
      });
    })();
  }

  return {
    id: 'tuanzi',
    title: '团子 Tuanzi',
    hint: '移动鼠标它会被你吸引 · 点击它摸摸头',

    mount(ctx) {
      scene = ctx.scene;
      addBond = ctx.addBond;
      burst = ctx.burst;
      scene.add(pet);
      startIdle();
    },

    update(dt) {
      smoothLook.lerp(lookTarget, 1 - Math.exp(-6 * dt));
      if (!state.busy) {
        const dx = smoothLook.x - pet.position.x;
        const dz = smoothLook.z - pet.position.z;
        const targetRotY = THREE.MathUtils.clamp(Math.atan2(dx, dz), -BODY_MAX_TURN, BODY_MAX_TURN);
        const cur = pet.rotation.y;
        const wrapped = Math.atan2(Math.sin(targetRotY - cur), Math.cos(targetRotY - cur));
        pet.rotation.y = cur + wrapped * (1 - Math.exp(-8 * dt));
      }
      attention.x += (attention.tx - attention.x) * (1 - Math.exp(-7 * dt));
      attention.y += (attention.ty - attention.y) * (1 - Math.exp(-7 * dt));
      const ex = attention.x * 0.045;
      const ey = attention.y * 0.032;
      eyeL.position.set(EYE_L_BASE.x + ex, EYE_L_BASE.y + ey, EYE_L_BASE.z);
      eyeR.position.set(EYE_R_BASE.x + ex, EYE_R_BASE.y + ey, EYE_R_BASE.z);
      squash.rotation.z = -attention.x * 0.055;
      squash.rotation.x = -attention.y * 0.045;
    },

    onPointerMove({ pointer, hit }) {
      attention.tx = THREE.MathUtils.clamp(pointer.x, -1, 1);
      attention.ty = THREE.MathUtils.clamp(pointer.y, -0.8, 1);
      if (hit && hit.distanceTo(pet.position) < 9) lookTarget.copy(hit);
    },

    hitTest(raycaster) {
      return raycaster.intersectObject(squash, true).length > 0;
    },

    pet: () => happyJump(false),
    jump: () => happyJump(true),
    feed,

    dispose() {
      gsap.killTweensOf(squash.scale);
      gsap.killTweensOf(pet.position);
      gsap.killTweensOf(pet.rotation);
      gsap.killTweensOf([eyeL.scale, eyeR.scale]);
      gsap.killTweensOf([earL.rotation, earR.rotation]);
      for (const t of idleTweens) t.kill();
      idleTweens.length = 0;
      scene?.remove(pet);
      pet.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      scene = null;
    },
  };
}
