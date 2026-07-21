import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';




const dracoLoader = new DRACOLoader();


dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');





dracoLoader.setDecoderConfig({ type: 'wasm' });

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

export { gltfLoader, dracoLoader };
