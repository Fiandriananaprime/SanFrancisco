import * as THREE from 'three';
import { PNJ } from '../pnj.js';

export class Farmer extends PNJ {
  constructor(scene, world) {
    super(scene, world, {
      url: '../../assets/pnj/Farmer.glb',
      lockable: false,
      position: new THREE.Vector3(0, -0.48, 0),
      scale: 1,
    });
  }
}