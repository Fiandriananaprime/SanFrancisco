
const { exec } = require('child_process');

const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Road Mapping</title>
  <style>
    html, body { margin:0; width:100%; height:100%; overflow:hidden; background:#111; }
    #app { width:100vw; height:100vh; }
  </style>
</head>
<body>
<div id="app"></div>

<script type="module">
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179/build/three.module.js';

const container = document.getElementById('app');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x20242c);

const camera = new THREE.OrthographicCamera(-200,200,200,-200,0.1,1000);
camera.position.set(0,500,0);
camera.up.set(0,0,-1);
camera.lookAt(0,0,0);

const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

// Sol
const plane = new THREE.Mesh(
  new THREE.PlaneGeometry(400,400),
  new THREE.MeshBasicMaterial({ color:0x3a3f4b, side:THREE.DoubleSide })
);
plane.rotation.x = -Math.PI / 2;
scene.add(plane);

// Chunk de test
const chunk = new THREE.Mesh(
  new THREE.PlaneGeometry(20,20),
  new THREE.MeshBasicMaterial({ color:0x666666, side:THREE.DoubleSide })
);
chunk.rotation.x = -Math.PI / 2;
chunk.position.set(40,0.1,40);
scene.add(chunk);

renderer.render(scene, camera);
</script>
</body>
</html>
`;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
});

const PORT = 3000;

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log('RoadMapping lancé : ' + url);

  const cmd =
    process.platform === 'win32' ? `start ${url}` :
    process.platform === 'darwin' ? `open ${url}` :
    `xdg-open ${url}`;

  exec(cmd);
});