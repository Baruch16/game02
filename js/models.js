// Procedural aircraft models. Nose points along +Z, up is +Y, right wing is -X.
import * as THREE from './vendor/three.module.min.js';
import { TEX } from './fx.js';

const texCache = new Map();
function paintTexture(p) {
  const key = p.base + p.second + p.accent + p.pattern;
  if (texCache.has(key)) return texCache.get(key);
  const s = 256, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  g.fillStyle = p.base; g.fillRect(0, 0, s, s);
  let seed = key.length * 77;
  const R = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  if (p.pattern === 'camo') {
    for (let i = 0; i < 26; i++) {
      g.fillStyle = i % 3 === 0 ? p.accent + '55' : p.second;
      g.beginPath(); const x = R() * s, y = R() * s;
      g.moveTo(x, y);
      for (let k = 0; k < 7; k++) g.lineTo(x + (R() - 0.5) * 90, y + (R() - 0.5) * 90);
      g.closePath(); g.fill();
    }
  } else if (p.pattern === 'splinter') {
    for (let i = 0; i < 18; i++) {
      g.fillStyle = i % 2 ? p.second : p.base;
      g.beginPath(); g.moveTo(R() * s, R() * s); g.lineTo(R() * s, R() * s); g.lineTo(R() * s, R() * s); g.closePath(); g.fill();
    }
  } else if (p.pattern === 'tiger') {
    g.fillStyle = p.second;
    for (let i = 0; i < 14; i++) {
      const y = i * s / 14 + R() * 6; g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= s; x += 16) g.lineTo(x, y + Math.sin(x * 0.05 + i) * 6 + R() * 4);
      for (let x = s; x >= 0; x -= 16) g.lineTo(x, y + 5 + Math.sin(x * 0.07 + i) * 3);
      g.closePath(); g.fill();
    }
  } else if (p.pattern === 'stripe') {
    g.fillStyle = p.second; g.fillRect(0, s * 0.42, s, s * 0.16);
    g.fillStyle = p.accent; g.fillRect(0, s * 0.47, s, s * 0.04);
  }
  // panel lines
  g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1;
  for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(i * s / 9 + 4, 0); g.lineTo(i * s / 9 + 4, s); g.stroke(); }
  for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(0, i * s / 5 + 8); g.lineTo(s, i * s / 5 + 8); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  texCache.set(key, t);
  return t;
}

function mats(p) {
  const tex = paintTexture(p);
  return {
    body: new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, roughness: 0.55, metalness: 0.35 }),
    wing: new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, roughness: 0.6, metalness: 0.3, side: THREE.DoubleSide }),
    dark: new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.7, metalness: 0.5 }),
    accent: new THREE.MeshStandardMaterial({ color: p.accent, roughness: 0.4, metalness: 0.4, emissive: p.accent, emissiveIntensity: 0.08 }),
    canopy: new THREE.MeshStandardMaterial({ color: 0x0a1a2c, roughness: 0.05, metalness: 0.9, emissive: 0x112244, emissiveIntensity: 0.4 }),
    nozzle: new THREE.MeshStandardMaterial({ color: 0x3a3a3e, roughness: 0.5, metalness: 0.9 }),
    missile: new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.5, metalness: 0.2 }),
  };
}

// fuselage via lathe: profile [z, radius]
function fuselage(profile, mat, sx = 1, sy = 1) {
  const pts = profile.map(([z, r]) => new THREE.Vector2(Math.max(0.001, r), z));
  const g = new THREE.LatheGeometry(pts, 14);
  g.rotateX(Math.PI / 2); // lathe axis Y → Z; profile y→ z... after rotation y->z
  g.scale(sx, sy, 1);
  // LatheGeometry builds around Y with points (r, y). rotateX(+90°) maps +Y → +Z
  const m = new THREE.Mesh(g, mat); return m;
}

