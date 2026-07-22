import * as THREE from 'three';

export function addClouds(scene, { count = 25, height = 60, spread = 400, puffsPerCloud = 7 } = {}) {
  const group = new THREE.Group();
  group.name = 'nuages';

  
  const geometry = new THREE.SphereGeometry(5, 7, 7);
  
  
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.1,
    flatShading: true,
    transparent: true,
    opacity: 0.92,
  });

  
  const totalPuffs = count * puffsPerCloud;
  const instanced = new THREE.InstancedMesh(geometry, material, totalPuffs);
  instanced.name = 'nuages_instanced';

  const dummy = new THREE.Object3D();
  let instanceIndex = 0;

  for (let i = 0; i < count; i++) {
    
    const cloudX = (Math.random() - 0.5) * spread;
    const cloudY = height + (Math.random() - 0.5) * 10;
    const cloudZ = (Math.random() - 0.5) * spread;
    
    
    const cloudScale = 0.7 + Math.random() * 0.8;

    for (let j = 0; j < puffsPerCloud; j++) {
      const isCenter = j === 0;

      
      const offsetX = isCenter ? 0 : (Math.random() - 0.5) * 14 * cloudScale;
      const offsetY = isCenter ? 0 : (Math.random() - 0.3) * 5 * cloudScale; 
      const offsetZ = isCenter ? 0 : (Math.random() - 0.5) * 14 * cloudScale;

      dummy.position.set(
        cloudX + offsetX,
        cloudY + offsetY,
        cloudZ + offsetZ
      );

      
      const puffScale = (isCenter ? (1.3 + Math.random() * 0.4) : (0.5 + Math.random() * 0.7)) * cloudScale;
      
      
      dummy.scale.set(puffScale, puffScale * 0.65, puffScale);
      
      
      dummy.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      dummy.updateMatrix();
      instanced.setMatrixAt(instanceIndex++, dummy.matrix);
    }
  }

  instanced.instanceMatrix.needsUpdate = true;

  group.add(instanced);
  scene.add(group);

  return group;
}