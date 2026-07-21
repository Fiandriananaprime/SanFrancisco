import * as THREE from 'three';
import { scene, clock } from './scene.js';
import { initPhysics, getWorld } from './physics.js';
import { createPlatform } from './plateforme.js';
import { Adventurer } from './adventurer.js';
import { DistrictManager } from './world/districtManager.js';
import { districts } from './world/districts.config.js';
import { followTarget } from './minimap.js';

const container = document.getElementById('main-container');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

let adventurer;
let districtManager;

async function init() {
  await initPhysics();
  const world = getWorld();

  createPlatform(scene, world);

  adventurer = new Adventurer(scene, world);
  await adventurer.load('/models/adventurer.glb');
  followTarget(adventurer.model);

  districtManager = new DistrictManager(scene, districts);

  
  

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
  districtManager.update(adventurer.model.position);

  renderer.render(scene, adventurer.camera);
}

init();
