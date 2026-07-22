import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const MOVE_SPEED = 4;
const RUN_MULTIPLIER = 3;
const TURN_SPEED = 1;

const ANIM = {
  idle: 'CharacterArmature|Idle',
  walk: 'CharacterArmature|Walk',
  run: 'CharacterArmature|Run',
  run_back: 'CharacterArmature|Run_Back',
  run_left: 'CharacterArmature|Run_Left',
  run_right: 'CharacterArmature|Run_Right',
};

const ATTACK_START_LEFT = [
  'CharacterArmature|Punch_Left',
  'CharacterArmature|Punch_Right',
  'CharacterArmature|Kick_Left',
  'CharacterArmature|Kick_Right'
];

const ATTACK_START_RIGHT = [
  'CharacterArmature|Punch_Right',
  'CharacterArmature|Punch_Left',
  'CharacterArmature|Kick_Right',
  'CharacterArmature|Kick_Left'
];

export class Adventurer {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    this.model = null;
    this.mixer = null;
    this.actions = {};
    this.animations = [];
    this.currentAction = null;

    this.rigidBody = null;
    this.collider = null;

    this.keys = {
      forward: false,
      back: false,
      left: false,
      right: false,
      run: false
    };

    this.targetRotation = 0;

    this.isLockedOn = false;
    this.lockedTarget = null;

    this.attackCombo = 0;
    this.attackStartFoot = 'left';
    this.isAttacking = false;

    this.cameraAngleX = 0;
    this.isLeftMouseDown = false;
    this.previousMousePosition = { x: 0, y: 0 };

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.hoveredPNJ = null;

    const dot = document.createElement('div');
    dot.style.position = 'fixed';
    dot.style.width = '10px';
    dot.style.height = '10px';
    dot.style.borderRadius = '50%';
    dot.style.background = 'yellow';
    dot.style.pointerEvents = 'none';
    dot.style.transform = 'translate(-50%, -50%)';
    dot.style.display = 'none';
    dot.style.zIndex = '9999';
    document.body.appendChild(dot);

    this.lockDot = dot;

