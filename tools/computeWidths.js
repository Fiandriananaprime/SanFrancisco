#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const scriptPath = process.argv[1] || '.';
const scriptDir = path.dirname(scriptPath);
const ASSET_DIR = path.resolve(scriptDir, '..', 'City Pack.undefined-glb');
const OUT_JSON = path.resolve(scriptDir, '..', 'width.json');
const OUT_JS = path.resolve(scriptDir, '..', 'width.js');
const scaleFactor = 2; // Scale factor applied to the models

function isCharacterFile(filename) {
  const name = filename.toLowerCase().replace(/\.glb$/, '');
  const re = /\b(man|woman|person|people|character|animated|girl|boy|mannequin)\b/;
  if (name.includes('manhole')) return false;
  return re.test(name);
}
function readUInt32LE(buffer, offset) { return buffer.readUInt32LE(offset); }

function parseGLB(buffer) {
  if (buffer.length < 12) throw new Error('Invalid GLB');
  const magic = buffer.toString('utf8', 0, 4);
  if (magic !== 'glTF') throw new Error('Not a GLB');
  let offset = 12, json = null, bin = null;
  while (offset + 8 <= buffer.length) {
    const chunkLength = readUInt32LE(buffer, offset);
    const chunkType = buffer.toString('utf8', offset + 4, offset + 8);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;
    const chunk = buffer.slice(chunkStart, chunkEnd);
    if (chunkType === 'JSON') json = JSON.parse(chunk.toString('utf8'));
    else if (chunkType === 'BIN\u0000') bin = chunk;
    offset = chunkEnd;
  }
  return { json, bin };
}

function quatToMat(q) {
  const [x,y,z,w] = q;
  const x2 = x+x, y2 = y+y, z2 = z+z;
  const xx = x*x2, xy = x*y2, xz = x*z2;
  const yy = y*y2, yz = y*z2, zz = z*z2;
  const wx = w*x2, wy = w*y2, wz = w*z2;
  return [
    1-(yy+zz), xy-wz, xz+wy, 0,
    xy+wz, 1-(xx+zz), yz-wx, 0,
    xz-wy, yz+wx, 1-(xx+yy), 0,
    0,0,0,1
  ];
}

function composeTRS(node = {}) {
  const t = node.translation || [0,0,0];
  const r = node.rotation || [0,0,0,1];
  const s = node.scale || [1,1,1];
  const R = quatToMat(r);
  R[0]*=s[0]; R[1]*=s[0]; R[2]*=s[0];
  R[4]*=s[1]; R[5]*=s[1]; R[6]*=s[1];
  R[8]*=s[2]; R[9]*=s[2]; R[10]*=s[2];
  R[12]=t[0]; R[13]=t[1]; R[14]=t[2];
  return R;
}

function mulMat(a,b){
  const out = new Array(16).fill(0);
  for (let i=0;i<4;i++) for (let j=0;j<4;j++) for (let k=0;k<4;k++) out[j*4+i]+=a[k*4+i]*b[j*4+k];
  return out;
}

function transformPoint(mat,x,y,z){
  const rx = mat[0]*x + mat[4]*y + mat[8]*z + mat[12];
  const ry = mat[1]*x + mat[5]*y + mat[9]*z + mat[13];
  const rz = mat[2]*x + mat[6]*y + mat[10]*z + mat[14];
  const rw = mat[3]*x + mat[7]*y + mat[11]*z + mat[15];
  if (rw && rw !== 1) return [rx/rw, ry/rw, rz/rw];
  return [rx,ry,rz];
}

function componentTypeToByteSize(t){
  switch(t){case 5126: return 4; case 5123: return 2; case 5125: return 4; case 5122: return 2; case 5121: return 1; case 5120: return 1;}
  throw new Error('unsupported componentType '+t);
}

