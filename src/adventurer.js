import { GLTFLoader } from "three/examples/jsm/Addons.js";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { getURL, ASSETS } from "./assets.js";
import { scene } from "./main.js";
import { world } from "./plateforme.js";

const loader = new GLTFLoader();
const mixers = [];
let mixer = null;
let adventurer = null;
let velocity = 0.25;
const actions = {};
let currentAction = null;

let positionSprite = null;
let positionCanvas = null;
let positionContext = null;

let characterBody = null;
let characterCollider = null;
let characterController = null;
const CAPSULE_HALF_HEIGHT = 0.6;
const CAPSULE_RADIUS = 0.35;
const GRAVITY_Y = -9.81;
let verticalVelocity = 0;

const keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    running: false,
    super: false,
    rolling: false
};

let moveDir = new THREE.Vector3();
let counterCombo = 0;
let isAttacking = false;

function initCharacterPhysics(spawnPos) {
    if (!world) {
        console.warn("world Rapier introuvable : initPhysics() a-t-il été appelé avant createAdventurer() ?");
        return;
    }

    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(spawnPos.x, spawnPos.y + CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS, spawnPos.z);
    characterBody = world.createRigidBody(bodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.capsule(CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS)
        .setFriction(0.7);
    characterCollider = world.createCollider(colliderDesc, characterBody);

    characterController = world.createCharacterController(0.01); // offset de contact
    characterController.setApplyImpulsesToDynamicBodies(true);
    characterController.setMaxSlopeClimbAngle(45 * Math.PI / 180);
    characterController.setMinSlopeSlideAngle(30 * Math.PI / 180);
    characterController.enableAutostep(0.4, 0.2, true);
    characterController.enableSnapToGround(0.3);
}

function attack() {
    if (isAttacking || keys.rolling) return;
    isAttacking = true;
    counterCombo++;
    let anim = "";

    switch (counterCombo) {
        case 1:
        case 3:
        case 7:
        case 9:
            anim = "CharacterArmature|Punch_Left";
            break;
        case 2:
        case 4:
        case 6:
        case 8:
            anim = "CharacterArmature|Punch_Right";
            break;
        case 5:
            anim = "CharacterArmature|Kick_Left";
            break;
        case 10:
            anim = "CharacterArmature|Kick_Right";
            break;
    }

    if (counterCombo > 10) {
        counterCombo = 1;
        anim = "CharacterArmature|Punch_Left";
    }

    const action = actions[anim];
    if (!action) {
        isAttacking = false;
        return;
    }

    mixer.removeEventListener("finished", onAttackFinished);
    mixer.removeEventListener("finished", onRollFinished);

    if (currentAction) {
        currentAction.fadeOut(0.1);
    }

    action.reset();
    action.timeScale = 1.5;
    action.setLoop(THREE.LoopOnce);
    action.clampWhenFinished = true;
    action.fadeIn(0.1);
    action.play();
    currentAction = action;

    mixer.addEventListener("finished", onAttackFinished);
}

function onAttackFinished(e) {
    if (e.action !== currentAction) return;
    mixer.removeEventListener("finished", onAttackFinished);
    isAttacking = false;

    if (keys.forward || keys.backward || keys.left || keys.right) {
        playMovement(keys.running ? "CharacterArmature|Run" : "CharacterArmature|Walk");
    } else {
        playMovement("CharacterArmature|Idle");
    }
}

function onRollFinished(e) {
    if (e.action !== currentAction) return;
    mixer.removeEventListener("finished", onRollFinished);
    keys.rolling = false;

    if (keys.forward || keys.backward || keys.left || keys.right) {
        playMovement(keys.running ? "CharacterArmature|Run" : "CharacterArmature|Walk");
    } else {
        playMovement("CharacterArmature|Idle");
    }
}

function createPositionText() {
    positionCanvas = document.createElement('canvas');
    positionCanvas.width = 256;
    positionCanvas.height = 64;
    positionContext = positionCanvas.getContext('2d');

    const texture = new THREE.CanvasTexture(positionCanvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    positionSprite = new THREE.Sprite(material);

    positionSprite.position.set(0, 2, 0);
    positionSprite.scale.set(2, 0.5, 1);

    adventurer.add(positionSprite);
}

function updatePositionText() {
    if (!adventurer || !positionContext || !positionSprite) return;

    const x = adventurer.position.x.toFixed(2);
    const z = adventurer.position.z.toFixed(2);
    const text = `X: ${x} | Z: ${z}`;

    positionContext.clearRect(0, 0, positionCanvas.width, positionCanvas.height);
    positionContext.font = "Bold 24px Arial";
    positionContext.fillStyle = "rgba(0, 0, 0, 0.5)";
    positionContext.fillRect(10, 10, 236, 44);

    positionContext.fillStyle = "#ffffff";
    positionContext.textAlign = "center";
    positionContext.textBaseline = "middle";
    positionContext.fillText(text, positionCanvas.width / 2, positionCanvas.height / 2);

    positionSprite.material.map.needsUpdate = true;
}

function createAdventurer(onReady) {
    loader.load(getURL(ASSETS.people[1]), (gltf) => {
        adventurer = gltf.scene;
        adventurer.position.set(0, 3, 0);
        adventurer.scale.multiplyScalar(1)
        scene.add(adventurer);

        initCharacterPhysics(adventurer.position);

        mixer = new THREE.AnimationMixer(adventurer);
        mixers.push(mixer);

        gltf.animations.forEach((clip) => {
            actions[clip.name] = mixer.clipAction(clip);
        });

        createPositionText();
        playMovement("CharacterArmature|Idle");
        if (onReady) onReady(adventurer);
    });
}

function rolling() {
    if (keys.rolling || isAttacking) return;
    keys.rolling = true;

    const action = actions["CharacterArmature|Roll"];
    if (!action) {
        keys.rolling = false;
        return;
    }

    mixer.removeEventListener("finished", onAttackFinished);
    mixer.removeEventListener("finished", onRollFinished);

    if (currentAction) {
        currentAction.fadeOut(0.1);
    }

    action.reset();
    action.timeScale = 2;
    action.setLoop(THREE.LoopOnce);
    action.clampWhenFinished = true;
    action.fadeIn(0.1);
    action.play();
    currentAction = action;

    mixer.addEventListener("finished", onRollFinished);
}

function playMovement(name) {
    const next = actions[name];
    if (!next) return;
    if (currentAction === next) return;

    mixer.removeEventListener("finished", onAttackFinished);
    mixer.removeEventListener("finished", onRollFinished);

    if (currentAction) currentAction.fadeOut(0.15);

    next.reset();
    next.setLoop(THREE.LoopRepeat, Infinity);
    next.fadeIn(0.15);
    next.play();
    currentAction = next;
}

function moveUpdate(camera) {
    if (isAttacking || keys.rolling) return;
    if (!adventurer || !camera) return;

    const forwardInput = keys.forward;
    const backwardInput = keys.backward;
    const leftInput = keys.left;
    const rightInput = keys.right;
    const hasInput = forwardInput || backwardInput || leftInput || rightInput;

    if (!hasInput) {
        playMovement("CharacterArmature|Idle");
        moveDir.set(0, 0, 0);
        return;
    }

    const camForward = new THREE.Vector3();
    camera.getWorldDirection(camForward);
    camForward.y = 0;
    camForward.normalize();

    const camRight = new THREE.Vector3()
        .crossVectors(camForward, new THREE.Vector3(0, 1, 0))
        .normalize();

    moveDir.set(0, 0, 0);

    if (forwardInput) moveDir.add(camForward);
    if (backwardInput) moveDir.sub(camForward);
    if (leftInput) moveDir.sub(camRight);
    if (rightInput) moveDir.add(camRight);

    if (moveDir.lengthSq() === 0) {
        playMovement("CharacterArmature|Idle");
        return;
    }

    moveDir.normalize();

    if (!keys.running) {
        playMovement("CharacterArmature|Walk");
    } else {
        playMovement("CharacterArmature|Run");
    }

    let targetRotation = Math.atan2(moveDir.x, moveDir.z);
    let diff = targetRotation - adventurer.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    adventurer.rotation.y += diff * 0.10;
}

 
function applyPhysicsMovement(delta) {
    if (!characterController || !characterBody || !adventurer) return;

    const speed = keys.rolling ? 0.35 : velocity;
    const desired = new THREE.Vector3();

    if (keys.rolling && moveDir.lengthSq() > 0) {
        desired.copy(moveDir).multiplyScalar(speed);
    } else if (!isAttacking && !keys.rolling) {
        desired.copy(moveDir).multiplyScalar(speed);
    }

    verticalVelocity += GRAVITY_Y * delta;
    const grounded = characterController.computedGrounded();
    if (grounded && verticalVelocity < 0) {
        verticalVelocity = 0;
    }
    desired.y = verticalVelocity * delta;

    characterController.computeColliderMovement(characterCollider, desired);
    const correctedMovement = characterController.computedMovement();

    const currentPos = characterBody.translation();
    const newPos = {
        x: currentPos.x + correctedMovement.x,
        y: currentPos.y + correctedMovement.y,
        z: currentPos.z + correctedMovement.z
    };
    characterBody.setNextKinematicTranslation(newPos);

    adventurer.position.set(
        newPos.x,
        newPos.y - CAPSULE_HALF_HEIGHT - CAPSULE_RADIUS,
        newPos.z
    );
}

window.addEventListener("keydown", (e) => {
    switch (e.code) {
        case "KeyW":
        case "ArrowUp":
        case "Numpad8":
            keys.forward = true;
            break;
        case "KeyS":
        case "ArrowDown":
        case "Numpad2":
            keys.backward = true;
            break;
        case "KeyA":
        case "ArrowLeft":
        case "Numpad4":
            keys.left = true;
            break;
        case "KeyD":
        case "ArrowRight":
        case "Numpad6":
            keys.right = true;
            break;
        case "ShiftLeft":
        case "ShiftRight":
            velocity = 2;
            keys.running = true;
            break;
        case "Space":
            rolling();
            break;
        case "KeyR":
            attack();
            break;
    }
});

window.addEventListener("keyup", (e) => {
    switch (e.code) {
        case "KeyW":
        case "ArrowUp":
        case "Numpad8":
            keys.forward = false;
            break;
        case "KeyS":
        case "ArrowDown":
        case "Numpad2":
            keys.backward = false;
            break;
        case "KeyA":
        case "ArrowLeft":
        case "Numpad4":
            keys.left = false;
            break;
        case "KeyD":
        case "ArrowRight":
        case "Numpad6":
            keys.right = false;
            break;
        case "ShiftLeft":
            velocity = 0.1;
            keys.running = false;
            break;
    }
});

function update(delta, camera) {
    if (world) {
        world.step(); 
    }
    mixers.forEach(m => m.update(delta));
    moveUpdate(camera);
    applyPhysicsMovement(delta);
    updatePositionText();
}

export {
    createAdventurer,
    update,
    playMovement
};