    this._bindInput();
  }

  async load(url) {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(url);

    this.model = gltf.scene;
    this.animations = gltf.animations;

    this.model.traverse((c) => {
      if (c.isMesh) c.castShadow = true;
    });

    this.scene.add(this.model);

    this.mixer = new THREE.AnimationMixer(this.model);

    for (const clip of gltf.animations) {
      this.actions[clip.name] = this.mixer.clipAction(clip);
    }

    this._playAction(ANIM.idle);

    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(0, 0, 0);

    this.rigidBody = this.world.createRigidBody(bodyDesc);

    this.collider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(0.9, 0.35),
      this.rigidBody
    );

    return gltf;
  }

  _playAction(name, { loop = THREE.LoopRepeat, fade = 0.2 } = {}) {
    const next = this.actions[name];
    if (!next || next === this.currentAction) return;

    next.reset();
    next.setLoop(loop, loop === THREE.LoopOnce ? 1 : Infinity);
    next.clampWhenFinished = loop === THREE.LoopOnce;
    next.fadeIn(fade);

    if (this.currentAction) {
      this.currentAction.fadeOut(fade);
    }

    next.play();
    this.currentAction = next;
  }

  _bindInput() {
    window.addEventListener('keydown', (e) => this._onKey(e, true));
    window.addEventListener('keyup', (e) => this._onKey(e, false));

    window.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isLeftMouseDown = true;
        this.previousMousePosition = { x: e.clientX, y: e.clientY };
      }

      if (e.button === 2) {
        if (this.isLockedOn) {
          this.isLockedOn = false;
          this.lockedTarget = null;
        } else if (this.hoveredPNJ) {
          this.isLockedOn = true;
          this.lockedTarget = this.hoveredPNJ.model;
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isLeftMouseDown = false;
      }
    });

    window.addEventListener('mousemove', (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

      if (this.isLeftMouseDown) {
        const deltaX = e.clientX - this.previousMousePosition.x;
        this.cameraAngleX -= deltaX * 0.005;
        this.previousMousePosition = { x: e.clientX, y: e.clientY };
      }

      this._updateHover();
    });
  }

  _onKey(e, pressed) {
    switch (e.code) {
      case 'Numpad8':
      case 'ArrowUp':
      case 'KeyZ':
      case 'KeyW':
        this.keys.forward = pressed;
        break;

      case 'Numpad4':
      case 'ArrowLeft':
      case 'KeyQ':
      case 'KeyA':
        this.keys.left = pressed;
        break;

      case 'Numpad6':
      case 'ArrowRight':
      case 'KeyD':
        this.keys.right = pressed;
        break;

      case 'Numpad2':
      case 'ArrowDown':
      case 'KeyS':
        this.keys.back = pressed;
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

  _updateHover() {
  if (!this.camera) return;

  this.raycaster.setFromCamera(this.mouse, this.camera);

  let bestPNJ = null;
  let bestDistance = Infinity;

  for (const collider of this.world.colliders.getAll()) {
    const data = collider.userData;

    if (!data?.lockable || data.type !== 'pnj') continue;

    const pnj = data.instance;

    const center = pnj.model.position.clone();
    center.y += 1.2;

    const sphere = new THREE.Sphere(center, 1.8);

    const hitPoint = new THREE.Vector3();

    if (this.raycaster.ray.intersectSphere(sphere, hitPoint)) {
      const distance = this.raycaster.ray.origin.distanceTo(hitPoint);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestPNJ = pnj;
      }
    }
  }

  if (!bestPNJ) {
    this.hoveredPNJ = null;
    this.lockDot.style.display = 'none';
    return;
  }

  this.hoveredPNJ = bestPNJ;

  const pos = bestPNJ.model.position.clone();
  pos.y += 1.5;

  const screen = pos.project(this.camera);

  this.lockDot.style.left =
    ((screen.x + 1) / 2) * window.innerWidth + 'px';

  this.lockDot.style.top =
    ((-screen.y + 1) / 2) * window.innerHeight + 'px';

  this.lockDot.style.display = 'block';
}

  _findPNJFromModel(model) {
    for (const collider of this.world.colliders.getAll()) {
      const data = collider.userData;

      if (data?.type === 'pnj' && data.instance.model === model) {
        return data.instance;
      }
    }

    return null;
  }

  _triggerAttack() {
    const sequence =
      this.attackStartFoot === 'left'
        ? ATTACK_START_LEFT
        : ATTACK_START_RIGHT;

    const clipName = sequence[this.attackCombo];

    this.isAttacking = true;

    this._playAction(clipName, {
      loop: THREE.LoopOnce,
      fade: 0.1
    });

    this.attackCombo++;

    if (this.attackCombo >= sequence.length) {
      this.attackCombo = 0;
      this.attackStartFoot =
        this.attackStartFoot === 'left' ? 'right' : 'left';
    }

    const clip = this.actions[clipName]?.getClip();
    const duration = clip ? clip.duration * 1000 : 800;

    setTimeout(() => {
      this.isAttacking = false;
    }, duration);
  }

  update(delta) {
    this.mixer?.update(delta);

    if (!this.model || !this.rigidBody) return;

    if (this.isAttacking) {
      this._syncFromPhysics();
      this._updateCamera();
      return;
    }

    const speed =
      MOVE_SPEED *
      (this.keys.run ? RUN_MULTIPLIER : 1) *
      delta;

    const moveVector = new THREE.Vector3();

    if (this.isLockedOn && this.lockedTarget) {
      const toTarget = new THREE.Vector3()
        .subVectors(this.lockedTarget.position, this.model.position);

      toTarget.y = 0;

      this.targetRotation = Math.atan2(toTarget.x, toTarget.z);

      const forwardDir = toTarget.clone().normalize();
      const rightDir = new THREE.Vector3()
        .crossVectors(forwardDir, new THREE.Vector3(0, 1, 0))
        .normalize();

      let currentAnim = ANIM.idle;

      if (this.keys.forward) {
        moveVector.add(forwardDir);
        currentAnim = ANIM.run;
      }

      if (this.keys.back) {
        moveVector.sub(forwardDir);
        currentAnim = ANIM.run_back;
      }

      if (this.keys.left) {
        moveVector.sub(rightDir);
        currentAnim = ANIM.run_left;
      }

      if (this.keys.right) {
        moveVector.add(rightDir);
        currentAnim = ANIM.run_right;
      }

      if (moveVector.lengthSq() > 0) {
        moveVector.normalize();
        this._moveKinematic(moveVector, speed);
        this._playAction(currentAnim);
      } else {
        this._playAction(ANIM.idle);
      }

    } else {
      const cameraForward = new THREE.Vector3();
      this.camera.getWorldDirection(cameraForward);
      cameraForward.y = 0;
      cameraForward.normalize();

      const cameraRight = new THREE.Vector3()
        .crossVectors(this.camera.up, cameraForward)
        .normalize();

      if (this.keys.forward) moveVector.add(cameraForward);
      if (this.keys.left) moveVector.add(cameraRight);
      if (this.keys.right) moveVector.sub(cameraRight);

      if (moveVector.lengthSq() > 0) {
        moveVector.normalize();

        this.cameraAngleX = THREE.MathUtils.lerp(
          this.cameraAngleX,
          0,
          0.1
        );

        this.targetRotation = Math.atan2(
          moveVector.x,
          moveVector.z
        );

        this._moveKinematic(moveVector, speed);

        this._playAction(
          this.keys.run ? ANIM.run : ANIM.walk
        );
      } else {
        this._playAction(ANIM.idle);
      }
    }

    const currentRotation = this.model.rotation.y;

    const diff = Math.atan2(
      Math.sin(this.targetRotation - currentRotation),
      Math.cos(this.targetRotation - currentRotation)
    );

    this.model.rotation.y += diff * TURN_SPEED * delta;

    const q = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this.model.rotation.y
    );

    this.rigidBody.setNextKinematicRotation({
      x: q.x,
      y: q.y,
      z: q.z,
      w: q.w,
    });

    this._syncFromPhysics();
    this._updateCamera();
  }

  _moveKinematic(direction, distance) {
    const t = this.rigidBody.translation();

    this.rigidBody.setNextKinematicTranslation({
      x: t.x + direction.x * distance,
      y: t.y,
      z: t.z + direction.z * distance,
    });
  }

  _syncFromPhysics() {
    const t = this.rigidBody.translation();
    this.model.position.set(t.x, t.y, t.z);
  }

  _updateCamera() {
    if (!this.model) return;

    const baseOffset = new THREE.Vector3(0, 2.5, -5);

    if (this.cameraAngleX !== 0) {
      baseOffset.applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        this.cameraAngleX
      );
    }

    const offset = baseOffset.applyQuaternion(this.model.quaternion);

    const desired = this.model.position.clone().add(offset);

    this.camera.position.lerp(desired, 0.2);

    this.camera.lookAt(
      this.model.position.clone().add(new THREE.Vector3(0, 1.5, 0))
    );
  }
}