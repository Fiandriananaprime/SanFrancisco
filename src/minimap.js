import * as THREE from 'three';
import { scene } from './scene.js';




const container = document.getElementById('minimap-container');
const SIZE = 180; 

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(SIZE, SIZE);
container.appendChild(renderer.domElement);

const VIEW_HALF_EXTENT = 60; 
const camera = new THREE.OrthographicCamera(
  -VIEW_HALF_EXTENT, VIEW_HALF_EXTENT,
  VIEW_HALF_EXTENT, -VIEW_HALF_EXTENT,
  0.1, 500
);
camera.up.set(0, 0, -1); 
camera.position.set(0, 200, 0);
camera.lookAt(0, 0, 0);

let target = null; 

export function followTarget(object3D) {
  target = object3D;
}

function renderMinimap() {
  if (target) {
    camera.position.set(target.position.x, 200, target.position.z);
    camera.lookAt(target.position.x, 0, target.position.z);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(renderMinimap);
}

renderMinimap();
