import { createPetRuntime, pageUi } from '@pet-apps/core';
import '@pet-apps/core/ui.css';
import { createMaodiePet } from './maodiePet.js';

const container = document.querySelector('#app');
createPetRuntime({
  container,
  pet: createMaodiePet(),
  ui: pageUi,
  boundX: 3.6,
  background: '#fdf6ec',
});
