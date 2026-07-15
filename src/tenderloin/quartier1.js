import { GLTFLoader } from "three/examples/jsm/Addons.js";
import { scene } from "../main.js";
import { addRoadMapping } from "../road.js";
const loader = new GLTFLoader();

function loadQuartier1(x, y, z) {
    const center = [x,z]
    const map=[
  {
    "points": [
      [
        -63.76,
        -55.7
      ],
      [
        67.86,
        -55.93
      ]
    ],
    "type": 1,
    "width": 11
  },
  {
    "points": [
      [
        67.85,
        -61.43
      ],
      [
        68.1,
        60.05
      ]
    ],
    "type": 1,
    "width": 11
  },
  {
    "points": [
      [
        73.6,
        60.06
      ],
      [
        -64.69,
        59.82
      ]
    ],
    "type": 1,
    "width": 11
  },
  {
    "points": [
      [
        -64.74,
        65.32
      ],
      [
        -63.71,
        -61.2
      ]
    ],
    "type": 1,
    "width": 11
  }
]
    loader.load(('../assets/Tenderloin/quartier1.glb'),
        (gltf) => {
            const quartier1 = gltf.scene;
            quartier1.position.set(x, y, z);
            scene.add(quartier1);
        })
        addRoadMapping(center,map)
}
export { loadQuartier1 }