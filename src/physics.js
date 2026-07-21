import RAPIER from '@dimforge/rapier3d-compat';

let world = null;
let initPromise = null;

export function initPhysics({ gravity = { x: 0, y: -9.81, z: 0 } } = {}) {
  if (initPromise) return initPromise;

  initPromise = RAPIER.init().then(() => {
    world = new RAPIER.World(gravity);
    return world;
  });

  return initPromise;
}

export function getWorld() {
  if (!world) {
    throw new Error('Physics world pas encore initialisé — appelle initPhysics() avant.');
  }
  return world;
}

export { RAPIER };
