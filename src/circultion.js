import { GLTFLoader } from "three/examples/jsm/Addons.js";
import { scene } from "./main";
import { getURL } from "./assets";

const Loader=new GLTFLoader()
function initiateCirculation() {
    Loader.load(getURL("Van.glb") ,
    (gltf) => {
        const van= gltf.scene;
        van.position.set(-30,0.2,70);
        van.rotateY(Math.PI/2)
        scene.add(van)
    }
)}

export {initiateCirculation}