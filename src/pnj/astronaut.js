import * as THREE from 'three';
import { PNJ } from '../pnj.js';

export class Astronaut extends PNJ {
  constructor(scene, world) {
    super(scene, world, {
      url: '../../assets/pnj/Astronaut.glb',
      lockable: true,
      position: new THREE.Vector3(0, -0.48, 0),
      scale: 1,
    });
  }
}