// flat wing from planform polygon in (x, z), thickness t; mirrored if needed
function plate(points, t, mat) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, z)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: true, bevelThickness: t * 0.3, bevelSize: t * 0.4, bevelSegments: 1 });
  g.translate(0, 0, -t / 2);
  g.rotateX(Math.PI / 2); // shape (x, y) → world (x, z); thickness → y
  return new THREE.Mesh(g, mat);
}
function wingPair(points, t, mat, y = 0, dihedral = 0) {
  const grp = new THREE.Group();
  const l = plate(points, t, mat); l.rotation.z = dihedral; grp.add(l);
  const r = plate(points.map(([x, z]) => [-x, z]), t, mat); r.rotation.z = -dihedral; grp.add(r);
  grp.position.y = y; return grp;
}
function fin(points, t, mat, x = 0, y = 0, cant = 0) {
  // points in (height h, z): build in xz then rotate to vertical
  const m = plate(points, t, mat);
  m.rotation.z = Math.PI / 2 - cant; m.position.set(x, y, 0);
  return m;
}

function nozzle(mat, x, z, r, len = 1.2) {
  const g = new THREE.CylinderGeometry(r * 0.9, r, len, 14, 1, true); g.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, mat); m.position.set(x, 0, z); return m;
}

function missileMesh(m) {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 2.6, 8).rotateX(Math.PI / 2), m.missile);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.4, 8).rotateX(Math.PI / 2), m.missile); tip.position.z = 1.5;
  grp.add(body, tip);
  return grp;
}

