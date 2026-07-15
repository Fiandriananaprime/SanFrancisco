import { GLTFLoader } from "three/examples/jsm/Addons.js";
import { scene } from "../main";
export function loadChunk1(x,y,z){
    const loader=new GLTFLoader();

    loader.load("../assets/financialDistrict/zone1.glb" ,
        (gltf) => {
            const zone1 = gltf.scene;
            zone1.position.set(x,y,z);
            scene.add(zone1);
        }
    )
}