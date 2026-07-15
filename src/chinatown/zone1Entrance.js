import { scene } from "../main";
import { GLTFLoader } from "three/examples/jsm/Addons.js";
import { addRoadMapping } from "../road";

const loader =new GLTFLoader();

function loadEntrance(x,y,z){
    const center=[x,z];
    const mapRoad =[
  {
    "points": [
      [
        -103.31,
        -39.14
      ],
      [
        104.21,
        -39.61
      ]
    ],
    "type": 2,
    "width":52
  },
  {
    "points": [
      [
        104.21,
        -39.61
      ],
      [
        104.21,
        58.86
      ]
    ],
    "type": 2,
    "width": 52
  },
  {
    "points": [
      [
        104.21,
        58.86
      ],
      [
        -104.05,
        58.47
      ]
    ],
    "type": 2,
    "width": 52
  },
  {
    "points": [
      [
        -104.05,
        58.47
      ],
      [
        -103.31,
        -39.14
      ]
    ],
    "type": 2,
    "width": 52
  }
]
    loader.load('../assets/chinaTown/zone1Entrance.glb',
        (gltf) =>{
            const entrance = gltf.scene;
            entrance.position.set(x,y,z)
            scene.add(entrance)
            console.log(entrance)
        }
    )
    addRoadMapping(center,mapRoad)
}
export {loadEntrance}