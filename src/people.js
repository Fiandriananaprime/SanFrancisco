import * as THREE from "three";
import { ASSETS, getURL } from "./assets.js";
import { GLTFLoader } from "three/examples/jsm/Addons.js";
import { SkeletonUtils } from "three/examples/jsm/Addons.js";

const loader = new GLTFLoader();
const modelCache = new Map();

const positions = [];

function loadModel(asset) {
  return new Promise((resolve, reject) => {

    if (modelCache.has(asset)) {
      resolve(modelCache.get(asset));
      return;
    }

    loader.load(
      getURL(asset),
      (gltf) => {
        const scene = gltf.scene;
        modelCache.set(asset, scene);
        resolve(scene);
      },
      undefined,
      reject
    );
  });
}


function getValidPosition(minDist, radius, dimensionParam, maxTries = 60) {
  for (let i = 0; i < maxTries; i++) {
    const x = (Math.random() - 0.5) * dimensionParam.x;
    const z = (Math.random() - 0.5) * dimensionParam.z;

    const ok = positions.every((p) => {
      const dx = p.x - x;
      const dz = p.z - z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const required = (p.r || 0) + radius + minDist;
      return dist > required;
    });

    if (ok) {
      positions.push({ x, z, r: radius });
      return { x, z };
    }
  }

  const gridSize = Math.ceil(Math.sqrt(100));

  for (let gx = 0; gx < gridSize; gx++) {
    for (let gz = 0; gz < gridSize; gz++) {
      const x =
        -dimensionParam.x / 2 +
        (gx + 0.5) * (dimensionParam.x / gridSize);

      const z =
        -dimensionParam.z / 2 +
        (gz + 0.5) * (dimensionParam.z / gridSize);

      const ok = positions.every((p) => {
        const dx = p.x - x;
        const dz = p.z - z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const required = (p.r || 0) + radius + minDist;
        return dist > required;
      });

      if (ok) {
        positions.push({ x, z, r: radius });
        return { x, z };
      }
    }
  }

  return {
    x: (Math.random() - 0.5) * dimensionParam.x,
    z: (Math.random() - 0.5) * dimensionParam.z,
  };
}

export async function addPeople(scene, dimension, number) {
  const peopleAssets = ASSETS.people;
  const minDist = 1.0;

  positions.length = 0;

  if (!dimension || typeof dimension.x !== 'number' || typeof dimension.z !== 'number') {
    console.warn('people.addPeople: invalid dimension passed, using fallback 2000x2000', dimension);
    dimension = { x: 2000, z: 2000 };
  }

  const assetInfo = {}; // asset -> { base, size: Vector3, height }
  let targetHeight = 0;
  for (const asset of peopleAssets) {
    try {
      const base = await loadModel(asset);
      const tmpBox = new THREE.Box3().setFromObject(base);
      const tmpSize = new THREE.Vector3();
      tmpBox.getSize(tmpSize);
      const height = tmpSize.y || Math.max(tmpSize.x, tmpSize.z) || 1;
      assetInfo[asset] = { base, size: tmpSize.clone(), height };
      if (height > targetHeight) targetHeight = height;
    } catch (e) {
      console.warn('people: failed to load asset for sizing', asset, e);
    }
  }
  if (targetHeight <= 0) targetHeight = 1;
  function buildCandidates(dim, spacing) {
    const cols = Math.max(2, Math.floor(dim.x / spacing));
    const rows = Math.max(2, Math.floor(dim.z / spacing));
    const candidates = [];
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = -dim.x / 2 + (i + 0.5) * (dim.x / cols);
        const z = -dim.z / 2 + (j + 0.5) * (dim.z / rows);
        candidates.push({ x, z });
      }
    }
    return candidates;
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  const baseSpacing = minDist * 3;
  let candidates = buildCandidates(dimension, baseSpacing);
  shuffle(candidates);

  for (let i = 0; i < number; i++) {
    const asset = peopleAssets[Math.floor(Math.random() * peopleAssets.length)];
    const info = assetInfo[asset] || {};
    const base = info.base || (await loadModel(asset));

    const person = new THREE.Group();
    const model = SkeletonUtils.clone(base);
    person.add(model);

    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    model.scale.multiplyScalar(0.7)
    person.position.set(0, 0, 0);
    person.updateMatrixWorld(true);

  const bbox = new THREE.Box3().setFromObject(person);
  const size = new THREE.Vector3();
  bbox.getSize(size);

  const originalHeight = info.height || size.y || 1;
  const scaleFactor = targetHeight / originalHeight;
  model.scale.setScalar(scaleFactor);
  person.updateMatrixWorld(true);

  const bbox2 = new THREE.Box3().setFromObject(person);
  const size2 = new THREE.Vector3();
  bbox2.getSize(size2);
  const radius = Math.max(size2.x, size2.z) / 2 || 1.2;

    let chosen = null;
    for (let ci = 0; ci < candidates.length; ci++) {
      const c = candidates[ci];
      const ok = positions.every((p) => {
        const dx = p.x - c.x;
        const dz = p.z - c.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const required = (p.r || 0) + radius + minDist;
        return dist > required;
      });
      if (ok) {
        chosen = c;
        candidates.splice(ci, 1);
        break;
      }
    }

    let x, z;
    if (chosen) {
      x = chosen.x;
      z = chosen.z;
      positions.push({ x, z, r: radius });
    } else {
      const pos = getValidPosition(minDist, radius, dimension, 120);
      x = pos.x;
      z = pos.z;
      positions.push({ x, z, r: radius });
      console.warn('people: fallback placement used for person', i, 'radius', radius, 'pos', x, z);
    }

    try {
      person.name = `person-${i}`;
    } catch (e) {}

    
    person.position.set(x, 0.3, z);

    const rotY = Math.random() * Math.PI * 2;
    person.rotation.y = rotY;
    
    scene.add(person);

    
  }
}