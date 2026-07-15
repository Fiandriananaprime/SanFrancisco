import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const style = document.createElement('style');
style.textContent = `
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  canvas {
    display: block;
  }
`;
document.head.appendChild(style);
const ASSETS = "../assets/haightHashburry/advanced.glb";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa0a0a0);

const viewSize = 50;
const camera = new THREE.OrthographicCamera(
  -viewSize * (window.innerWidth / window.innerHeight), viewSize * (window.innerWidth / window.innerHeight),
  viewSize, -viewSize,
  0.1, 10000
);
const cameraTarget = new THREE.Vector3(0, 0, 0);
const cameraHeight = 200;
camera.up.set(0, 0, -1);
updateCameraPosition();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

const floorGeo = new THREE.PlaneGeometry(20000, 20000);
floorGeo.rotateX(-Math.PI / 2);
const floorMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
const floor = new THREE.Mesh(floorGeo, floorMat);
scene.add(floor);

function getRoadWidth(type) {
  return type === 1 ? 15 : 39;
}

let currentWidthType = 1;
let startPoint = null;
const createdSegments = [];

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let selectedSegment = null;
let isDraggingRoute = false;
let dragOffset = new THREE.Vector3();
let dragStartSnapshot = null;

let transformMode = 'none';
let scaleConstraint = 'uniform';
let transformSnapshot = null;

let isPanning = false;
let previousMousePosition = { x: 0, y: 0 };

let modalOpen = false;

const undoStack = [];
const MAX_UNDO = 100;
function pushUndo(fn) {
  undoStack.push(fn);
  if (undoStack.length > MAX_UNDO) undoStack.shift();
}
function undo() {
  const fn = undoStack.pop();
  if (fn) fn();
}

const NODE_RADIUS = 1.0;
const NODE_SNAP_EPSILON = 0.5;
const nodes = [];
let hoveredNode = null;
let hoveredRoadSnap = null;

const nodeGeo = new THREE.SphereGeometry(NODE_RADIUS, 16, 16);

function makeNodeMaterial() {
  return new THREE.MeshBasicMaterial({ color: 0xffffff });
}

function findNearbyNode(x, z) {
  return nodes.find(n => Math.hypot(n.position.x - x, n.position.z - z) < NODE_SNAP_EPSILON) || null;
}

function getOrCreateNode(x, z) {
  const existing = findNearbyNode(x, z);
  if (existing) {
    existing.refCount++;
    return existing;
  }
  const mesh = new THREE.Mesh(nodeGeo, makeNodeMaterial());
  mesh.position.set(x, 0.4, z);
  mesh.scale.setScalar(1);
  scene.add(mesh);

  const node = { position: mesh.position, mesh, refCount: 1 };
  nodes.push(node);
  return node;
}

function releaseNode(node) {
  if (!node) return;
  node.refCount--;
  if (node.refCount <= 0) {
    scene.remove(node.mesh);
    const idx = nodes.indexOf(node);
    if (idx !== -1) nodes.splice(idx, 1);
    if (hoveredNode === node) hoveredNode = null;
  }
}

function retainNode(node) {
  if (node) node.refCount++;
}

function setNodeHover(node) {
  if (hoveredNode === node) return;
  if (hoveredNode) {
    hoveredNode.mesh.scale.setScalar(1);
    hoveredNode.mesh.material.color.setHex(0xffffff);
  }
  hoveredNode = node;
  if (hoveredNode) {
    hoveredNode.mesh.scale.setScalar(1.5);
    hoveredNode.mesh.material.color.setHex(0xffff00);
  }
}

function raycastRoadPoint() {
  if (createdSegments.length === 0) return null;
  raycaster.setFromCamera(mouse, camera);
  const meshes = createdSegments.map(s => s.mesh);
  const intersects = raycaster.intersectObjects(meshes);
  if (intersects.length === 0) return null;

  const hitMesh = intersects[0].object;
  const segment = createdSegments.find(s => s.mesh === hitMesh);
  if (!segment) return null;

  const [p1, p2] = segment.data.points;
  const ax = p1[0], az = p1[1];
  const bx = p2[0], bz = p2[1];
  const hit = intersects[0].point;

  const abx = bx - ax;
  const abz = bz - az;
  const lenSq = abx * abx + abz * abz;
  if (lenSq < 0.0001) return null;

  let t = ((hit.x - ax) * abx + (hit.z - az) * abz) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const snapX = ax + abx * t;
  const snapZ = az + abz * t;

  return { segment, point: new THREE.Vector3(snapX, 0, snapZ), width: segment.data.width };
}

