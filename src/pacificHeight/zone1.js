import { scene } from "../main";
import { GLTFLoader } from "three/examples/jsm/Addons.js";
export function loadZone1(x,y,z){
    const loader = new GLTFLoader();

    loader.load("../assets/pacific/zone1.glb" ,
        (gltf) => {
            const zone1 = gltf.scene;
            zone1.position.set(x,y,z);
            scene.add(zone1);
        }
    )
}