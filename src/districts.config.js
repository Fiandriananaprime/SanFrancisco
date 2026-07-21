





const CHUNK_SIZE = 100;

function makeGridDistrict({ name, bounds, chunkRadius, objectFactory }) {
  return {
    name,
    bounds,
    chunkRadius,
    getChunkDefinition(cx, cz) {
      const worldX = cx * CHUNK_SIZE;
      const worldZ = cz * CHUNK_SIZE;
      if (
        worldX < bounds.minX || worldX > bounds.maxX ||
        worldZ < bounds.minZ || worldZ > bounds.maxZ
      ) {
        return null; 
      }
      return { objects: objectFactory(cx, cz) };
    },
  };
}

export const districts = [
  makeGridDistrict({
    name: 'centre-ville',
    bounds: { minX: -500, maxX: 500, minZ: -500, maxZ: 500 },
    chunkRadius: 2, 
    objectFactory: (cx, cz) => [
      {
        x: cx * CHUNK_SIZE,
        y: 0,
        z: cz * CHUNK_SIZE,
        levels: [
          { url: '/models/building_high.glb', distance: 0 },
          { url: '/models/building_mid.glb', distance: 40 },
          { url: '/models/building_low.glb', distance: 100 },
        ],
      },
    ],
  }),

  makeGridDistrict({
    name: 'peripherie',
    bounds: { minX: 500, maxX: 1500, minZ: -500, maxZ: 500 },
    chunkRadius: 1,
    objectFactory: (cx, cz) => [
      {
        x: cx * CHUNK_SIZE,
        y: 0,
        z: cz * CHUNK_SIZE,
        levels: [
          { url: '/models/maison_high.glb', distance: 0 },
          { url: '/models/maison_low.glb', distance: 80 },
        ],
      },
    ],
  }),
];