function getConnectedNodeSet(startNodes) {
  const visited = new Set(startNodes);
  const queue = [...startNodes];
  while (queue.length) {
    const current = queue.pop();
    createdSegments.forEach(seg => {
      const [a, b] = seg.nodes;
      if (a === current && !visited.has(b)) { visited.add(b); queue.push(b); }
      if (b === current && !visited.has(a)) { visited.add(a); queue.push(a); }
    });
  }
  return visited;
}

function getSegmentsTouchingNodes(nodeSet) {
  return createdSegments.filter(seg => nodeSet.has(seg.nodes[0]) || nodeSet.has(seg.nodes[1]));
}

function updateSegmentTransform(segment) {
  const [nodeA, nodeB] = segment.nodes;
  const start = nodeA.position;
  const end = nodeB.position;
  const mesh = segment.mesh;
  mesh.position.set((start.x + end.x) * 0.5, mesh.position.y, (start.z + end.z) * 0.5);
  mesh.rotation.set(0, -Math.atan2(end.z - start.z, end.x - start.x), 0);
  mesh.scale.set(Math.hypot(end.x - start.x, end.z - start.z), 1, segment.data.width);
  segment.data.points = [
    [parseFloat(start.x.toFixed(2)), parseFloat(start.z.toFixed(2))],
    [parseFloat(end.x.toFixed(2)), parseFloat(end.z.toFixed(2))]
  ];
}

const pointerPreview = new THREE.Mesh(new THREE.SphereGeometry(0.3), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
scene.add(pointerPreview);

const widthPreviewGeo = new THREE.PlaneGeometry(1, 1);
widthPreviewGeo.rotateX(-Math.PI / 2);
const widthPreviewMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, side: THREE.DoubleSide });
const widthPreviewMesh = new THREE.Mesh(widthPreviewGeo, widthPreviewMat);
scene.add(widthPreviewMesh);
let lastSnapPos = null;

const previewRoadGeo = new THREE.PlaneGeometry(1, 1);
previewRoadGeo.rotateX(-Math.PI / 2);
const previewRoadMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
const previewRoadMesh = new THREE.Mesh(previewRoadGeo, previewRoadMat);
previewRoadMesh.visible = false;
scene.add(previewRoadMesh);

const loader = new GLTFLoader();
loader.load(
  ASSETS,
  (gltf) => {
    scene.add(gltf.scene);
    console.log('Modèle GLB chargé avec succès !');
  },
  undefined,
  (error) => console.error('Erreur chargement GLB:', error)
);

function showNotification(message, isError = false) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.position = 'fixed';
  toast.style.bottom = '20px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.background = isError ? 'rgba(220, 50, 50, 0.95)' : 'rgba(0, 200, 80, 0.95)';
  toast.style.color = 'white';
  toast.style.padding = '10px 20px';
  toast.style.borderRadius = '4px';
  toast.style.fontFamily = 'sans-serif';
  toast.style.fontSize = '14px';
  toast.style.zIndex = '1100';
  toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
  toast.style.transition = 'opacity 0.3s ease';

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

const STORAGE_KEY = 'dev_road_editor_save';

function saveMapData() {
  try {
    const exportData = createdSegments.map(s => s.data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(exportData));
    showNotification('✓ Carte sauvegardée localement !');
  } catch (e) {
    console.error(e);
    showNotification('✕ Échec de la sauvegarde locale', true);
  }
}

function clearCurrentScene() {
  createdSegments.forEach(s => scene.remove(s.mesh));
  createdSegments.length = 0;
  nodes.forEach(n => scene.remove(n.mesh));
  nodes.length = 0;
  deselect();
}

function loadMapData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    showNotification('Aucune sauvegarde trouvée', true);
    return;
  }
  buildMapFromData(saved);
}

function buildMapFromData(jsonData) {
  try {
    const parsedData = JSON.parse(jsonData);
    clearCurrentScene();
    parsedData.forEach(data => {
      const [p1, p2] = data.points;
      const nodeStart = getOrCreateNode(p1[0], p1[1]);
      const nodeEnd = getOrCreateNode(p2[0], p2[1]);
      const mesh = spawnVisualRoad(nodeStart.position, nodeEnd.position, data.type);
      createdSegments.push({ mesh, data: data, nodes: [nodeStart, nodeEnd] });
    });
    showNotification(`✓ ${parsedData.length} segments chargés.`);
  } catch (e) {
    console.error(e);
    showNotification("✕ Données invalides ou corrompues", true);
  }
}

