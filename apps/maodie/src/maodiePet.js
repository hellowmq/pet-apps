import * as THREE from 'three';
import { gsap } from 'gsap';

/** Fallback when host omits boundX (matches page host). */
const MD_BOUND_DEFAULT = 3.6;
/** Camera fitCamera pads boundX by this; keep sprite inside framed half-width. */
const CAM_FRAME_PAD = 0.7;
const BASE = import.meta.env.BASE_URL;

/**
 * 2.5D sprite 圆头耄耋.
 * @returns {import('@pet-apps/core').Pet}
 */
export function createMaodiePet() {
  /** @type {import('three').Scene | null} */
  let scene = null;
  /** @type {(n?: number) => void} */
  let addBond = () => {};
  /** @type {(o: THREE.Vector3, n?: number) => void} */
  let burst = () => {};

  const texLoader = new THREE.TextureLoader();
  function loadTex(p) {
    const t = texLoader.load(BASE + p);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const loadSeq = (dir, n) => Array.from({ length: n }, (_, i) => loadTex(`maodie/${dir}/${i + 1}.png`));

  const MD_TEX = {
    calm: [loadTex('maodie/calm.png')],
    walk: loadSeq('walk', 16),
    hiss: loadSeq('hiss', 13),
    spider: loadSeq('spider', 14),
    ride: loadSeq('ride', 4),
  };
  const MD_FORM = {
    calm: [1.0, 1.2, 0],
    walk: [139 / 84, 1.0, 12],
    hiss: [1.0, 1.35, 13],
    spider: [163 / 87, 0.95, 14],
    ride: [35 / 40, 1.15, 8],
  };

  const maodieG = new THREE.Group();
  const mdMat = new THREE.MeshBasicMaterial({
    map: MD_TEX.walk[0],
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mdPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mdMat);
  maodieG.add(mdPlane);

  const mdShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 24),
    new THREE.MeshBasicMaterial({ color: '#5b4a3a', transparent: true, opacity: 0.18 }),
  );
  mdShadow.rotation.x = -Math.PI / 2;
  mdShadow.position.y = 0.01;
  maodieG.add(mdShadow);

  const md = {
    form: 'walk',
    frame: 0,
    animT: 0,
    x: 0,
    y: 0,
    vy: 0,
    dir: 1,
    speed: 1.1,
    scareT: 0,
    busy: false,
    jumpChance: 0.5,
    rideT: 0,
    /** @type {number} activity half-width from runtime */
    boundX: MD_BOUND_DEFAULT,
  };

  const headWorld = new THREE.Vector3();
  let hissTween = null;
  let hissCall = null;
  let feedTimeline = null;
  let cookie = null;

  /** Max |x| for pet center so the sprite stays inside the camera frame. */
  function walkBound() {
    const [aspect, h] = MD_FORM[md.form];
    const spriteHalf = (h * aspect) / 2;
    return Math.max(0.35, md.boundX + CAM_FRAME_PAD - spriteHalf - 0.05);
  }

  function clampWalkX() {
    const lim = walkBound();
    if (md.x > lim) {
      md.x = lim;
      md.dir = -1;
    } else if (md.x < -lim) {
      md.x = -lim;
      md.dir = 1;
    }
  }

  function mdSetForm(form) {
    md.form = form;
    md.frame = 0;
    md.animT = 0;
    const [aspect, h] = MD_FORM[form];
    mdPlane.scale.set(h * aspect, h, 1);
    mdPlane.position.y = h / 2;
    mdMat.map = MD_TEX[form][0];
    mdShadow.scale.setScalar(Math.max(h * aspect * 0.55, 0.6));
    clampWalkX();
  }

  function mdBurstAtHead() {
    headWorld.set(md.x, MD_FORM[md.form][1] * 0.9 + md.y, 0);
    burst(headWorld, 14);
  }

  function maodieHiss() {
    if (md.busy) return;
    md.busy = true;
    mdSetForm('hiss');
    hissTween = gsap.fromTo(mdPlane.position, { x: -0.05 }, {
      x: 0.05, duration: 0.06, yoyo: true, repeat: 9,
      onComplete: () => { mdPlane.position.x = 0; },
    });
    mdBurstAtHead();
    addBond(1);
    hissCall = gsap.delayedCall(13 / 13 + 0.15, () => { mdSetForm('walk'); md.busy = false; hissCall = null; });
  }

  function maodieScareJump() {
    if (md.busy) return;
    md.busy = true;
    mdSetForm('spider');
    md.vy = 4.2;
    mdBurstAtHead();
    addBond(1);
  }

  function maodieFeed() {
    if (md.busy || !scene) return;
    md.busy = true;
    cookie = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.08, 20),
      new THREE.MeshStandardMaterial({ color: '#c98d4b', roughness: 0.8 }),
    );
    cookie.castShadow = true;
    cookie.position.set(md.x + md.dir * 0.9, 5, 0);
    scene.add(cookie);
    feedTimeline = gsap.timeline({ onComplete: () => { feedTimeline = null; } })
      .to(cookie.position, { y: 0.35, duration: 0.45, ease: 'bounce.out' })
      .to(cookie.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.25 }, '+=0.35')
      .call(() => {
        scene.remove(cookie);
        cookie.geometry.dispose();
        cookie.material.dispose();
        cookie = null;
        mdBurstAtHead();
        addBond(2);
        mdSetForm('ride');
        md.rideT = 2.2;
      });
  }

  return {
    id: 'maodie',
    title: '圆头耄耋 Maodie',
    hint: '鼠标靠近它会加速逃跑 · 点它就对你哈气',

    mount(ctx) {
      scene = ctx.scene;
      addBond = ctx.addBond;
      burst = ctx.burst;
      md.boundX = typeof ctx.boundX === 'number' ? ctx.boundX : MD_BOUND_DEFAULT;
      mdSetForm('walk');
      md.busy = false;
      md.y = 0;
      md.vy = 0;
      md.x = 0;
      scene.add(maodieG);
    },

    update(dt) {
      const [, , fps] = MD_FORM[md.form];
      if (fps > 0) {
        md.animT += dt;
        const frames = MD_TEX[md.form];
        if (md.animT >= 1 / fps) {
          md.animT %= 1 / fps;
          md.frame = md.form === 'hiss'
            ? Math.min(md.frame + 1, frames.length - 1)
            : (md.frame + 1) % frames.length;
          mdMat.map = frames[md.frame];
        }
      }

      if (md.form === 'ride') {
        md.rideT -= dt;
        if (md.rideT <= 0) { mdSetForm('walk'); md.busy = false; }
      }

      if (md.form !== 'hiss') {
        const mul = md.form === 'ride' ? 3.2 : (md.scareT > 0 ? 2.2 : 1);
        md.x += md.dir * md.speed * mul * dt;
        clampWalkX();
      }
      if (md.scareT > 0) md.scareT -= dt;

      if (md.y > 0 || md.vy !== 0) {
        md.vy -= 9 * dt;
        md.y += md.vy * dt;
        if (md.y <= 0) {
          md.y = 0;
          md.vy = 0;
          if (md.form === 'spider') { mdSetForm('walk'); md.busy = false; }
        }
      } else if (!md.busy && Math.random() < md.jumpChance * dt) {
        md.vy = 2.2 + Math.random() * 1.4;
      }

      maodieG.position.set(md.x, md.y, 0);
      mdPlane.scale.x = Math.abs(mdPlane.scale.x) * (md.dir > 0 ? -1 : 1);
      mdShadow.position.y = 0.01 - md.y;
      mdShadow.material.opacity = Math.max(0.05, 0.18 - md.y * 0.06);
      const baseR = Math.max(MD_FORM[md.form][1] * MD_FORM[md.form][0] * 0.55, 0.6);
      mdShadow.scale.setScalar(Math.max(0.4, baseR * (1 - md.y * 0.12)));
    },

    onPointerMove({ hit }) {
      if (hit && Math.abs(hit.x - md.x) < 1.3 && Math.abs(hit.z) < 1.5) {
        md.scareT = 0.8;
        md.dir = hit.x > md.x ? -1 : 1;
      }
    },

    hitTest(raycaster) {
      return raycaster.intersectObject(mdPlane, false).length > 0;
    },

    pet: maodieHiss,
    jump: maodieScareJump,
    feed: maodieFeed,

    dispose() {
      hissTween?.kill();
      hissCall?.kill();
      feedTimeline?.kill();
      if (cookie) {
        scene?.remove(cookie);
        cookie.geometry.dispose();
        cookie.material.dispose();
        cookie = null;
      }
      gsap.killTweensOf(mdPlane.position);
      scene?.remove(maodieG);
      mdPlane.geometry.dispose();
      mdMat.dispose();
      mdShadow.geometry.dispose();
      mdShadow.material.dispose();
      for (const frames of Object.values(MD_TEX)) {
        for (const t of frames) t.dispose();
      }
      scene = null;
    },
  };
}
