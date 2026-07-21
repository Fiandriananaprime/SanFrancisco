import * as THREE from 'three';
import { gltfLoader } from '../loaders/dracoLoader.js';


export async function createLODModel(levels) {
  const lod = new THREE.LOD();

  const loaded = await Promise.all(
    levels.map(
      ({ url, distance }) =>
        new Promise((resolve, reject) => {
          gltfLoader.load(
            url,
            (gltf) => resolve({ mesh: gltf.scene, distance }),
            undefined,
            reject
          );
        })
    )
  );

  
  for (const { mesh, distance } of loaded) {
    lod.addLevel(mesh, distance);
  }

  return lod;
}


export function disposeLODModel(lod) {
  lod.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m) => m.dispose());
    }
  });
}