// ------------------------------------------------------------------ designs
// each returns {group, engines:[{x,z,r}], length, pylons:[[x,y,z]], canopy z}
const DESIGNS = {
  sparrow(M) {
    const g = new THREE.Group();
    g.add(fuselage([[-5.5, 0.55], [-4.8, 0.7], [-1, 0.8], [2, 0.75], [4, 0.45], [5.6, 0.05]], M.body));
    g.add(wingPair([[0.5, 1.5], [4.3, -0.6], [4.3, -1.6], [0.5, -2.4]], 0.12, M.wing, -0.2, 0.03));
    g.add(wingPair([[0.3, -4.0], [2.2, -5.2], [2.2, -5.7], [0.3, -5.6]], 0.08, M.wing, 0.1));
    g.add(fin([[0.5, -3.3], [2.8, -5.0], [2.8, -5.6], [0.5, -5.6]], 0.1, M.wing, 0, 0.3));
    return { g, engines: [{ x: 0, z: -5.6, r: 0.48 }], len: 11, canopy: [0, 0.6, 2.0, 0.42, 1.6], pylons: [[2.6, -0.35, 0], [-2.6, -0.35, 0], [3.6, -0.3, -0.6], [-3.6, -0.3, -0.6]] };
  },
  gnat(M) {
    const g = new THREE.Group();
    g.add(fuselage([[-5, 0.55], [-4, 0.75], [0, 0.8], [3, 0.6], [5, 0.05]], M.body));
    g.add(wingPair([[0.6, 1.0], [3.6, -2.6], [3.6, -3.2], [0.6, -3.4]], 0.12, M.wing, -0.2));
    g.add(fin([[0.5, -2.5], [2.6, -4.4], [2.6, -5.0], [0.5, -5.0]], 0.1, M.wing, 0, 0.3));
    g.add(wingPair([[0.3, -4.0], [1.8, -4.8], [1.8, -5.2], [0.3, -5.1]], 0.08, M.wing));
    return { g, engines: [{ x: 0, z: -5.0, r: 0.5 }], len: 10, canopy: [0, 0.6, 1.6, 0.4, 1.5], pylons: [[2.4, -0.35, -1.4], [-2.4, -0.35, -1.4]] };
  },
  falcon(M) {
    const g = new THREE.Group();
    g.add(fuselage([[-7.2, 0.55], [-6.5, 0.72], [-2, 0.9], [2, 0.85], [4.5, 0.55], [7.3, 0.04]], M.body));
    const intake = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 3), M.dark); intake.position.set(0, -0.85, 1.2); g.add(intake);
    g.add(wingPair([[0.6, 2.4], [1.4, 0.6], [4.9, -2.4], [4.9, -3.0], [0.6, -3.6]], 0.13, M.wing, -0.15));
    g.add(wingPair([[0.4, -5.3], [2.8, -6.6], [2.8, -7.2], [0.4, -7.1]], 0.08, M.wing, -0.1, -0.08));
    g.add(fin([[0.6, -3.8], [3.4, -6.2], [3.4, -7.0], [0.6, -7.0]], 0.12, M.wing, 0, 0.5));
    return { g, engines: [{ x: 0, z: -7.3, r: 0.5 }], len: 14.6, canopy: [0, 0.75, 3.0, 0.45, 2.0], pylons: [[2.4, -0.4, -1.0], [-2.4, -0.4, -1.0], [3.5, -0.4, -1.8], [-3.5, -0.4, -1.8], [4.8, 0, -2.6], [-4.8, 0, -2.6]] };
  },
  hornet(M) {
    const g = new THREE.Group();
    g.add(fuselage([[-7.6, 0.5], [-6.8, 0.9], [-2, 1.05], [2, 0.9], [5, 0.6], [7.8, 0.05]], M.body, 1.25, 1));
    g.add(wingPair([[1.2, 5.0], [1.0, 1.8], [2.0, 0.4], [5.8, -2.0], [5.8, -2.8], [1.2, -3.6]], 0.14, M.wing, -0.1));
    g.add(wingPair([[0.6, -5.2], [3.4, -6.6], [3.4, -7.4], [0.6, -7.4]], 0.08, M.wing, -0.1));
    g.add(fin([[0.6, -3.6], [3.0, -5.6], [3.0, -6.4], [0.6, -6.6]], 0.12, M.wing, 1.0, 0.4, 0.35));
    g.add(fin([[0.6, -3.6], [3.0, -5.6], [3.0, -6.4], [0.6, -6.6]], 0.12, M.wing, -1.0, 0.4, -0.35));
    return { g, engines: [{ x: 0.55, z: -7.6, r: 0.46 }, { x: -0.55, z: -7.6, r: 0.46 }], len: 15.4, canopy: [0, 0.85, 3.2, 0.48, 2.1], pylons: [[2.6, -0.45, -1.0], [-2.6, -0.45, -1.0], [3.8, -0.45, -1.6], [-3.8, -0.45, -1.6], [5.6, 0, -2.4], [-5.6, 0, -2.4]] };
  },
  fishbed(M) {
    const g = new THREE.Group();
    g.add(fuselage([[-6.5, 0.55], [-5.5, 0.75], [0, 0.85], [4, 0.75], [6.6, 0.55]], M.body));
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1, 10).rotateX(Math.PI / 2), M.dark); cone.position.z = 6.7; g.add(cone);
    g.add(wingPair([[0.7, 1.2], [4.0, -3.0], [4.0, -3.6], [0.7, -3.6]], 0.12, M.wing, -0.1));
    g.add(wingPair([[0.4, -4.5], [2.2, -5.8], [2.2, -6.3], [0.4, -6.2]], 0.08, M.wing));
    g.add(fin([[0.6, -2.6], [3.3, -5.4], [3.3, -6.2], [0.6, -6.4]], 0.12, M.wing, 0, 0.4));
    return { g, engines: [{ x: 0, z: -6.5, r: 0.52 }], len: 13.4, canopy: [0, 0.7, 2.2, 0.42, 1.6], pylons: [[2.2, -0.35, -1.5], [-2.2, -0.35, -1.5], [3.0, -0.35, -2.2], [-3.0, -0.35, -2.2]] };
  },
  fulcrum(M) {
    const g = new THREE.Group();
    g.add(fuselage([[-7.4, 0.4], [-6, 0.75], [-1, 0.9], [3, 0.8], [5.5, 0.5], [7.6, 0.05]], M.body, 1.6, 0.85));
    g.add(wingPair([[1.0, 4.2], [1.0, 1.0], [5.6, -2.8], [5.6, -3.4], [1.0, -4.2]], 0.13, M.wing, -0.1));
    g.add(wingPair([[0.8, -5.3], [3.2, -6.8], [3.2, -7.4], [0.8, -7.3]], 0.08, M.wing, -0.1));
    g.add(fin([[0.6, -3.8], [3.0, -6.0], [3.0, -6.8], [0.6, -7.0]], 0.12, M.wing, 1.2, 0.4, 0.12));
    g.add(fin([[0.6, -3.8], [3.0, -6.0], [3.0, -6.8], [0.6, -7.0]], 0.12, M.wing, -1.2, 0.4, -0.12));
    return { g, engines: [{ x: 0.75, z: -7.4, r: 0.48 }, { x: -0.75, z: -7.4, r: 0.48 }], len: 15, canopy: [0, 0.72, 3.3, 0.45, 2.0], pylons: [[2.6, -0.4, -1.5], [-2.6, -0.4, -1.5], [3.6, -0.4, -2.0], [-3.6, -0.4, -2.0]] };
  },
  lancer(M) {
    const g = new THREE.Group();
    g.add(fuselage([[-9.5, 0.6], [-8, 1.0], [-2, 1.1], [3, 1.0], [6.5, 0.6], [9.6, 0.05]], M.body, 1.5, 0.9));
    g.add(wingPair([[1.4, 1.0], [6.0, -3.6], [6.0, -4.4], [1.4, -5.0]], 0.14, M.wing, 0.1, -0.06));
    g.add(wingPair([[0.9, -6.4], [3.6, -8.4], [3.6, -9.0], [0.9, -9.0]], 0.08, M.wing, 0));
    g.add(fin([[0.8, -5.0], [3.6, -7.8], [3.6, -8.8], [0.8, -9.0]], 0.13, M.wing, 1.2, 0.5, 0.18));
    g.add(fin([[0.8, -5.0], [3.6, -7.8], [3.6, -8.8], [0.8, -9.0]], 0.13, M.wing, -1.2, 0.5, -0.18));
    return { g, engines: [{ x: 0.85, z: -9.5, r: 0.62 }, { x: -0.85, z: -9.5, r: 0.62 }], len: 19, canopy: [0, 0.9, 5.0, 0.45, 2.0], pylons: [[2.8, -0.3, -2.4], [-2.8, -0.3, -2.4], [4.2, -0.3, -3.2], [-4.2, -0.3, -3.2]] };
  },
  eagle(M) {
    const g = new THREE.Group();
    g.add(fuselage([[-8.8, 0.5], [-7.8, 0.85], [-2, 1.05], [3, 0.95], [6, 0.6], [9, 0.05]], M.body, 1.55, 0.9));
    g.add(wingPair([[1.3, 1.8], [6.6, -2.8], [6.6, -3.8], [1.3, -4.8]], 0.14, M.wing, 0.05));
    g.add(wingPair([[1.0, -6.0], [3.8, -7.6], [3.8, -8.5], [1.0, -8.6]], 0.08, M.wing, 0));
    g.add(fin([[0.8, -4.8], [3.6, -7.4], [3.6, -8.4], [0.8, -8.6]], 0.13, M.wing, 1.25, 0.5, 0.0));
    g.add(fin([[0.8, -4.8], [3.6, -7.4], [3.6, -8.4], [0.8, -8.6]], 0.13, M.wing, -1.25, 0.5, 0.0));
    return { g, engines: [{ x: 0.7, z: -8.8, r: 0.55 }, { x: -0.7, z: -8.8, r: 0.55 }], len: 17.8, canopy: [0, 0.9, 4.0, 0.5, 2.2], pylons: [[3.0, -0.35, -2.0], [-3.0, -0.35, -2.0], [4.4, -0.35, -2.6], [-4.4, -0.35, -2.6], [1.3, -0.9, 0.5], [-1.3, -0.9, 0.5]] };
  },
  tempest(M) {
    const g = new THREE.Group();
    g.add(fuselage([[-9.2, 0.45], [-8, 0.8], [-2, 1.0], [3, 0.95], [6.5, 0.55], [9.6, 0.04]], M.body, 1.8, 0.8));
    g.add(wingPair([[1.2, 4.6], [1.6, 1.2], [7.0, -3.2], [7.0, -4.0], [1.6, -5.2]], 0.14, M.wing, 0));
    g.add(wingPair([[0.6, 5.6], [2.2, 4.8], [2.2, 4.4], [0.6, 4.2]], 0.07, M.wing, 0.2)); // canards
    g.add(wingPair([[1.3, -6.4], [4.0, -8.0], [4.0, -8.8], [1.3, -8.8]], 0.08, M.wing, 0));
    g.add(fin([[0.8, -5.2], [3.8, -7.6], [3.8, -8.6], [0.8, -8.8]], 0.13, M.wing, 1.5, 0.4, 0.05));
    g.add(fin([[0.8, -5.2], [3.8, -7.6], [3.8, -8.6], [0.8, -8.8]], 0.13, M.wing, -1.5, 0.4, -0.05));
    return { g, engines: [{ x: 1.05, z: -9.2, r: 0.55 }, { x: -1.05, z: -9.2, r: 0.55 }], len: 18.8, canopy: [0, 0.82, 4.6, 0.48, 2.2], pylons: [[3.0, -0.4, -2.2], [-3.0, -0.4, -2.2], [4.4, -0.4, -3.0], [-4.4, -0.4, -3.0], [5.6, -0.3, -3.5], [-5.6, -0.3, -3.5]] };
  },
  wraith(M) {
    const g = new THREE.Group();
    const body = fuselage([[-8.6, 0.55], [-7, 0.9], [-1, 1.05], [3, 0.9], [6, 0.55], [9.2, 0.03]], M.body, 1.9, 0.6);
    g.add(body);
    g.add(wingPair([[1.5, 3.2], [6.6, -2.6], [6.6, -3.4], [4.8, -5.0], [1.5, -5.4]], 0.13, M.wing, 0));
    g.add(wingPair([[1.2, -6.2], [4.0, -7.8], [4.0, -8.6], [1.2, -8.6]], 0.08, M.wing, 0));
    g.add(fin([[0.6, -4.6], [3.2, -6.8], [3.2, -7.8], [0.6, -8.0]], 0.12, M.wing, 1.4, 0.35, 0.45));
    g.add(fin([[0.6, -4.6], [3.2, -6.8], [3.2, -7.8], [0.6, -8.0]], 0.12, M.wing, -1.4, 0.35, -0.45));
    return { g, engines: [{ x: 0.8, z: -8.6, r: 0.5 }, { x: -0.8, z: -8.6, r: 0.5 }], len: 17.8, canopy: [0, 0.7, 4.3, 0.48, 2.3], pylons: [] , flatNozzle: true };
  },
  felon(M) {
    const g = new THREE.Group();
    g.add(fuselage([[-10, 0.5], [-8.5, 0.9], [-1, 1.1], [4, 0.9], [7, 0.5], [10.2, 0.03]], M.body, 2.0, 0.6));
    g.add(wingPair([[1.6, 3.8], [7.2, -3.4], [7.2, -4.2], [1.6, -5.8]], 0.13, M.wing, 0));
    g.add(wingPair([[1.0, 7.0], [2.4, 6.0], [2.4, 5.5], [1.0, 5.4]], 0.07, M.wing, 0.15));
    g.add(fin([[0.6, -6.2], [2.6, -7.8], [2.6, -8.6], [0.6, -9.0]], 0.12, M.wing, 1.6, 0.35, 1.1));
    g.add(fin([[0.6, -6.2], [2.6, -7.8], [2.6, -8.6], [0.6, -9.0]], 0.12, M.wing, -1.6, 0.35, -1.1));
    return { g, engines: [{ x: 1.0, z: -10, r: 0.55 }, { x: -1.0, z: -10, r: 0.55 }], len: 20.4, canopy: [0, 0.75, 5.0, 0.48, 2.3], pylons: [] };
  },
  phantom(M) {
    const g = new THREE.Group();
    g.add(fuselage([[-6.5, 0.55], [-5, 0.9], [0, 1.1], [4, 0.9], [7, 0.45], [9.0, 0.03]], M.body, 1.9, 0.6));
    g.add(wingPair([[1.2, 4.6], [8.2, -4.4], [7.6, -5.4], [4.6, -4.2], [3.2, -6.4], [1.2, -6.5]], 0.15, M.wing, 0));
    return { g, engines: [{ x: 0.75, z: -6.5, r: 0.45 }, { x: -0.75, z: -6.5, r: 0.45 }], len: 15.5, canopy: [0, 0.72, 3.6, 0.46, 2.1], pylons: [], flatNozzle: true };
  },
  spectre(M) {
    const g = new THREE.Group();
    g.add(fuselage([[-7, 0.6], [-5, 1.0], [0, 1.2], [4, 0.9], [8, 0.03]], M.body, 2.2, 0.55));
    g.add(wingPair([[1.2, 6.0], [10.5, -4.0], [9.0, -5.6], [6.0, -3.6], [4.0, -6.2], [1.2, -7.0]], 0.16, M.wing, 0));
    return { g, engines: [{ x: 0.9, z: -7, r: 0.45 }, { x: -0.9, z: -7, r: 0.45 }], len: 15, canopy: [0, 0.7, 3.2, 0.5, 2.0], pylons: [], flatNozzle: true };
  },
  leviathan(M) {
    const g = new THREE.Group();
    g.add(fuselage([[-10, 0.8], [-8.5, 1.4], [-2, 1.6], [4, 1.4], [8, 0.8], [10.5, 0.05]], M.body, 1.6, 1.0));
    g.add(wingPair([[1.8, 2.5], [9.5, -1.8], [9.5, -3.2], [1.8, -5.0]], 0.2, M.wing, 0.2, -0.04));
    g.add(wingPair([[1.0, 8.0], [3.2, 6.6], [3.2, 6.0], [1.0, 5.8]], 0.08, M.wing, 0.3));
    g.add(wingPair([[1.0, -7.2], [4.8, -9.0], [4.8, -9.8], [1.0, -9.8]], 0.1, M.wing, 0));
    g.add(fin([[0.6, -5.8], [4.2, -8.6], [4.2, -9.8], [0.6, -10.2]], 0.15, M.wing, 1.6, 0.6, 0.15));
    g.add(fin([[0.6, -5.8], [4.2, -8.6], [4.2, -9.8], [0.6, -10.2]], 0.15, M.wing, -1.6, 0.6, -0.15));
    // missile racks
    for (let s of [-1, 1]) for (let k = 0; k < 3; k++) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 3), M.dark); r.position.set(s * (3.5 + k * 1.8), -0.4, -1.2 - k * 0.6); g.add(r);
    }
    return { g, engines: [{ x: 1.1, z: -10, r: 0.7 }, { x: -1.1, z: -10, r: 0.7 }, { x: 0, z: -10, r: 0.6 }], len: 21, canopy: [0, 1.15, 5.5, 0.6, 2.6], pylons: [[5.5, -0.5, -2], [-5.5, -0.5, -2], [7, -0.5, -2.5], [-7, -0.5, -2.5]] };
  },
};

