import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const MOVE_SPEED = 4; 
const RUN_MULTIPLIER = 2;


const ANIM = {
  idle: 'idle',
  walk: 'walk',
  run: 'run',
};



const ATTACK_START_LEFT = ['attaque_gauche_1', 'attaque_droite_1', 'attaque_gauche_2', 'attaque_droite_2'];
const ATTACK_START_RIGHT = ['attaque_droite_1', 'attaque_gauche_1', 'attaque_droite_2', 'attaque_gauche_2'];

export class Adventurer {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world; 

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

    this.model = null;
    this.mixer = null;
    this.actions = {};
    this.currentAction = null;

    this.keys = { forward: false, back: false, left: false, right: false, run: false };

    
    this.attackCombo = 0;
    this.attackStartFoot = 'left';
    this.isAttacking = false;

    this._bindInput();
  }

  async load(url) {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(url);

    this.model = gltf.scene;
    this.model.traverse((c) => { if (c.isMesh) c.castShadow = true; });
    this.scene.add(this.model);

    this.mixer = new THREE.AnimationMixer(this.model);
    for (const clip of gltf.animations) {
      this.actions[clip.name] = this.mixer.clipAction(clip);
    }

    
    
    

    this._playAction(ANIM.idle);
    return this.model;
  }

  _playAction(name, { loop = THREE.LoopRepeat, fade = 0.2 } = {}) {
    const next = this.actions[name];
    if (!next || next === this.currentAction) return;

    next.reset();
    next.setLoop(loop, loop === THREE.LoopOnce ? 1 : Infinity);
    next.clampWhenFinished = loop === THREE.LoopOnce;
    next.fadeIn(fade);
    this.currentAction?.fadeOut(fade);
    next.play();
    this.currentAction = next;
  }

  _bindInput() {
    window.addEventListener('keydown', (e) => this._onKey(e, true));
    window.addEventListener('keyup', (e) => this._onKey(e, false));
  }

  _onKey(e, pressed) {
    switch (e.code) {
      
      case 'ArrowUp':
      case 'KeyZ':
        this.keys.forward = pressed;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.keys.back = pressed;
        break;
      case 'ArrowLeft':
      case 'KeyQ':
        this.keys.left = pressed;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.keys.right = pressed;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.run = pressed;
        break;
      case 'KeyR':
        if (pressed) this._triggerAttack();
        break;
    }
  }

  _triggerAttack() {
    const sequence = this.attackStartFoot === 'left' ? ATTACK_START_LEFT : ATTACK_START_RIGHT;
    const clipName = sequence[this.attackCombo];

    this.isAttacking = true;
    this._playAction(clipName, { loop: THREE.LoopOnce });

    this.attackCombo++;
    if (this.attackCombo >= sequence.length) {
      this.attackCombo = 0;
      this.attackStartFoot = this.attackStartFoot === 'left' ? 'right' : 'left';
    }

    const clip = this.actions[clipName]?.getClip();
    const duration = clip ? clip.duration * 1000 : 500;
    setTimeout(() => { this.isAttacking = false; }, duration);
  }

  update(delta) {
    this.mixer?.update(delta);
    if (!this.model || this.isAttacking) {
      this._updateCamera();
      return;
    }

    const direction = new THREE.Vector3();
    if (this.keys.forward) direction.z -= 1;
    if (this.keys.back) direction.z += 1;
    if (this.keys.left) direction.x -= 1;
    if (this.keys.right) direction.x += 1;

    const moving = direction.lengthSq() > 0;
    if (moving) {
      direction.normalize();
      const speed = MOVE_SPEED * (this.keys.run ? RUN_MULTIPLIER : 1) * delta;

      
      
      this.model.position.addScaledVector(direction, speed);
      this.model.rotation.y = Math.atan2(direction.x, direction.z);

      this._playAction(this.keys.run ? ANIM.run : ANIM.walk);
    } else {
      this._playAction(ANIM.idle);
    }

    this._updateCamera();
  }

  _updateCamera() {
    if (!this.model) return;
    const offset = new THREE.Vector3(0, 2.5, 5).applyQuaternion(this.model.quaternion);
    const desired = this.model.position.clone().add(offset);
    this.camera.position.lerp(desired, 0.15);
    this.camera.lookAt(this.model.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
  }
}
