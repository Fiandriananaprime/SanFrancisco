import { GLTFLoader } from "three/examples/jsm/Addons.js";
import { scene } from "./main.js";
const loader = new GLTFLoader();

function loadParc(x,y,z) {
     loader.load(('../assets/parc/parc1.glb') ,
    (gltf) => {
        const quartier1 = gltf.scene;
        quartier1.scale.multiplyScalar(1.5)
        quartier1.position.set(x,y,z);
        scene.add(quartier1);
    })
}

export {loadParc}