// ------------------------------------------------------------------ public builder
export function buildJet(design, paint, opts = {}) {
  const M = mats(paint);
  const d = (DESIGNS[design] || DESIGNS.sparrow)(M);
  const root = new THREE.Group();
  const g = d.g;
  // canopy
  const [cx, cy, cz, cr, cl] = d.canopy;
  const can = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.canopy);
  can.scale.set(cr, cr * 1.05, cl); can.position.set(cx, cy - 0.15, cz); g.add(can);
  // nozzles + afterburner glow sprites
  const flames = [];
  for (const e of d.engines) {
    const n = nozzle(M.nozzle, e.x, e.z - 0.3, e.r, 1.0);
    if (d.flatNozzle) n.scale.y = 0.6;
    g.add(n);
    const glowMat = new THREE.SpriteMaterial({ map: TEX.soft, color: 0xff8a3a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false });
    const glow = new THREE.Sprite(glowMat); glow.position.set(e.x, 0, e.z - 0.9); glow.scale.setScalar(e.r * 3);
    g.add(glow);
    // flame cone
    const coneMat = new THREE.MeshBasicMaterial({ color: 0xffa050, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(e.r * 0.8, 1, 12, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -0.5), coneMat);
    cone.position.set(e.x, 0, e.z - 0.7);
    g.add(cone);
    flames.push({ glow, cone, r: e.r });
  }
  // accent stripe on fins / nose tip
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), M.accent); tip.position.set(0, 0, d.len / 2 - 0.1); g.add(tip);
  // pylons with missiles
  const missiles = [];
  if (opts.missiles !== false) for (const p of d.pylons) {
    const mm = missileMesh(M); mm.position.set(p[0], p[1] - 0.2, p[2]); g.add(mm); missiles.push(mm);
  }
  // nav lights
  const navs = [];
  const halfSpan = Math.max(...d.pylons.map(p => Math.abs(p[0])), 3.5) + 0.6;
  for (const [x, col] of [[-halfSpan, 0x33ff66], [halfSpan, 0xff3344]]) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.soft, color: col, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
    s.position.set(x, 0, -1.5); s.scale.setScalar(1.6); g.add(s); navs.push(s);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const scale = opts.scale || 1;
  g.scale.setScalar(scale);
  root.add(g);
  root.userData = { flames, missiles, navs, len: d.len * scale, inner: g, mats: M };
  return root;
}