const ui = document.createElement('div');
ui.style.position = 'absolute';
ui.style.top = '10px';
ui.style.left = '10px';
ui.style.background = 'rgba(0,0,0,0.85)';
ui.style.color = 'white';
ui.style.padding = '12px';
ui.style.fontFamily = 'sans-serif';
ui.style.borderRadius = '6px';
ui.style.userSelect = 'none';
ui.style.pointerEvents = 'auto';
ui.style.maxWidth = '300px';
ui.innerHTML = `
  <div style="display:flex; justify-content:space-between; align-items:center;">
    <h3 style="margin:0;">Outil Dev Route</h3>
    <button id="toggleInstructions" style="background:#333; color:white; border:1px solid #555; border-radius:4px; padding:2px 8px; cursor:pointer; font-size:12px;">?</button>
  </div>
  <label><input type="radio" name="widthType" value="1" checked> Type 1 (Étroite)</label><br>
  <label><input type="radio" name="widthType" value="2"> Type 2 (Large)</label><br>
  <div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px; margin: 8px 0;">
    <button id="saveBtn" style="font-size:11px; padding:4px; cursor:pointer;">Sauvegarder</button>
    <button id="loadBtn" style="font-size:11px; padding:4px; cursor:pointer;">Charger</button>
    <button id="importBtn" style="font-size:11px; padding:4px; cursor:pointer;">Importer JSON</button>
    <button id="clearBtn" style="font-size:11px; padding:4px; cursor:pointer; background:#511; color:#ff9999; border:1px solid #722;">Tout Effacer</button>
  </div>
  <div id="instructionsPanel" style="display:none;">
    <p style="font-size:12px; color:#aaa;">
      <b>Route :</b><br>
      - Clic Gauche : Placer Début / Fin route<br>
      - Survoler un point existant : s'accroche dessus (jaune, plus gros)<br>
      - Survoler une route existante : s'accroche sur sa ligne centrale<br>
      - Ctrl + Clic sur route : Sélectionner<br>
      - Ctrl + Clic + Glisser : Déplacer<br>
      - Suppr / Backspace : Supprimer la sélection<br><br>
      <b>Transformer :</b><br>
      - R : Rotation<br>
      - S : Redimensionner<br><br>
      <b>Caméra :</b><br>
      - Clic Milieu ou Clic Droit + Glisser : Pan<br>
      - Molette : Zoom<br><br>
      <b>Ctrl+Z</b> : Annuler<br>
      <b>Echap</b> : Désélectionner
    </p>
  </div>
  <div id="statusBar" style="font-size:12px; color:#0f0; min-height:16px; margin-bottom:6px;"></div>
  <button id="exportBtn" style="width:100%; padding:6px; cursor:pointer;">Aperçu / Exporter la Map</button>
`;
document.body.appendChild(ui);
const statusBar = document.getElementById('statusBar');

const toggleBtn = document.getElementById('toggleInstructions');
const instructionsPanel = document.getElementById('instructionsPanel');
toggleBtn.addEventListener('click', () => {
  const isHidden = instructionsPanel.style.display === 'none';
  instructionsPanel.style.display = isHidden ? 'block' : 'none';
  toggleBtn.textContent = isHidden ? '✕' : '?';
});

document.getElementsByName('widthType').forEach(radio => {
  radio.addEventListener('change', (e) => {
    currentWidthType = parseInt(e.target.value);
    if (lastSnapPos) {
      const w = getRoadWidth(currentWidthType);
      widthPreviewMesh.scale.set(w, 1, w);
    }
  });
});

document.getElementById('saveBtn').addEventListener('click', saveMapData);
document.getElementById('loadBtn').addEventListener('click', loadMapData);
document.getElementById('clearBtn').addEventListener('click', () => {
  if (confirm("Voulez-vous vraiment TOUT effacer ?")) {
    clearCurrentScene();
    showNotification('✓ Carte effacée.');
  }
});
document.getElementById('importBtn').addEventListener('click', () => {
  const jsonInput = prompt("Collez votre JSON d'export ici :");
  if (jsonInput) buildMapFromData(jsonInput);
});

document.getElementById('exportBtn').addEventListener('click', openExportPreview);

