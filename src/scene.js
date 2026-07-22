import * as THREE from 'three';



export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fd0ff);


const hemi = new THREE.HemisphereLight(0xffffff, 0x445566, 1.1);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(80, 120, 40);
sun.castShadow = true;
scene.add(sun);

export const clock = new THREE.Clock();
