import { GLTFLoader } from "three/examples/jsm/Addons.js";
import { scene } from "../main";
import { addRoadMapping } from "../road";
export function loadZone1(x,y,z){
    const loader =new GLTFLoader();
    const center =[x,z];
    const map = [
  {
    "points": [
      [
        -224.91,
        -345.41
      ],
      [
        -224.91,
        -210.37
      ]
    ],
    "type": 2,
    "width": 39
  },
  {
    "points": [
      [
        -224.91,
        -210.37
      ],
      [
        -38.74,
        -210.73
      ]
    ],
    "type": 2,
    "width": 39
  },
  {
    "points": [
      [
        -38.74,
        -210.73
      ],
      [
        -38.74,
        -44.02
      ]
    ],
    "type": 2,
    "width": 39
  },
  {
    "points": [
      [
        -38.74,
        -44.02
      ],
      [
        -39.71,
        127.5
      ]
    ],
    "type": 2,
    "width": 39
  },
  {
    "points": [
      [
        -39.71,
        127.5
      ],
      [
        -36.82,
        282.65
      ]
    ],
    "type": 2,
    "width": 39
  },
  {
    "points": [
      [
        -40.02,
        -210.73
      ],
      [
        -39.03,
        -335.15
      ]
    ],
    "type": 2,
    "width": 39
  },
  {
    "points": [
      [
        -41.58,
        -210.72
      ],
      [
        165.13,
        -212.25
      ]
    ],
    "type": 2,
    "width": 39
  },
  {
    "points": [
      [
        163.94,
        -212.24
      ],
      [
        168.67,
        -39.79
      ]
    ],
    "type": 2,
    "width": 39
  },
  {
    "points": [
      [
        -38.74,
        -44.02
      ],
      [
        168.64,
        -40.98
      ]
    ],
    "type": 2,
    "width": 39
  },
  {
    "points": [
      [
        168.67,
        -39.79
      ],
      [
        341.52,
        -41.78
      ]
    ],
    "type": 2,
    "width": 39
  },
  {
    "points": [
      [
        168.67,
        -39.79
      ],
      [
        169.92,
        126.36
      ]
    ],
    "type": 2,
    "width": 39
  },
  {
    "points": [
      [
        169.92,
        126.36
      ],
      [
        -39.71,
        127.5
      ]
    ],
    "type": 2,
    "width": 39
  },
  {
    "points": [
      [
        169.92,
        126.36
      ],
      [
        346.82,
        125.24
      ]
    ],
    "type": 2,
    "width": 39
  },
  {
    "points": [
      [
        169.92,
        126.36
      ],
      [
        170.84,
        288.05
      ]
    ],
    "type": 2,
    "width": 39
  },
  {
    "points": [
      [
        163.94,
        -212.24
      ],
      [
        164.38,
        -358.06
      ]
    ],
    "type": 2,
    "width": 39
  },
  {
    "points": [
      [
        163.94,
        -212.24
      ],
      [
        338.05,
        -214.95
      ]
    ],
    "type": 2,
    "width": 39
  },
  {
    "points": [
      [
        -39.71,
        127.5
      ],
      [
        -234.99,
        124.03
      ]
    ],
    "type": 2,
    "width": 39
  },
  {
    "points": [
      [
        -234.99,
        124.03
      ],
      [
        -435.43,
        124.03
      ]
    ],
    "type": 2,
    "width": 39
  },
  {
    "points": [
      [
        -234.99,
        124.03
      ],
      [
        -234.99,
        -53.28
      ]
    ],
    "type": 2,
    "width": 39
  },
  {
    "points": [
      [
        -234.99,
        -53.28
      ],
      [
        -224.91,
        -210.37
      ]
    ],
    "type": 2,
    "width": 39
  },
  {
    "points": [
      [
        -38.74,
        -44.02
      ],
      [
        -234.99,
        -53.28
      ]
    ],
    "type": 2,
    "width": 39
  },
  {
    "points": [
      [
        -234.99,
        -53.28
      ],
      [
        -408.95,
        -50.72
      ]
    ],
    "type": 2,
    "width": 39
  },
  {
    "points": [
      [
        -224.91,
        -210.37
      ],
      [
        -413.19,
        -212.67
      ]
    ],
    "type": 2,
    "width": 39
  },
  {
    "points": [
      [
        -234.99,
        124.03
      ],
      [
        -233.23,
        292.54
      ]
    ],
    "type": 2,
    "width": 39
  }
]
    loader.load("../assets/haightHashburry/advanced.glb" ,
        (gltf) =>{
            const zone = gltf.scene;
            zone.position.set(x,y,z);
            scene.add(zone);
        }
    )
    addRoadMapping(center,map)
}