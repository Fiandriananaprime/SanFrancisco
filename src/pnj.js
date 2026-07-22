import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as RAPIER from '@dimforge/rapier3d-compat';

export class PNJ {
  constructor(scene, world, {
    url,
    lockable = true,
    position = new THREE.Vector3(0, 0, 0),
    scale = 1,
  }) {
    this.scene = scene;
    this.world = world;

    this.url = url;
    this.lockable = lockable;
    this.position = position.clone();
    this.scale = scale;

    this.model = null;
    this.mixer = null;
    this.animations = [];
    this.actions = {};
    this.currentAction = null;

    this.rigidBody = null;
    this.collider = null;

    
    this.state = 'idle';
    this.stateTimer = 0;

    this.moveSpeed = 1.2;
    this.moveDirection = new THREE.Vector3();
    this.targetRotation = 0;

    this.origin = this.position.clone();
    this.wanderRadius = 6;

    this.loader = new GLTFLoader();
  }

  async load() {
    const gltf = await this.loader.loadAsync(this.url);

    this.model = gltf.scene;
    this.animations = gltf.animations;

    
    this.model.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });

    
    this.model.scale.setScalar(this.scale);

    
    this.model.position.copy(this.position);

    this.scene.add(this.model);

    
    if (this.animations.length > 0) {
      this.mixer = new THREE.AnimationMixer(this.model);

      for (const clip of this.animations) {
        this.actions[clip.name] = this.mixer.clipAction(clip);
      }
    }

    
    const box = new THREE.Box3().setFromObject(this.model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    box.getSize(size);
    box.getCenter(center);

    

    
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(center.x, center.y, center.z);

    this.rigidBody = this.world.createRigidBody(bodyDesc);

    
    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      size.x / 2,
      size.y / 2,
      size.z / 2
    );

    this.collider = this.world.createCollider(colliderDesc, this.rigidBody);

    
    this.collider.userData = {
      type: 'pnj',
      instance: this,
      lockable: this.lockable,
    };

    
    this.playIdle();

    return this;
  }

  
  
  

  playAnimation(name) {
    const action = this.actions[name];
    if (!action) return;

    if (this.currentAction === action) return;

    this.currentAction?.fadeOut(0.2);

    action.reset();
    action.fadeIn(0.2);
    action.play();

    this.currentAction = action;
  }

  playIdle() {
    const idle =
      this.actions['Idle'] ||
      this.actions['CharacterArmature|Idle'];

    if (idle) this.playAnimation(idle.getClip().name);
  }

  playWalk() {
    const walk =
      this.actions['Walk'] ||
      this.actions['CharacterArmature|Walk'];

    if (walk) this.playAnimation(walk.getClip().name);
  }

  
  
  

  _chooseNextState() {
    
    if (Math.random() < 0.4) {
      this.state = 'idle';
      this.stateTimer = 1 + Math.random() * 3; 
      this.playIdle();
      return;
    }

    
    this.state = 'walk';
    this.stateTimer = 2 + Math.random() * 5; 

    const angle = Math.random() * Math.PI * 2;

    this.moveDirection.set(
      Math.sin(angle),
      0,
      Math.cos(angle)
    ).normalize();

    this.targetRotation = Math.atan2(
      this.moveDirection.x,
      this.moveDirection.z
    );

    this.playWalk();
  }

  
  
  

  update(delta = 1 / 60) {
    if (!this.model || !this.rigidBody) return;

    
    if (this.stateTimer <= 0) {
      this._chooseNextState();
    }

    this.stateTimer -= delta;

    if (this.state === 'walk') {
      const currentPos = this.getPosition();

      
      const toOrigin = this.origin.clone().sub(currentPos);
      toOrigin.y = 0;

      if (toOrigin.length() > this.wanderRadius) {
        this.moveDirection.copy(toOrigin.normalize());

        this.targetRotation = Math.atan2(
          this.moveDirection.x,
          this.moveDirection.z
        );
      }

      const nextPos = currentPos.clone().addScaledVector(
        this.moveDirection,
        this.moveSpeed * delta
      );

      
      this.rigidBody.setNextKinematicTranslation({
        x: nextPos.x,
        y: nextPos.y,
        z: nextPos.z,
      });

      
      const currentY = this.model.rotation.y;

      const diff = Math.atan2(
        Math.sin(this.targetRotation - currentY),
        Math.cos(this.targetRotation - currentY)
      );

      this.model.rotation.y += diff * 4 * delta;

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
    }

    
    const t = this.rigidBody.translation();
    const r = this.rigidBody.rotation();

    this.model.position.set(t.x, t.y, t.z);
    this.model.quaternion.set(r.x, r.y, r.z, r.w);

    
    this.mixer?.update(delta);
  }

  
  
  

  getPosition() {
    const t = this.rigidBody.translation();

    return new THREE.Vector3(t.x, t.y, t.z);
  }

  setPosition(x, y, z) {
    this.rigidBody.setTranslation({ x, y, z }, true);
  }

  setRotationY(angle) {
    const q = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      angle
    );

    this.rigidBody.setRotation({
      x: q.x,
      y: q.y,
      z: q.z,
      w: q.w,
    }, true);
  }

  dispose() {
    if (this.collider) this.world.removeCollider(this.collider, true);
    if (this.rigidBody) this.world.removeRigidBody(this.rigidBody);

    if (this.model) {
      this.scene.remove(this.model);

      this.model.traverse((obj) => {
        obj.geometry?.dispose();

        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    }
  }
}