import * as THREE from 'three';
import { scene } from './main';

const _roadGeometry = new THREE.PlaneGeometry(1, 1);
_roadGeometry.rotateX(-Math.PI / 2);
_roadGeometry.rotateY(Math.PI / 2);

const _roadMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  side: THREE.DoubleSide
});

const _dashMaterial = new THREE.MeshStandardMaterial({
  color: 0xf2f2f2,
  side: THREE.DoubleSide
});

const _continuousMaterial = new THREE.MeshStandardMaterial({
  color: 0xf2f2f2,
  side: THREE.DoubleSide
});

const _cyclableMaterial = new THREE.MeshStandardMaterial({
  color: 0x2c4c38,
  side: THREE.DoubleSide
});

const _typeColors = {
  1: new THREE.Color(0x333333),
  2: new THREE.Color(0x282828)
};

const DASH_LENGTH = 3;
const DASH_GAP = 3;
const DASH_WIDTH = 0.4;
const CONTINUOUS_WIDTH = 0.4;
const MARKING_HEIGHT = 0.11;

const LANE_WIDTH = 16.5;        // 11 * 1.5
const CYCLABLE_WIDTH = 12;      // 8 * 1.5
const DEFAULT_WIDTH_TYPE_1 = 16.5; 
const TOTAL_WIDTH_TYPE_2 = 90;  // 4 voies (66) + 2 pistes cyclables (24)

const PEDESTRIAN_INTERVAL = 150;
const PEDESTRIAN_WIDTH = 4.0;
const PEDESTRIAN_STRIPE_W = 0.5;
const PEDESTRIAN_STRIPE_G = 0.5;

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const chunkRoads = new Map();

function buildRoadMesh(segments) {
  let mainCount = segments.length;
  let capCount = segments.length * 2;
  let totalCount = mainCount + capCount;

  if (mainCount === 0) return null;

  const road = new THREE.InstancedMesh(_roadGeometry, _roadMaterial, totalCount);
  road.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(totalCount * 3), 3);

  let index = 0;

  for (let i = 0; i < mainCount; i++) {
    const segment = segments[i];
    const [p0, p1] = segment.points;
    const defaultWidth = segment.type === 2 ? TOTAL_WIDTH_TYPE_2 : DEFAULT_WIDTH_TYPE_1;
    const width = segment.width ? segment.width * 1.5 : defaultWidth;
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const length = Math.hypot(dx, dy);
    const angle = -Math.atan2(dy, dx);

    _dummy.position.set((p0[0] + p1[0]) * 0.5, 0.1, (p0[1] + p1[1]) * 0.5);
    _dummy.rotation.set(0, angle, 0);
    _dummy.scale.set(length, 1, width);
    _dummy.updateMatrix();
    road.setMatrixAt(index, _dummy.matrix);
    _color.copy(_typeColors[segment.type] ?? _typeColors[1]);
    road.setColorAt(index, _color);
    index++;

    const capLength = width * 0.5;

    _dummy.position.set(p0[0] - (dx / length) * (capLength * 0.5), 0.1, p0[1] - (dy / length) * (capLength * 0.5));
    _dummy.rotation.set(0, angle, 0);
    _dummy.scale.set(capLength, 1, width);
    _dummy.updateMatrix();
    road.setMatrixAt(index, _dummy.matrix);
    road.setColorAt(index, _color);
    index++;

    _dummy.position.set(p1[0] + (dx / length) * (capLength * 0.5),0.1 , p1[1] + (dy / length) * (capLength * 0.5));
    _dummy.rotation.set(0, angle, 0);
    _dummy.scale.set(capLength, 1, width);
    _dummy.updateMatrix();
    road.setMatrixAt(index, _dummy.matrix);
    road.setColorAt(index, _color);
    index++;
  }

  road.instanceMatrix.needsUpdate = true;
  if (road.instanceColor) road.instanceColor.needsUpdate = true;

  scene.add(road);
  return road;
}

function getNextConnectedSegment(currentSeg, point, allSegments) {
  for (const other of allSegments) {
    if (other === currentSeg) continue;
    const [o0, o1] = other.points;
    if (Math.hypot(point[0] - o0[0], point[1] - o0[1]) < 0.1) return { seg: other, isStart: true };
    if (Math.hypot(point[0] - o1[0], point[1] - o1[1]) < 0.1) return { seg: other, isStart: false };
  }
  return null;
}

