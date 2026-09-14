import * as THREE from 'three';

const MAX_PARTICLES = 120;
const ACCENT = '#e2557b';

/**
 * Heart particle pool attached to a scene.
 * @param {import('three').Scene} scene
 */
export function createParticles(scene) {
  const heartGeo = new THREE.SphereGeometry(0.06, 8, 8);
  const heartMat = new THREE.MeshBasicMaterial({ color: ACCENT });
  const hearts = new THREE.InstancedMesh(heartGeo, heartMat, MAX_PARTICLES);
  hearts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(hearts);

  const pool = Array.from({ length: MAX_PARTICLES }, () => ({
    alive: false,
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    life: 0,
    maxLife: 1,
  }));
  const dummy = new THREE.Object3D();

  function burst(origin, count = 14) {
    let spawned = 0;
    for (const p of pool) {
      if (p.alive) continue;
      p.alive = true;
      p.pos.copy(origin);
      const a = Math.random() * Math.PI * 2;
      const up = 2.2 + Math.random() * 2.4;
      p.vel.set(Math.cos(a) * (0.6 + Math.random()), up, Math.sin(a) * (0.6 + Math.random()));
      p.life = 0;
      p.maxLife = 0.9 + Math.random() * 0.5;
      if (++spawned >= count) break;
    }
  }

  function update(dt) {
    let i = 0;
    for (const p of pool) {
      if (p.alive) {
        p.life += dt;
        if (p.life >= p.maxLife) p.alive = false;
        else {
          p.vel.y -= 5.5 * dt;
          p.pos.addScaledVector(p.vel, dt);
          const s = 1 - p.life / p.maxLife;
          dummy.position.copy(p.pos);
          dummy.scale.setScalar(Math.max(s, 0.001));
          dummy.updateMatrix();
          hearts.setMatrixAt(i, dummy.matrix);
        }
      }
      if (!p.alive) {
        dummy.position.set(0, -99, 0);
        dummy.scale.setScalar(0.001);
        dummy.updateMatrix();
        hearts.setMatrixAt(i, dummy.matrix);
      }
      i++;
    }
    hearts.instanceMatrix.needsUpdate = true;
  }

  function dispose() {
    scene.remove(hearts);
    heartGeo.dispose();
    heartMat.dispose();
    hearts.dispose();
  }

  return { burst, update, dispose };
}
