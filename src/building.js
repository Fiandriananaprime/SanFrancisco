
import { scene } from './main.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { WIDTHS } from '../width.js';
import { ASSETS } from './assets.js';
import { loadQuartier1 } from './tenderloin/quartier1.js';
import { loadParc } from './parc.js';
import { loadChinaTown } from './chinatown/chinatown.js';
const district = {
   tenderloin: {
        name : 'tenderloin',
        position:[200,0.5,200],
        loader:loadQuartier1()
    }
}
function loadBuildings() {
    loadChinaTown(0,0,0);
}
export {loadBuildings}