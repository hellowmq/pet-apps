import { createTuanziPet } from '@pets/tuanzi';
import { createMaodiePet } from '@pets/maodie';

export const PET_IDS = ['tuanzi', 'maodie'];

/** @param {'tuanzi' | 'maodie'} id */
export function createPetById(id) {
  if (id === 'maodie') return createMaodiePet();
  return createTuanziPet();
}

/**
 * Camera activity half-width — must match Electron window aspect so roam stays on-screen.
 * Maodie walks; needs a wider framed stage than tuanzi.
 * @param {'tuanzi' | 'maodie'} id
 */
export function runtimeOptionsFor(id) {
  if (id === 'maodie') {
    return { boundX: 2.2 };
  }
  return { boundX: 1.2 };
}
