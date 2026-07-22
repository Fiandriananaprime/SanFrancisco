import * as THREE from 'three';
import { createLODModel, disposeLODModel } from './lodManager.js';

const CHUNK_SIZE = 100;

export class ChunkManager {
  constructor(scene, district) {
    this.scene = scene;
    this.district = district;
    this.loadedChunks = new Map(); 
    this.radius = district.chunkRadius ?? 2;
  }

  _worldToChunk(x, z) {
    return { cx: Math.floor(x / CHUNK_SIZE), cz: Math.floor(z / CHUNK_SIZE) };
  }

  update(playerPosition) {
    const { cx, cz } = this._worldToChunk(playerPosition.x, playerPosition.z);
    const needed = new Set();

    for (let dx = -this.radius; dx <= this.radius; dx++) {
      for (let dz = -this.radius; dz <= this.radius; dz++) {
        const key = `${cx + dx},${cz + dz}`;
        needed.add(key);
        if (!this.loadedChunks.has(key)) {
          this._loadChunk(cx + dx, cz + dz, key);
        }
      }
    }

    for (const key of this.loadedChunks.keys()) {
      if (!needed.has(key)) this._unloadChunk(key);
    }
  }

  async _loadChunk(cx, cz, key) {
    const def = this.district.getChunkDefinition(cx, cz);
    if (!def) return; 

    const group = new THREE.Group();
    group.name = `chunk_${key}`;
    this.loadedChunks.set(key, { group, loading: true });

    for (const obj of def.objects ?? []) {
      const lod = await createLODModel(obj.levels);
      lod.position.set(obj.x, obj.y ?? 0, obj.z);
      group.add(lod);
    }

    
    if (!this.loadedChunks.has(key)) {
      group.traverse((c) => c.isLOD && disposeLODModel(c));
      return;
    }

    this.scene.add(group);
    this.loadedChunks.get(key).loading = false;
  }

  _unloadChunk(key) {
    const entry = this.loadedChunks.get(key);
    if (!entry) return;
    this.scene.remove(entry.group);
    entry.group.traverse((child) => {
      if (child.isLOD) disposeLODModel(child);
    });
    this.loadedChunks.delete(key);
  }

  disposeAll() {
    for (const key of [...this.loadedChunks.keys()]) this._unloadChunk(key);
  }
}
