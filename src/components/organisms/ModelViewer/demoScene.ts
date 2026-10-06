import * as THREE from 'three';

/** Демо-геометрия с userData.elementId = ключ из properties.json */
export const buildDemoScene = (): THREE.Group => {
  const root = new THREE.Group();
  root.name = 'demo-kns';

  const addBox = (
    id: string,
    size: [number, number, number],
    position: [number, number, number],
    color: string,
  ) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(...size),
      new THREE.MeshStandardMaterial({ color, metalness: 0.1, roughness: 0.55 }),
    );
    mesh.position.set(...position);
    mesh.userData.elementId = id;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  };

  // Фундаменты
  addBox('found-01', [8, 0.6, 6], [0, 0.3, 0], '#4a6fa5');
  addBox('found-02', [1.2, 1.2, 1.2], [-3, 0.9, -2], '#5b7fbf');
  addBox('found-03', [1.2, 1.2, 1.2], [3, 0.9, -2], '#5b7fbf');
  addBox('found-04', [7, 0.5, 0.8], [0, 0.85, 2.5], '#3d5f8f');

  // Стена
  addBox('wall-01', [7.5, 3.2, 0.25], [0, 2.6, -2.8], '#7a8fa8');

  // Труба (цилиндр)
  const pipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 5, 16),
    new THREE.MeshStandardMaterial({ color: '#00bcd4', metalness: 0.4, roughness: 0.35 }),
  );
  pipe.rotation.z = Math.PI / 2;
  pipe.position.set(0, 1.8, 0.5);
  pipe.userData.elementId = 'pipe-01';
  root.add(pipe);

  return root;
};
