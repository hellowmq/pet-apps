import { createPetRuntime, pageUi } from '@pet-apps/core';
import '@pet-apps/core/ui.css';
import { createTuanziPet } from './tuanziPet.js';

const container = document.querySelector('#app');
createPetRuntime({
  container,
  pet: createTuanziPet(),
  ui: pageUi,
  boundX: 2.5,
  background: '#fdf6ec',
});