export function setFlame(jet, throttle, boost, t) {
  const fl = jet.userData.flames;
  for (const f of fl) {
    const k = boost ? 1 : throttle * 0.5;
    const flick = 0.85 + Math.sin(t * 60 + f.r * 10) * 0.08 + Math.random() * 0.07;
    f.cone.scale.set(1, 1, (0.4 + k * (boost ? 6 : 2.5)) * flick);
    f.cone.material.opacity = 0.25 + k * 0.6;
    f.cone.material.color.setHSL(boost ? 0.07 : 0.08, 1, boost ? 0.62 : 0.55);
    f.glow.scale.setScalar(f.r * (2 + k * 3.5) * flick);
    f.glow.material.opacity = 0.4 + k * 0.6;
  }
}

export function buildMissileModel(color = 0xeeeeee) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3, 8).rotateX(Math.PI / 2), m);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 8).rotateX(Math.PI / 2), m); tip.position.z = 1.75;
  const finM = new THREE.MeshStandardMaterial({ color: 0x555555 });
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 0.5), finM);
    f.position.z = -1.2; f.rotation.z = i * Math.PI / 2; f.position.x = Math.sin(i * Math.PI / 2) * 0.2; f.position.y = Math.cos(i * Math.PI / 2) * 0.2;
    g.add(f);
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.soft, color: 0xffc070, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
  glow.position.z = -1.8; glow.scale.setScalar(4);
  g.add(body, tip, glow);
  g.scale.setScalar(1.6);
  return g;
}
