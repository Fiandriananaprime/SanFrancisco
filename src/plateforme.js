import * as THREE from 'three';
import { scene } from './main.js';
import { Water } from 'three/examples/jsm/Addons.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { createCloud3D } from './nuage.js';
import RAPIER from '@dimforge/rapier3d-compat';

const dimension = {
    x: 3000,
    y: 1,
    z: 3000
};

let world = null;
let groundBody = null;
let groundCollider = null;

 
async function initPhysics() {
  await RAPIER.init(); 
  world = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 });
  return world;
}

function loadGround() {
    const cubeGeo = new THREE.CylinderGeometry(
      dimension.x / 2,
      dimension.z / 2,
      1,
      32
    )

    const cubeMat = new THREE.MeshBasicMaterial({ color: "green" })
    const waterGeometry = new THREE.CircleGeometry(
      dimension.x,
      32
    );

    const water = new Water(waterGeometry, {
      textureWidth: 1024,
      textureHeight: 1024,
      waterNormals: new THREE.TextureLoader().load(
        'https://threejs.org/examples/textures/waternormals.jpg',
        function (texture) {
          texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        }
      ),
      sunDirection: new THREE.Vector3(),
      sunColor: 0xffffff,
      waterColor: 0x001e0f,
      distortionScale: 3.7,
      fog: scene.fog !== undefined
    });
    const sky = new Sky();
    sky.scale.setScalar(10000);

    sky.material.uniforms['turbidity'].value = 5;
    sky.material.uniforms['rayleigh'].value = 0.5;
    sky.material.uniforms['mieCoefficient'].value = 0.005;
    sky.material.uniforms['mieDirectionalG'].value = 0.8;

    if (sky.material) {
      sky.material.side = THREE.BackSide;
      sky.material.depthWrite = false;
      sky.renderOrder = -1;
    }
    water.rotation.x = -Math.PI / 2;
    water.position.y = -1;
    scene.add(sky);
    scene.add(water);

    const cube = new THREE.Mesh(
      cubeGeo,
      cubeMat
    )
    cube.position.y = -1
    scene.add(cube);

    if (world) {
      const halfHeight = 0.5; 
      const radius = dimension.x / 2;

      const groundBodyDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(0, cube.position.y, 0);
      groundBody = world.createRigidBody(groundBodyDesc);

      const groundColliderDesc = RAPIER.ColliderDesc.cylinder(halfHeight, radius)
        .setFriction(1)
        .setRestitution(0);
      groundCollider = world.createCollider(groundColliderDesc, groundBody);
    } else {
      console.warn("initPhysics() n'a pas été appelé avant loadGround(): pas de collider créé.");
    }

    const ambient = new THREE.HemisphereLight(0xe8f6ff, 0x61705a, 1.8);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff1d2, 3.7);
    sun.position.set(-280, 500, 220);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 30;
    sun.shadow.camera.far = 1200;
    sun.shadow.camera.left = -620;
    sun.shadow.camera.right = 620;
    sun.shadow.camera.top = 620;
    sun.shadow.camera.bottom = -620;
    scene.add(sun);

    if (sky && sky.material && sky.material.uniforms && sky.material.uniforms['sunPosition']) {
      sky.material.uniforms['sunPosition'].value.copy(sun.position);
    }

    if (water && water.material && water.material.uniforms && water.material.uniforms['sunDirection']) {
      const dir = sun.position.clone().normalize();
      water.material.uniforms['sunDirection'].value.copy(dir);
      if (water.material.uniforms['sunDirection']) water.material.needsUpdate = true;
      water.visible = true;
    }
}

let clouds = [];
function loadNuage() {
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * dimension.x - dimension.x / 2;
    const y = 500;
    const z = Math.random() * dimension.z - dimension.z / 2;
    clouds.push(createCloud3D(x, y, z));
  }
}

async function loadPlateforme() {
  await initPhysics();
  loadGround();
  loadNuage();
}

export { loadPlateforme, dimension, world, initPhysics, groundBody, groundCollider };