/**
 * @typedef {object} PetContext
 * @property {import('three').Scene} scene
 * @property {import('three').Camera} camera
 * @property {HTMLElement} container
 * @property {number} boundX  // camera activity half-width; roam should stay within framed area
 * @property {(n?: number) => void} addBond
 * @property {(origin: import('three').Vector3, count?: number) => void} burst
 */

/**
 * @typedef {object} Pet
 * @property {string} id
 * @property {string} title
 * @property {string} hint
 * @property {(ctx: PetContext) => void} mount
 * @property {(dt: number) => void} update
 * @property {() => void} dispose
 * @property {() => void} pet
 * @property {() => void} jump
 * @property {() => void} feed
 * @property {(raycaster: import('three').Raycaster) => boolean} [hitTest]
 * @property {(args: { pointer: {x:number,y:number}, raycaster: import('three').Raycaster, hit?: import('three').Vector3 }) => void} [onPointerMove]
 */

/**
 * @typedef {object} RuntimeOptions
 * @property {HTMLElement} container
 * @property {Pet} pet
 * @property {{ mount: Function } | null} [ui]
 * @property {number} [boundX]
 * @property {string} [background]
 */

export {};
