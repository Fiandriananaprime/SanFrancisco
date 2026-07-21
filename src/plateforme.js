import * as THREE from 'three';
import { RAPIER } from './physics.js';
import { addClouds } from './nuage.js';

const width = 200;
const length = 200;


export function createPlatform(scene, world) {
  const radius = Math.min(width, length) / 2;

  
  const oceanGeo = new THREE.PlaneGeometry(width * 4, length * 4);
  const oceanMat = new THREE.MeshStandardMaterial({ color: 0x1d6fa5, roughness: 0.25, metalness: 0.1 });
  const ocean = new THREE.Mesh(oceanGeo, oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = -0.6;
  ocean.receiveShadow = true;
  scene.add(ocean);

  
  const platformGeo = new THREE.CylinderGeometry(radius, radius, 1, 64);
  const platformMat = new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: 0.9 });
  const platform = new THREE.Mesh(platformGeo, platformMat);
  platform.position.y = -0.5;
  platform.receiveShadow = true;
  scene.add(platform);

  
  if (world) {
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0);
    const body = world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cylinder(0.5, radius);
    world.createCollider(colliderDesc, body);
  }

  addClouds(scene, { count: 40, height: 60, spread: width * 2.5 });

  return { ocean, platform, radius, width, length };
}