function readAccessorMinMax(json, bin, accessor){
  if (accessor.min && accessor.max) return {min:accessor.min.slice(), max:accessor.max.slice()};
  const bvs = json.bufferViews||[];
  const bv = bvs[accessor.bufferView];
  if (!bv) return null;
  const byteOffset = (bv.byteOffset||0) + (accessor.byteOffset||0);
  const compSize = componentTypeToByteSize(accessor.componentType);
  const numComp = accessor.type==='VEC3'?3:(accessor.type==='VEC2'?2:1);
  const count = accessor.count||0;
  const stride = bv.byteStride || (compSize * numComp);
  if (accessor.componentType !== 5126) return null;
  let min=[Infinity,Infinity,Infinity], max=[-Infinity,-Infinity,-Infinity];
  for (let i=0;i<count;i++){
    const off = byteOffset + i*stride;
    const x = bin.readFloatLE(off), y = bin.readFloatLE(off+4), z = bin.readFloatLE(off+8);
    min[0]=Math.min(min[0],x); min[1]=Math.min(min[1],y); min[2]=Math.min(min[2],z);
    max[0]=Math.max(max[0],x); max[1]=Math.max(max[1],y); max[2]=Math.max(max[2],z);
  }
  return {min,max};
}

function computeBoundingBoxFromGLB(buffer){
  const {json,bin} = parseGLB(buffer);
  if (!json||!bin) return null;
  const accessors = json.accessors||[];
  const meshes = json.meshes||[];
  const nodes = json.nodes||[];
  const scenes = json.scenes||[];

  const local = nodes.map(n => (n&&n.matrix? n.matrix.slice() : composeTRS(n)));
  const world = new Array(nodes.length).fill(null);
  function computeWorld(i,parent){
    const l = local[i]||[1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
    const w = parent ? mulMat(parent,l) : l;
    world[i]=w;
    const ch = (nodes[i]&&nodes[i].children)||[];
    for (const c of ch) computeWorld(c,w);
  }
  if (scenes.length>0){ for (const sc of scenes) for (const r of (sc.nodes||[])) computeWorld(r,null); }
  else for (let i=0;i<nodes.length;i++) if (!world[i]) computeWorld(i,null);

  let minX=Infinity,minY=Infinity,minZ=Infinity; let maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;

  nodes.forEach((node,ni)=>{
    if (!node||node.mesh===undefined) return;
    const mesh = meshes[node.mesh]; if (!mesh) return;
    const nodeWorld = world[ni]||[1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
    for (const prim of (mesh.primitives||[])){
      const posIdx = (prim.attributes||{}).POSITION; if (posIdx===undefined) continue;
      const acc = accessors[posIdx]; if (!acc) continue;
      const mm = (acc.min&&acc.max) ? {min:acc.min.slice(), max:acc.max.slice()} : readAccessorMinMax(json,bin,acc);
      if (!mm) continue;
      const mn = mm.min, mx = mm.max;
      const corners = [
        [mn[0],mn[1],mn[2]],[mn[0],mn[1],mx[2]],[mn[0],mx[1],mn[2]],[mn[0],mx[1],mx[2]],
        [mx[0],mn[1],mn[2]],[mx[0],mn[1],mx[2]],[mx[0],mx[1],mn[2]],[mx[0],mx[1],mx[2]]
      ];
      for (const v of corners){
        const [tx,ty,tz] = transformPoint(nodeWorld, v[0], v[1], v[2]);
        minX = Math.min(minX, tx); minY = Math.min(minY, ty); minZ = Math.min(minZ, tz);
        maxX = Math.max(maxX, tx); maxY = Math.max(maxY, ty); maxZ = Math.max(maxZ, tz);
      }
    }
  });

  if (minX===Infinity) return null;
  return { min:[minX,minY,minZ], max:[maxX,maxY,maxZ], sizeX: maxX-minX, sizeY: maxY-minY, sizeZ: maxZ-minZ };
}
const ASSETS_JS = path.resolve(scriptDir, '..', 'src', 'assets.js');

function categorize(file) {
  const n = file.toLowerCase();

  if (
    n.includes('road')
  ) return 'road';

  if (
    n.includes('car') ||
    n.includes('truck') ||
    n.includes('bus') ||
    n.includes('motorcycle') ||
    n.includes('bicycle') ||
    n.includes('van') ||
    n.includes('suv')
  ) return 'vehicles';

  if (isCharacterFile(file))
    return 'people';

  if (
    n.includes('building') ||
    n.includes('house') ||
    n.includes('pizza corner') ||
    n.includes('greenhouse')
  ) return 'buildings';

  return 'props';
}
async function main(){
  if (!fs.existsSync(ASSET_DIR)) { console.error('Asset directory not found:', ASSET_DIR); process.exit(1); }
  const files = fs.readdirSync(ASSET_DIR).filter(f=>f.toLowerCase().endsWith('.glb'));
  const groups = {
  road: [],
  buildings: [],
  vehicles: [],
  props: [],
  people: []
};

for (const file of files) {
  groups[categorize(file)].push(file);
}

const assetLines = [];

assetLines.push('export const ASSETS = {');

for (const [key, values] of Object.entries(groups)) {
  assetLines.push(`  ${key}: [`);
  values.sort().forEach(v => {
    assetLines.push(`    ${JSON.stringify(v)},`);
  });
  assetLines.push('  ],');
}

assetLines.push('};');
assetLines.push('');
assetLines.push('export function getURL(str) {');
assetLines.push("  return `../City Pack.undefined-glb/${str}`;");
assetLines.push('}');

fs.writeFileSync(
  ASSETS_JS,
  assetLines.join('\n') + '\n'
);


  const results = {};
  let existing = {};
  if (fs.existsSync(OUT_JSON)) { try{ existing = JSON.parse(fs.readFileSync(OUT_JSON,'utf8')); } catch(e){} }
  const characters = [];
  for (const file of files){
    const abs = path.join(ASSET_DIR,file);
    try{
      process.stdout.write(`Processing ${file}... `);
      const buf = fs.readFileSync(abs);
      const bbox = computeBoundingBoxFromGLB(buf);
      if (!bbox) { process.stdout.write('no geometry\n'); continue; }
      let {sizeX,sizeY,sizeZ} = bbox; let radiusX = sizeX/2, radiusZ = sizeZ/2;
      const isChar = isCharacterFile(file);
      if (isChar) characters.push(file);
      if (!isChar && scaleFactor && scaleFactor !== 1) {
        sizeX *= scaleFactor; sizeY *= scaleFactor; sizeZ *= scaleFactor;
        radiusX *= scaleFactor; radiusZ *= scaleFactor;
      }
      results[file] = { sizeX, sizeY, sizeZ, radiusX, radiusZ };
      process.stdout.write(`done (X=${sizeX.toFixed(3)} Z=${sizeZ.toFixed(3)})\n`);
    } catch(e){ console.error(`Error processing ${file}:`, e && e.message ? e.message : e); }
  }
  const merged = { ...existing, ...results };

  const lines = [];
  lines.push('// This file is generated by tools/computeWidths.js');
  lines.push('export const WIDTHS = {');
  for (const k of Object.keys(merged)) {
    const v = merged[k];
    lines.push(`  ${JSON.stringify(k)}: { sizeX: ${v.sizeX.toFixed(6)}, sizeY: ${v.sizeY.toFixed(6)}, sizeZ: ${v.sizeZ.toFixed(6)}, radiusX: ${v.radiusX.toFixed(6)}, radiusZ: ${v.radiusZ.toFixed(6)} },`);
  }
  lines.push('};');
  lines.push('export const CHARACTERS = ' + JSON.stringify(characters, null, 2) + ';');
  lines.push('export default WIDTHS;');
  fs.writeFileSync(OUT_JS, lines.join('\n') + '\n');
  try {
    if (fs.existsSync(OUT_JSON)) fs.unlinkSync(OUT_JSON);
  } catch (e) {
  }
  console.log('Wrote', OUT_JS);
}

main().catch(e=>{ console.error(e); process.exit(1); });
 