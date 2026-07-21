import * as THREE from 'three';


export function addClouds(scene, { count = 40, height = 60, spread = 400 } = {}) {
  const group = new THREE.Group();
  group.name = 'nuages';

  const geometry = new THREE.SphereGeometry(4, 8, 6);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
  const instanced = new THREE.InstancedMesh(geometry, material, count);
  instanced.name = 'nuages_instanced';

  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    dummy.position.set(
      (Math.random() - 0.5) * spread,
      height + (Math.random() - 0.5) * 8,
      (Math.random() - 0.5) * spread
    );
    const scale = 0.6 + Math.random() * 1.4;
    dummy.scale.set(scale, scale * 0.55, scale);
    dummy.rotation.y = Math.random() * Math.PI;
    dummy.updateMatrix();
    instanced.setMatrixAt(i, dummy.matrix);
  }
  instanced.instanceMatrix.needsUpdate = true;

  group.add(instanced);
  scene.add(group);
  return group;
}
