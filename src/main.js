import * as THREE from 'three';
import { scene, clock } from './scene.js';
import { initPhysics, getWorld } from './physics.js';
import { createPlatform } from './plateforme.js';
import { Adventurer } from './adventurer.js';
import { followTarget } from './minimap.js';
import { Astronaut } from './pnj/astronaut.js';
import { Farmer } from './pnj/farmer.js';
const container = document.getElementById('main-container');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

let adventurer;
let astronaut;
let farmer;
async function init() {
  await initPhysics();
  const world = getWorld();

  createPlatform(scene, world);
   astronaut = new Astronaut(scene, world);
   farmer = new Farmer(scene, world);
  await farmer.load();
  await astronaut.load();
  adventurer = new Adventurer(scene, world);
  await adventurer.load('../assets/cityPack/Player.glb');
  adventurer.model.scale.multiplyScalar(1);
  followTarget(adventurer.model);

  

  
  

  window.addEventListener('resize', onResize);
  renderer.setAnimationLoop(animate);
}

function onResize() {
  adventurer.camera.aspect = window.innerWidth / window.innerHeight;
  adventurer.camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.1); 

  getWorld().step();
  adventurer.update(delta);
  astronaut.update();
  farmer.update();
  renderer.render(scene, adventurer.camera);
}

init();
