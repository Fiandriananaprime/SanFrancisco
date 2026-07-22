import * as THREE from 'three';
import { scene } from './scene.js';

const container = document.getElementById('minimap-container');
const SIZE = 190;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(SIZE, SIZE);
renderer.autoClear = false;
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

const hudScene = new THREE.Scene();
const hudCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
hudCamera.position.z = 5;

const arrowShape = new THREE.Shape();

arrowShape.moveTo(0, 0.22);        
arrowShape.lineTo(-0.16, -0.14);  
arrowShape.lineTo(0.16, -0.14);   
arrowShape.lineTo(0, 0.22);       

const arrowGeometry = new THREE.ShapeGeometry(arrowShape);
const arrowMaterial = new THREE.MeshBasicMaterial({
  color: 0xff2a2a,
  transparent: true,
  opacity: 1,
  depthTest: false,
  depthWrite: false
});

const playerArrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
playerArrow.scale.set(0.8, 0.8, 1);
playerArrow.position.set(0, 0, 0);
hudScene.add(playerArrow);

let target = null;

export function followTarget(object3D) {
  target = object3D;
}

function renderMinimap() {
  if (target) {
    camera.position.set(target.position.x, 200, target.position.z);
    camera.lookAt(target.position.x, 0, target.position.z);

    playerArrow.rotation.z = target.rotation.y;
  }

  renderer.clear();
  renderer.render(scene, camera);
  renderer.clearDepth();
  renderer.render(hudScene, hudCamera);

  requestAnimationFrame(renderMinimap);
}

renderMinimap();