function buildMarkingsData(segments) {
  const dashData = [];
  const continuousData = [];
  const pedestrianData = [];
  const cyclableData = [];

  for (const segment of segments) {
    const [p0, p1] = segment.points;
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const originalLength = Math.hypot(dx, dy);
    const angle = -Math.atan2(dy, dx);
    const dirX = dx / originalLength;
    const dirY = dy / originalLength;
    const perpX = -dirY;
    const perpY = dirX;

    const defaultWidth = segment.type === 2 ? TOTAL_WIDTH_TYPE_2 : DEFAULT_WIDTH_TYPE_1;
    const currentWidth = segment.width ? segment.width * 1.5 : defaultWidth;

    let startOffset = 2;
    let endOffset = 2;

    const connStart = getNextConnectedSegment(segment, p0, segments);
    if (connStart) {
      const oWidth = connStart.seg.width ? connStart.seg.width * 1.5 : (connStart.seg.type === 2 ? TOTAL_WIDTH_TYPE_2 : DEFAULT_WIDTH_TYPE_1);
      startOffset = oWidth * 0.5 + 2;
    }
    const connEnd = getNextConnectedSegment(segment, p1, segments);
    if (connEnd) {
      const oWidth = connEnd.seg.width ? connEnd.seg.width * 1.5 : (connEnd.seg.type === 2 ? TOTAL_WIDTH_TYPE_2 : DEFAULT_WIDTH_TYPE_1);
      endOffset = oWidth * 0.5 + 2;
    }

    const startX = p0[0] + dirX * startOffset;
    const startZ = p0[1] + dirY * startOffset;
    const markingLength = originalLength - startOffset - endOffset;

    if (markingLength <= 0) continue; // Pas assez long pour avoir des marquages après offset

    if (segment.type === 1) {
      const pattern = DASH_LENGTH + DASH_GAP;
      const dashCount = Math.floor(markingLength / pattern);
      for (let i = 0; i < dashCount; i++) {
        const d = i * pattern + DASH_LENGTH * 0.5;
        dashData.push({
          x: startX + dirX * d,
          z: startZ + dirY * d,
          angle,
          length: DASH_LENGTH,
          width: DASH_WIDTH
        });
      }
    } else if (segment.type === 2) {
      const midD = markingLength * 0.5;
      
      continuousData.push({
        x: startX + dirX * midD,
        z: startZ + dirY * midD,
        angle,
        length: markingLength,
        width: CONTINUOUS_WIDTH
      });

      const pattern = DASH_LENGTH + DASH_GAP;
      const dashCount = Math.floor(markingLength / pattern);
      const innerDashOffset = LANE_WIDTH;

      for (let i = 0; i < dashCount; i++) {
        const d = i * pattern + DASH_LENGTH * 0.5;
        const posX = startX + dirX * d;
        const posZ = startZ + dirY * d;

        dashData.push({ x: posX + perpX * innerDashOffset, z: posZ + perpY * innerDashOffset, angle, length: DASH_LENGTH, width: DASH_WIDTH });
        dashData.push({ x: posX - perpX * innerDashOffset, z: posZ - perpY * innerDashOffset, angle, length: DASH_LENGTH, width: DASH_WIDTH });
      }

      const cyclableOffset = (LANE_WIDTH * 2) + (CYCLABLE_WIDTH * 0.5);

      cyclableData.push({
        x: startX + dirX * midD + perpX * cyclableOffset,
        z: startZ + dirY * midD + perpY * cyclableOffset,
        angle, length: markingLength, width: CYCLABLE_WIDTH
      });
      cyclableData.push({
        x: startX + dirX * midD - perpX * cyclableOffset,
        z: startZ + dirY * midD - perpY * cyclableOffset,
        angle, length: markingLength, width: CYCLABLE_WIDTH
      });

      const pedestrianCount = Math.floor(markingLength / PEDESTRIAN_INTERVAL);
      for (let p = 1; p <= pedestrianCount; p++) {
        const d = p * PEDESTRIAN_INTERVAL;
        const pedCenterX = startX + dirX * d;
        const pedCenterZ = startZ + dirY * d;
        const totalPedWidth = TOTAL_WIDTH_TYPE_2 - (CYCLABLE_WIDTH * 2);
        const stripePattern = PEDESTRIAN_STRIPE_W + PEDESTRIAN_STRIPE_G;
        const stripeCount = Math.floor(totalPedWidth / stripePattern);

        for (let s = 0; s < stripeCount; s++) {
          const sOffset = -(totalPedWidth * 0.5) + (s * stripePattern) + (PEDESTRIAN_STRIPE_W * 0.5);
          pedestrianData.push({
            x: pedCenterX + perpX * sOffset,
            z: pedCenterZ + perpY * sOffset,
            angle,
            length: PEDESTRIAN_WIDTH,
            width: PEDESTRIAN_STRIPE_W
          });
        }
      }
    }
  }

  return { dashData, continuousData, pedestrianData, cyclableData };
}

