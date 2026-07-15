import { GLTFLoader } from "three/examples/jsm/Addons.js";
import { getURL } from "./assets.js";
import { scene } from "./main.js";
import * as THREE from "three";

const assets = [
    
    "european_dragon.glb",
    "squelette guerrier 3d.glb",
    "medieval castle 3d model.glb"
];

const loader = new GLTFLoader();

const mixers = [];

function loadDragon() {
    loader.load(
        getURL(assets[0]),
        (gltf) => {
            const dragon = gltf.scene;

            dragon.position.set(100, 0.1, 100);
            dragon.scale.multiplyScalar(5);

            const mixer = new THREE.AnimationMixer(dragon);
            mixers.push(mixer);

            console.log("Animations disponibles :");

            gltf.animations.forEach((clip, i) => {
                console.log(i, clip.name);
            });

            
            if (gltf.animations.length > 0) {
                const action = mixer.clipAction(gltf.animations[0]);
                action.play();
            }

            scene.add(dragon);
        }
    );
}

function update(delta) {
    mixers.forEach((mixer) => mixer.update(delta));
}

export { loadDragon, update };