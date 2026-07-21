import { ChunkManager } from './chunkManager.js';

export class DistrictManager {
  constructor(scene, districts) {
    this.scene = scene;
    this.districts = districts;
    this.activeDistrict = null;
    this.activeChunkManager = null;
  }

  _findDistrictAt(x, z) {
    return (
      this.districts.find(
        (d) => x >= d.bounds.minX && x <= d.bounds.maxX && z >= d.bounds.minZ && z <= d.bounds.maxZ
      ) ?? null
    );
  }

  
  
  update(playerPosition) {
    const district = this._findDistrictAt(playerPosition.x, playerPosition.z);

    if (district !== this.activeDistrict) {
      this._switchDistrict(district);
    }

    this.activeChunkManager?.update(playerPosition);
  }

  _switchDistrict(district) {
    
    this.activeChunkManager?.disposeAll();
    this.activeDistrict = district;
    this.activeChunkManager = district ? new ChunkManager(this.scene, district) : null;
  }
}
