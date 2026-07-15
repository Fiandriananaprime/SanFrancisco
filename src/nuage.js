import { dimension } from './plateforme.js';
import * as THREE from 'three';
import { scene } from './main.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const BASE_SPHERE = new THREE.SphereGeometry(1, 8, 8);
const CLOUD_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, roughness: 1 });

function createCloud3D(x, y, z) {
  const sphereCount = 6;
  const geoms = [];

  for (let i = 0; i < sphereCount; i++) {
    const scale = Math.random() * 0.6 + 0.8;
    const sx = scale * (Math.random() * 12 + 8);
    const sy = scale * (Math.random() * 8 + 6);
    const sz = scale * (Math.random() * 12 + 8);

    const geo = BASE_SPHERE.clone();
    const m = new THREE.Matrix4();
    m.makeScale(sx, sy, sz);
    const tx = Math.random() * 40 - 20;
    const ty = Math.random() * 15;
    const tz = Math.random() * 40 - 20;
    m.setPosition(new THREE.Vector3(tx, ty, tz));
    geo.applyMatrix4(m);
    geoms.push(geo);
  }

  const mergeFn = BufferGeometryUtils.mergeBufferGeometries || BufferGeometryUtils.mergeGeometries || (BufferGeometryUtils.default && (BufferGeometryUtils.default.mergeBufferGeometries || BufferGeometryUtils.default.mergeGeometries));
  if (!mergeFn) throw new Error('No merge function found on BufferGeometryUtils');
  const merged = mergeFn(geoms, false);
  const mesh = new THREE.Mesh(merged, CLOUD_MATERIAL);
  mesh.position.set(x, y, z);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  scene.add(mesh);
  return mesh;
}

let clouds=[];
function animateClouds(delta) {
  
    for (let i = 0; i < clouds.length; i++) {
      clouds[i].position.x += 0.05 * delta;
  
      if (clouds[i].position.x > dimension.x/2) {
        clouds[i].position.x = -dimension.x/2;
      }
    }
  
}
export { createCloud3D ,animateClouds};