function openExportPreview() {
  const exportData = createdSegments.map(s => s.data);
  const json = JSON.stringify(exportData, null, 2);

  modalOpen = true;

  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.background = 'rgba(0,0,0,0.75)';
  overlay.style.zIndex = '1000';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';

  const panel = document.createElement('div');
  panel.style.background = '#1e1e1e';
  panel.style.color = '#eee';
  panel.style.padding = '16px';
  panel.style.borderRadius = '8px';
  panel.style.width = '600px';
  panel.style.maxWidth = '90%';
  panel.style.maxHeight = '80vh';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.fontFamily = 'sans-serif';

  panel.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <h3 style="margin:0;">Aperçu de l'export (${exportData.length} segments)</h3>
      <button id="closePreviewBtn" style="background:#333; color:white; border:1px solid #555; border-radius:4px; padding:4px 10px; cursor:pointer;">✕</button>
    </div>
    <textarea id="previewTextarea" readonly style="flex:1; min-height:300px; background:#111; color:#0f0; font-family:monospace; font-size:12px; border:1px solid #444; border-radius:4px; padding:8px; resize:vertical;"></textarea>
    <div style="display:flex; gap:8px; margin-top:10px;">
      <button id="copyPreviewBtn" style="flex:1; padding:8px; cursor:pointer;">Copier</button>
      <button id="confirmExportBtn" style="flex:1; padding:8px; cursor:pointer;">Exporter (Console)</button>
    </div>
  `;

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  const textarea = panel.querySelector('#previewTextarea');
  textarea.value = json;

  function closeModal() {
    modalOpen = false;
    overlay.remove();
  }

  panel.querySelector('#closePreviewBtn').addEventListener('click', closeModal);
  overlay.addEventListener('pointerdown', (e) => {
    if (e.target === overlay) closeModal();
  });
  panel.addEventListener('pointerdown', (e) => e.stopPropagation());

  panel.querySelector('#copyPreviewBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(json).then(() => {
      showNotification('✓ Données copiées !');
    });
  });

  panel.querySelector('#confirmExportBtn').addEventListener('click', () => {
    console.log("--- DONNÉES DE LA MAP EXPORTÉES ---");
    console.log(json);
    showNotification('✓ Exporté dans la console avec succès !');
    closeModal();
  });
}

ui.addEventListener('pointerdown', (e) => e.stopPropagation());

function isClickOnUI(event) {
  const rect = ui.getBoundingClientRect();
  return event.clientX >= rect.left && event.clientX <= rect.right &&
         event.clientY >= rect.top && event.clientY <= rect.bottom;
}

window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('wheel', onWindowWheel, { passive: false });
window.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('keydown', onKeyDown);

function getFloorIntersection() {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(floor);
  return intersects.length > 0 ? intersects[0].point : null;
}

function updateCameraPosition() {
  camera.position.set(cameraTarget.x, cameraHeight, cameraTarget.z);
  camera.lookAt(cameraTarget.x, 0, cameraTarget.z);
}

function screenDeltaToWorld(deltaX, deltaY) {
  const worldWidth = (camera.right - camera.left) / camera.zoom;
  const worldHeight = (camera.top - camera.bottom) / camera.zoom;
  return {
    dx: -deltaX * (worldWidth / window.innerWidth),
    dz: -deltaY * (worldHeight / window.innerHeight)
  };
}

function cloneData(data) {
  return JSON.parse(JSON.stringify(data));
}

function setSelected(segment) {
  if (selectedSegment && selectedSegment !== segment) {
    restoreSegmentColor(selectedSegment);
  }
  selectedSegment = segment;
  if (segment) {
    segment.mesh.material.color.setHex(0x00ff00);
  }
  updateStatus();
}

function restoreSegmentColor(segment) {
  segment.mesh.material.color.setHex(segment.data.type === 1 ? 0x222222 : 0x3d3d3d);
}

function deselect() {
  if (selectedSegment) {
    restoreSegmentColor(selectedSegment);
    selectedSegment = null;
  }
  updateStatus();
}

function updateStatus() {
  if (transformMode === 'rotate') {
    statusBar.textContent = 'Rotation en cours... (clic = valider, Echap = annuler)';
  } else if (transformMode === 'scale') {
    statusBar.textContent = `Redimensionnement (${scaleConstraint}) en cours... (X/Z/A pour contraindre, clic = valider, Echap = annuler)`;
  } else if (selectedSegment) {
    statusBar.textContent = 'Route sélectionnée (R = tourner, S = redimensionner, Suppr = supprimer)';
  } else {
    statusBar.textContent = '';
  }
}

function deleteSegment(segment) {
  const index = createdSegments.indexOf(segment);
  if (index === -1) return;
  scene.remove(segment.mesh);
  createdSegments.splice(index, 1);

  const [nodeA, nodeB] = segment.nodes;
  releaseNode(nodeA);
  releaseNode(nodeB);

  pushUndo(() => {
    scene.add(segment.mesh);
    createdSegments.push(segment);
    retainNode(nodeA);
    retainNode(nodeB);
    if (!nodes.includes(nodeA)) {
      scene.add(nodeA.mesh);
      nodes.push(nodeA);
    }
    if (!nodes.includes(nodeB)) {
      scene.add(nodeB.mesh);
      nodes.push(nodeB);
    }
  });
}

function raycastNodes() {
  if (nodes.length === 0) return null;
  raycaster.setFromCamera(mouse, camera);
  const meshes = nodes.map(n => n.mesh);
  const intersects = raycaster.intersectObjects(meshes);
  if (intersects.length === 0) return null;
  return nodes.find(n => n.mesh === intersects[0].object) || null;
}

function onPointerMove(event) {
  if (modalOpen) return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  const deltaX = event.clientX - previousMousePosition.x;
  const deltaY = event.clientY - previousMousePosition.y;
  previousMousePosition = { x: event.clientX, y: event.clientY };

  if (transformMode === 'rotate' && selectedSegment) {
    const p = getFloorIntersection();
    if (p) {
      const mesh = selectedSegment.mesh;
      const cx = transformSnapshot.center.x;
      const cz = transformSnapshot.center.z;
      const currentAngle = Math.atan2(p.z - cz, p.x - cx);
      const delta = currentAngle - transformSnapshot.initialMouseAngle;
      mesh.rotation.y = transformSnapshot.initialRotY - delta;

      const halfLen = mesh.scale.x * 0.5;
      const theta = -mesh.rotation.y;
      const dx = Math.cos(theta) * halfLen;
      const dz = Math.sin(theta) * halfLen;
      const [nodeA, nodeB] = selectedSegment.nodes;
      nodeA.position.set(cx - dx, nodeA.position.y, cz - dz);
      nodeB.position.set(cx + dx, nodeB.position.y, cz + dz);
      selectedSegment.data.points = [
        [parseFloat(nodeA.position.x.toFixed(2)), parseFloat(nodeA.position.z.toFixed(2))],
        [parseFloat(nodeB.position.x.toFixed(2)), parseFloat(nodeB.position.z.toFixed(2))]
      ];
    }
    return;
  }

  if (transformMode === 'scale' && selectedSegment) {
    const p = getFloorIntersection();
    if (p) {
      const mesh = selectedSegment.mesh;
      const cx = transformSnapshot.center.x;
      const cz = transformSnapshot.center.z;
      const currentDist = Math.max(Math.hypot(p.x - cx, p.z - cz), 0.001);
      const ratio = currentDist / transformSnapshot.baseDist;

      if (scaleConstraint === 'uniform' || scaleConstraint === 'x') {
        mesh.scale.x = Math.max(transformSnapshot.initialScaleX * ratio, 0.5);
      }
      if (scaleConstraint === 'uniform' || scaleConstraint === 'z') {
        mesh.scale.z = Math.max(transformSnapshot.initialScaleZ * ratio, 0.5);
        selectedSegment.data.width = mesh.scale.z;
      }

      const halfLen = mesh.scale.x * 0.5;
      const theta = -mesh.rotation.y;
      const dx = Math.cos(theta) * halfLen;
      const dz = Math.sin(theta) * halfLen;
      const [nodeA, nodeB] = selectedSegment.nodes;
      nodeA.position.set(cx - dx, nodeA.position.y, cz - dz);
      nodeB.position.set(cx + dx, nodeB.position.y, cz + dz);
      selectedSegment.data.points = [
        [parseFloat(nodeA.position.x.toFixed(2)), parseFloat(nodeA.position.z.toFixed(2))],
        [parseFloat(nodeB.position.x.toFixed(2)), parseFloat(nodeB.position.z.toFixed(2))]
      ];
    }
    return;
  }

  if (isPanning) {
    const { dx, dz } = screenDeltaToWorld(deltaX, deltaY);
    cameraTarget.x += dx;
    cameraTarget.z -= dz;
    updateCameraPosition();
    return;
  }

  if (isDraggingRoute && selectedSegment && dragStartSnapshot) {
    const p = getFloorIntersection();
    if (p) {
      const newPos = p.clone().sub(dragOffset);
      const diffX = newPos.x - selectedSegment.mesh.position.x;
      const diffZ = newPos.z - selectedSegment.mesh.position.z;

      dragStartSnapshot.connectedNodes.forEach(node => {
        node.position.x += diffX;
        node.position.z += diffZ;
      });

      getSegmentsTouchingNodes(dragStartSnapshot.connectedNodes).forEach(updateSegmentTransform);
    }
    return;
  }

  const hoveredNodeNow = raycastNodes();
  setNodeHover(hoveredNodeNow);
  hoveredRoadSnap = hoveredNodeNow ? null : raycastRoadPoint();

  const p = getFloorIntersection();
  if (p) {
    const snapPos = hoveredNodeNow ? hoveredNodeNow.position : (hoveredRoadSnap ? hoveredRoadSnap.point : p);
    pointerPreview.position.set(snapPos.x, 0.4, snapPos.z);
    pointerPreview.material.color.setHex(startPoint ? 0x00ff00 : (hoveredRoadSnap ? 0x00ffff : 0xff0000));

    lastSnapPos = snapPos.clone ? snapPos.clone() : new THREE.Vector3(snapPos.x, 0, snapPos.z);
    const currentRoadWidth = getRoadWidth(currentWidthType);
    widthPreviewMesh.position.set(snapPos.x, 0.05, snapPos.z);
    widthPreviewMesh.scale.set(currentRoadWidth, 1, currentRoadWidth);

    if (startPoint) {
      previewRoadMesh.visible = true;
      const roadWidth = getRoadWidth(currentWidthType);

      let rawEndX, rawEndZ;
      if (hoveredNodeNow) {
        rawEndX = hoveredNodeNow.position.x;
        rawEndZ = hoveredNodeNow.position.z;
      } else if (hoveredRoadSnap) {
        rawEndX = hoveredRoadSnap.point.x;
        rawEndZ = hoveredRoadSnap.point.z;
      } else {
        rawEndX = p.x;
        rawEndZ = p.z;
      }

      previewRoadMesh.position.set((startPoint.x + rawEndX) * 0.5, 0.15, (startPoint.z + rawEndZ) * 0.5);
      previewRoadMesh.rotation.set(0, -Math.atan2(rawEndZ - startPoint.z, rawEndX - startPoint.x), 0);
      previewRoadMesh.scale.set(Math.hypot(rawEndX - startPoint.x, rawEndZ - startPoint.z), 1, roadWidth);
    } else {
      previewRoadMesh.visible = false;
    }
  }
}

function onPointerDown(event) {
  if (modalOpen) return;
  if (isClickOnUI(event)) return;

  if (transformMode === 'rotate' || transformMode === 'scale') {
    if (event.button === 0) {
      finalizeTransform();
    } else if (event.button === 2) {
      cancelTransform();
    }
    return;
  }

  if (event.button === 1 || event.button === 2) {
    isPanning = true;
    previousMousePosition = { x: event.clientX, y: event.clientY };
    return;
  }

  if (event.button === 0) {
    if (event.ctrlKey) {
      raycaster.setFromCamera(mouse, camera);
      const meshesToIntersect = createdSegments.map(s => s.mesh);
      const intersects = raycaster.intersectObjects(meshesToIntersect);

      if (intersects.length > 0) {
        const segment = createdSegments.find(s => s.mesh === intersects[0].object);
        setSelected(segment);

        const p = getFloorIntersection();
        if (p) {
          isDraggingRoute = true;
          dragOffset.copy(p).sub(segment.mesh.position);

          const connectedNodes = getConnectedNodeSet(segment.nodes);
          const nodePositions = new Map();
          connectedNodes.forEach(node => nodePositions.set(node, node.position.clone()));

          dragStartSnapshot = { segment, connectedNodes, nodePositions };
        }
      }
      return;
    }

    const p = getFloorIntersection();
    if (p) {
      if (!startPoint) {
        const snapX = hoveredNode ? hoveredNode.position.x : (hoveredRoadSnap ? hoveredRoadSnap.point.x : p.x);
        const snapZ = hoveredNode ? hoveredNode.position.z : (hoveredRoadSnap ? hoveredRoadSnap.point.z : p.z);
        startPoint = { x: snapX, z: snapZ };
      } else {
        let rawEndX, rawEndZ;
        if (hoveredNode) {
          rawEndX = hoveredNode.position.x;
          rawEndZ = hoveredNode.position.z;
        } else if (hoveredRoadSnap) {
          rawEndX = hoveredRoadSnap.point.x;
          rawEndZ = hoveredRoadSnap.point.z;
        } else {
          rawEndX = p.x;
          rawEndZ = p.z;
        }

        const roadWidth = getRoadWidth(currentWidthType);

        const nodeStart = getOrCreateNode(startPoint.x, startPoint.z);
        const nodeEnd = getOrCreateNode(rawEndX, rawEndZ);

        const mesh = spawnVisualRoad(nodeStart.position, nodeEnd.position, currentWidthType);

        const segmentData = {
          points: [
            [parseFloat(nodeStart.position.x.toFixed(2)), parseFloat(nodeStart.position.z.toFixed(2))],
            [parseFloat(nodeEnd.position.x.toFixed(2)), parseFloat(nodeEnd.position.z.toFixed(2))]
          ],
          type: currentWidthType,
          width: roadWidth
        };

        const segment = { mesh, data: segmentData, nodes: [nodeStart, nodeEnd] };
        createdSegments.push(segment);

        pushUndo(() => {
          scene.remove(mesh);
          const idx = createdSegments.indexOf(segment);
          if (idx !== -1) createdSegments.splice(idx, 1);
          if (selectedSegment === segment) selectedSegment = null;
          releaseNode(nodeStart);
          releaseNode(nodeEnd);
        });

        startPoint = null;
        pointerPreview.material.color.setHex(0xff0000);
        previewRoadMesh.visible = false;
      }
    }
  }
}

function onPointerUp(event) {
  if (event.button === 1 || event.button === 2) {
    isPanning = false;
  }
  if (event.button === 0 && isDraggingRoute) {
    isDraggingRoute = false;
    if (dragStartSnapshot) {
      const { connectedNodes, nodePositions } = dragStartSnapshot;
      let moved = false;
      connectedNodes.forEach(node => {
        const orig = nodePositions.get(node);
        if (orig.x !== node.position.x || orig.z !== node.position.z) moved = true;
      });
      if (moved) {
        pushUndo(() => {
          connectedNodes.forEach(node => {
            const orig = nodePositions.get(node);
            node.position.set(orig.x, orig.y, orig.z);
          });
          getSegmentsTouchingNodes(connectedNodes).forEach(updateSegmentTransform);
        });
      }
      dragStartSnapshot = null;
    }
  }
}

function onWindowWheel(event) {
  event.preventDefault();
  const zoomFactor = Math.pow(1.0015, -event.deltaY);
  camera.zoom *= zoomFactor;
  camera.zoom = Math.max(1e-4, Math.min(camera.zoom, 1e5));
  camera.updateProjectionMatrix();
}

function startRotateMode() {
  if (!selectedSegment) return;
  const mesh = selectedSegment.mesh;
  const p = getFloorIntersection();
  if (!p) return;

  const [nodeA, nodeB] = selectedSegment.nodes;

  transformMode = 'rotate';
  transformSnapshot = {
    center: mesh.position.clone(),
    initialRotY: mesh.rotation.y,
    initialMouseAngle: Math.atan2(p.z - mesh.position.z, p.x - mesh.position.x),
    dataBefore: cloneData(selectedSegment.data),
    rotYBefore: mesh.rotation.y,
    nodeAPos: nodeA.position.clone(),
    nodeBPos: nodeB.position.clone()
  };
  updateStatus();
}

function startScaleMode() {
  if (!selectedSegment) return;
  const mesh = selectedSegment.mesh;
  const p = getFloorIntersection();
  if (!p) return;

  const [nodeA, nodeB] = selectedSegment.nodes;

  scaleConstraint = 'uniform';
  transformMode = 'scale';
  transformSnapshot = {
    center: mesh.position.clone(),
    baseDist: Math.max(Math.hypot(p.x - mesh.position.x, p.z - mesh.position.z), 0.001),
    initialScaleX: mesh.scale.x,
    initialScaleZ: mesh.scale.z,
    dataBefore: cloneData(selectedSegment.data),
    scaleXBefore: mesh.scale.x,
    scaleZBefore: mesh.scale.z,
    nodeAPos: nodeA.position.clone(),
    nodeBPos: nodeB.position.clone()
  };
  updateStatus();
}

function finalizeTransform() {
  if (!selectedSegment) { transformMode = 'none'; return; }
  const mesh = selectedSegment.mesh;
  const segment = selectedSegment;
  const [nodeA, nodeB] = segment.nodes;

  if (transformMode === 'rotate') {
    const { rotYBefore, dataBefore, nodeAPos, nodeBPos } = transformSnapshot;
    pushUndo(() => {
      mesh.rotation.y = rotYBefore;
      segment.data.points = dataBefore.points;
      segment.data.width = dataBefore.width;
      nodeA.position.set(nodeAPos.x, nodeAPos.y, nodeAPos.z);
      nodeB.position.set(nodeBPos.x, nodeBPos.y, nodeBPos.z);
    });
  } else if (transformMode === 'scale') {
    const { scaleXBefore, scaleZBefore, dataBefore, nodeAPos, nodeBPos } = transformSnapshot;
    pushUndo(() => {
      mesh.scale.x = scaleXBefore;
      mesh.scale.z = scaleZBefore;
      segment.data.points = dataBefore.points;
      segment.data.width = dataBefore.width;
      nodeA.position.set(nodeAPos.x, nodeAPos.y, nodeAPos.z);
      nodeB.position.set(nodeBPos.x, nodeBPos.y, nodeBPos.z);
    });
  }

  transformMode = 'none';
  transformSnapshot = null;
  updateStatus();
}

function cancelTransform() {
  if (!selectedSegment || !transformSnapshot) { transformMode = 'none'; return; }
  const mesh = selectedSegment.mesh;
  const [nodeA, nodeB] = selectedSegment.nodes;

  if (transformMode === 'rotate') {
    mesh.rotation.y = transformSnapshot.rotYBefore;
    selectedSegment.data.points = transformSnapshot.dataBefore.points;
  } else if (transformMode === 'scale') {
    mesh.scale.x = transformSnapshot.scaleXBefore;
    mesh.scale.z = transformSnapshot.scaleZBefore;
    selectedSegment.data.points = transformSnapshot.dataBefore.points;
    selectedSegment.data.width = transformSnapshot.dataBefore.width;
  }

  nodeA.position.set(transformSnapshot.nodeAPos.x, transformSnapshot.nodeAPos.y, transformSnapshot.nodeAPos.z);
  nodeB.position.set(transformSnapshot.nodeBPos.x, transformSnapshot.nodeBPos.y, transformSnapshot.nodeBPos.z);

  transformMode = 'none';
  transformSnapshot = null;
  updateStatus();
}

function onKeyDown(event) {
  if (modalOpen) return;

  if (event.ctrlKey && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    if (transformMode !== 'none') {
      cancelTransform();
    } else {
      undo();
    }
    return;
  }

  if (event.key === 'Escape') {
    if (transformMode !== 'none') {
      cancelTransform();
    } else if (startPoint) {
      startPoint = null;
      previewRoadMesh.visible = false;
      pointerPreview.material.color.setHex(0xff0000);
    } else {
      deselect();
    }
    return;
  }

  if ((event.key === 'Delete' || event.key === 'Backspace') && transformMode === 'none') {
    if (selectedSegment) {
      const segment = selectedSegment;
      deleteSegment(segment);
      selectedSegment = null;
      updateStatus();
    }
    return;
  }

  if (event.key.toLowerCase() === 'r' && transformMode === 'none' && selectedSegment) {
    startRotateMode();
    return;
  }

  if (event.key.toLowerCase() === 's' && transformMode === 'none' && selectedSegment) {
    startScaleMode();
    return;
  }

  if (transformMode === 'scale') {
    const k = event.key.toLowerCase();
    if (k === 'x') { scaleConstraint = 'x'; updateStatus(); }
    else if (k === 'z') { scaleConstraint = 'z'; updateStatus(); }
    else if (k === 'a') { scaleConstraint = 'uniform'; updateStatus(); }
  }
}

function spawnVisualRoad(start, end, type) {
  const roadWidth = getRoadWidth(type);

  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.MeshStandardMaterial({
    color: type === 1 ? 0x222222 : 0x3d3d3d,
    side: THREE.DoubleSide
  });

  const mesh = new THREE.Mesh(geo, mat);

  mesh.position.set((start.x + end.x) * 0.5, 0.1, (start.z + end.z) * 0.5);
  mesh.rotation.set(0, -Math.atan2(end.z - start.z, end.x - start.x), 0);
  mesh.scale.set(Math.hypot(end.x - start.x, end.z - start.z), 1, roadWidth);

  scene.add(mesh);
  return mesh;
}

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  const aspect = window.innerWidth / window.innerHeight;
  camera.left = -viewSize * aspect;
  camera.right = viewSize * aspect;
  camera.top = viewSize;
  camera.bottom = -viewSize;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});