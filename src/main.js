import * as THREE from 'three';

import { loadChinaTown } from './chinatown/chinatown.js';
import { addPeople } from './people.js';
import { dimension, loadPlateforme } from './plateforme.js';
import { loadHaight } from './haightassbury/haight.js';
import { loadFinancial } from './financial/financialDistrict.js';
import { createAdventurer, update } from './adventurer.js';
import { animateClouds } from './nuage.js';
import { loadParc } from './parc.js';
import { initiateCirculation } from './circultion.js';
import { loadPacific } from './pacificHeight/pacificHeight.js';
import { loadTenderloin } from './tenderloin/tenderloin.js';

export const scene = new THREE.Scene();

scene.background = new THREE.Color(0xa9c8e8);
scene.fog = new THREE.Fog(0xa9c8e8, 30, 500);

const clock = new THREE.Clock();

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);
camera.position.set(0, 3, -6);
camera.layers.enable(0); 

const MAP_VIEW_SIZE = 45; 
const miniCamera = new THREE.OrthographicCamera(
  -MAP_VIEW_SIZE,  
   MAP_VIEW_SIZE,  
   MAP_VIEW_SIZE,  
  -MAP_VIEW_SIZE,  
   0.1,            
   1000            
);

miniCamera.up.set(0, 1, 0); 
miniCamera.layers.enable(0); 
miniCamera.layers.enable(1); 
scene.add(miniCamera);

const canvas = document.getElementById("canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const minimapCanvas = document.getElementById("minimap-canvas");
const minimapRenderer = new THREE.WebGLRenderer({ canvas: minimapCanvas, antialias: true });
minimapRenderer.setSize(200, 200); 
minimapRenderer.outputEncoding = THREE.sRGBEncoding;

const sun = new THREE.DirectionalLight(0xfff1d2, 3.7);
sun.position.set(-280, 500, 220);
sun.castShadow = true;
scene.add(sun);

let player = null;
let lastPlayerPos = new THREE.Vector3();
let mapArrow = null;

function createMapArrow() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 8);         
  shape.lineTo(4.5, -4);      
  shape.lineTo(0, -1.5);      
  shape.lineTo(-4.5, -4);     
  shape.lineTo(0, 8);         

  const extrudeSettings = { depth: 1, bevelEnabled: false };
  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.MeshBasicMaterial({ 
    color: 'red', 
    depthTest: false 
  });
  
  mapArrow = new THREE.Mesh(geometry, material);
  mapArrow.renderOrder =999;
  mapArrow.layers.set(1); 
  scene.add(mapArrow);
}

let cameraYaw = 0;   
let cameraPitch = 0.2;  
let isMouseDown = false;
const MOUSE_SENSITIVITY = 0.005;
const RESET_SPEED = 3.0;

window.addEventListener('mousedown', (e) => {
  if (e.button === 0) isMouseDown = true;
});

window.addEventListener('mouseup', (e) => {
  if (e.button === 0) isMouseDown = false;
});

window.addEventListener('mousemove', (e) => {
  if (isMouseDown) {
    cameraYaw -= e.movementX * MOUSE_SENSITIVITY;
    cameraPitch += e.movementY * MOUSE_SENSITIVITY;
    cameraPitch = Math.max(-0.3, Math.min(1.2, cameraPitch));
  }
});

function updateCamera(delta) {
  if (!player) return;

  const isMoving = player.position.distanceToSquared(lastPlayerPos) > 0.0001;

  if (isMoving && !isMouseDown) {
    cameraYaw = THREE.MathUtils.lerp(cameraYaw, 0, RESET_SPEED * delta);
    cameraPitch = THREE.MathUtils.lerp(cameraPitch, 0.2, RESET_SPEED * delta);
  }

  lastPlayerPos.copy(player.position);

  const baseOffset = new THREE.Vector3(0, 2.5, -4);
  const combinedRotation = new THREE.Euler(
    player.rotation.x + cameraPitch,
    player.rotation.y + cameraYaw,
    player.rotation.z,
    'YXZ'
  );
  
  baseOffset.applyEuler(combinedRotation);
  const target = player.position.clone().add(baseOffset);

  camera.position.lerp(target, 0.08);
  camera.lookAt(player.position.x, player.position.y + 1.5, player.position.z);

  if (mapArrow) {
    mapArrow.position.set(player.position.x, player.position.y + 290, player.position.z);
    
    mapArrow.rotation.y = player.rotation.y + Math.PI; 
  }

  miniCamera.position.set(player.position.x, 300, player.position.z);
  miniCamera.lookAt(player.position.x, 0, player.position.z);
}

function animate() {
  const delta = clock.getDelta();

  update(delta, camera);            
  animateClouds(delta);     
  updateCamera(delta);          
  
  renderer.render(scene, camera);
  minimapRenderer.render(scene, miniCamera);
  
  requestAnimationFrame(animate);
}

async function initiateGame() {
  await loadPlateforme();
 // loadChinaTown(10, -0.9, 17);
  loadFinancial(300, 0, 30);
  loadHaight(-400, -0.4, 200);
  loadTenderloin(0, -0.3, 50);
  loadPacific(-100, 0, -900);
  initiateCirculation();

  createMapArrow();

  createAdventurer((adventurer) => {
    player = adventurer;
    lastPlayerPos.copy(player.position);
  });

  animate();
}



initiateGame();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});