function buildDashMesh(dashData) {
  if (dashData.length === 0) return null;
  const mesh = new THREE.InstancedMesh(_roadGeometry, _dashMaterial, dashData.length);
  for (let i = 0; i < dashData.length; i++) {
    const d = dashData[i];
    _dummy.position.set(d.x, MARKING_HEIGHT, d.z);
    _dummy.rotation.set(0, d.angle, 0);
    _dummy.scale.set(d.length, 1, d.width);
    _dummy.updateMatrix();
    mesh.setMatrixAt(i, _dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);
  return mesh;
}

function buildContinuousMesh(continuousData) {
  if (continuousData.length === 0) return null;
  const mesh = new THREE.InstancedMesh(_roadGeometry, _continuousMaterial, continuousData.length);
  for (let i = 0; i < continuousData.length; i++) {
    const d = continuousData[i];
    _dummy.position.set(d.x, MARKING_HEIGHT, d.z);
    _dummy.rotation.set(0, d.angle, 0);
    _dummy.scale.set(d.length, 1, d.width);
    _dummy.updateMatrix();
    mesh.setMatrixAt(i, _dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);
  return mesh;
}

function buildPedestrianMesh(pedestrianData) {
  if (pedestrianData.length === 0) return null;
  const mesh = new THREE.InstancedMesh(_roadGeometry, _continuousMaterial, pedestrianData.length);
  for (let i = 0; i < pedestrianData.length; i++) {
    const d = pedestrianData[i];
    _dummy.position.set(d.x, MARKING_HEIGHT + 0.01, d.z);
    _dummy.rotation.set(0, d.angle, 0);
    _dummy.scale.set(d.length, 1, d.width);
    _dummy.updateMatrix();
    mesh.setMatrixAt(i, _dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);
  return mesh;
}

function buildCyclableMesh(cyclableData) {
  if (cyclableData.length === 0) return null;
  const mesh = new THREE.InstancedMesh(_roadGeometry, _cyclableMaterial, cyclableData.length);
  for (let i = 0; i < cyclableData.length; i++) {
    const d = cyclableData[i];
    _dummy.position.set(d.x, 0.105, d.z);
    _dummy.rotation.set(0, d.angle, 0);
    _dummy.scale.set(d.length, 1, d.width);
    _dummy.updateMatrix();
    mesh.setMatrixAt(i, _dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);
  return mesh;
}

function roadMapping(segments) {
  const road = buildRoadMesh(segments);
  const { dashData, continuousData, pedestrianData, cyclableData } = buildMarkingsData(segments);

  const dashMesh = buildDashMesh(dashData);
  const continuousMesh = buildContinuousMesh(continuousData);
  const pedestrianMesh = buildPedestrianMesh(pedestrianData);
  const cyclableMesh = buildCyclableMesh(cyclableData);

  return { road, dashMesh, continuousMesh, pedestrianMesh, cyclableMesh };
}

export function addRoadMapping(center, map) {
  const count = map.length;
  const result = new Array(count);
  const [centerX, centerZ] = center;
  const chunkKey = `${center[0]},${center[1]}`;

  for (let i = 0; i < count; i++) {
    const seg = map[i];
    result[i] = {
      points: [
        [seg.points[0][0] + centerX, seg.points[0][1] + centerZ],
        [seg.points[1][0] + centerX, seg.points[1][1] + centerZ]
      ],
      type: seg.type,
      width: seg.width
    };
  }

  const { road, dashMesh, continuousMesh, pedestrianMesh, cyclableMesh } = roadMapping(result);
  chunkRoads.set(chunkKey, { road, dashMesh, continuousMesh, pedestrianMesh, cyclableMesh, segments: result });
  return result;
}

export function removeRoadMapping(center) {
  const chunkKey = `${center[0]},${center[1]}`;
  const chunkData = chunkRoads.get(chunkKey);
  if (!chunkData) return;

  for (const mesh of [chunkData.road, chunkData.dashMesh, chunkData.continuousMesh, chunkData.pedestrianMesh, chunkData.cyclableMesh]) {
    if (mesh) scene.remove(mesh);
  }
  chunkRoads.delete(chunkKey);
}