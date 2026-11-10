// World: sky, terrain, ocean, clouds, weather, lighting.
import * as THREE from './vendor/three.module.min.js';
import { FOG, TEX, makeBillboardGeometry, makeBillboardMaterial } from './fx.js';

// ------------------------------------------------------------------ noise
function makeNoise(seed) {
  const hash = (i, j) => {
    let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(seed, 982451653);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const fbm = (x, y, oct = 5) => {
    let s = 0, amp = 0.5, f = 1, norm = 0;
    for (let o = 0; o < oct; o++) { s += amp * noise(x * f, y * f); norm += amp; amp *= 0.5; f *= 2.03; }
    return s / norm;
  };
  const ridged = (x, y, oct = 5) => {
    let s = 0, amp = 0.5, f = 1, norm = 0;
    for (let o = 0; o < oct; o++) { let n = 1 - Math.abs(noise(x * f, y * f) * 2 - 1); n *= n; s += amp * n; norm += amp; amp *= 0.5; f *= 2.1; }
    return s / norm;
  };
  return { noise, fbm, ridged };
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------ biome definitions
const BIOMES = {
  islands: { water: true, rim: -400,
    h: (N, x, z) => { const b = N.fbm(x * 0.00022 + 3, z * 0.00022 + 7, 6); let h = (b - 0.53) * 2600; if (h > 0) h += N.ridged(x * 0.0006, z * 0.0006, 4) * h * 0.9; return h; },
    colors: [[-200, '#1a5a6a'], [-5, '#d8c89a'], [25, '#d9cb98'], [60, '#5f8f3e'], [400, '#3f6e2c'], [900, '#6d6a5a'], [1600, '#f2f4f6']], rock: '#6b665c', snow: 1500 },
  mountains: { water: true, rim: 200,
    h: (N, x, z) => { const r = N.ridged(x * 0.00018, z * 0.00018, 6); const b = N.fbm(x * 0.0001 + 11, z * 0.0001, 4); return -150 + Math.pow(r, 1.6) * 3200 * (0.4 + b) + b * 400; },
    colors: [[-200, '#2c4a52'], [0, '#5b6b3c'], [300, '#4c6a32'], [900, '#5a5a48'], [1600, '#7a756a'], [2100, '#eef2f5']], rock: '#6e6a62', snow: 2000 },
  desert: { water: false, rim: 120,
    h: (N, x, z) => { let b = N.fbm(x * 0.00016, z * 0.00016, 5); const st = 6; const t = b * st; b = (Math.floor(t) + smooth(0.4, 0.6, t - Math.floor(t))) / st;
      const canyon = Math.pow(N.ridged(x * 0.00012 + 5, z * 0.00012 + 9, 3), 3);
      return 100 + b * 1700 - 700 - canyon * 600 + N.noise(x * 0.004, z * 0.004) * 15; },
    colors: [[-500, '#7a3c22'], [0, '#a8552e'], [200, '#c87a44'], [500, '#d9a066'], [900, '#c98d58'], [1400, '#e2bd86']], rock: '#9a5233', snow: 99999 },
  arctic: { water: true, rim: -300,
    h: (N, x, z) => { const r = N.ridged(x * 0.0002 + 2, z * 0.0002, 6); const b = N.fbm(x * 0.00012, z * 0.00012 + 4, 4); return -400 + Math.pow(r, 1.5) * 2800 * (0.3 + b) + b * 600; },
    colors: [[-200, '#294652'], [-5, '#cfd8de'], [80, '#e6edf1'], [600, '#d8e1e8'], [1500, '#ffffff']], rock: '#5a6470', snow: 150 },
  ocean: { water: true, rim: -600,
    h: (N, x, z) => { const b = N.fbm(x * 0.0002, z * 0.0002 + 3, 5); let h = (b - 0.62) * 2600; if (h > 0) h += N.ridged(x * 0.0007, z * 0.0007, 3) * h; return h; },
    colors: [[-200, '#1a3a44'], [-5, '#a89a76'], [40, '#405f34'], [300, '#3a4f2f'], [800, '#5a574d']], rock: '#4c4a44', snow: 99999 },
};

// ------------------------------------------------------------------ atmosphere presets
const ATMOS = {
  clear:     { zenith: '#2a68c4', horizon: '#b9d6ee', ground: '#5e7a90', sun: [0.45, 0.7, -0.55], sunColor: '#fff3dc', sunI: 3.2, hemiSky: '#bcd8ff', hemiGround: '#5a6650', hemiI: 1.3, fog: 0.000033, clouds: 30, cloudBase: 1200, cloudTop: 2600, cloudColor: [1, 1, 1], cloudDark: [0.72, 0.76, 0.84], ocean: ['#0a3a5a', '#1d7f8f'], exposure: 0.9 },
  cloudy:    { zenith: '#4a7ab5', horizon: '#c8d6e2', ground: '#6a7a88', sun: [0.55, 0.55, -0.6], sunColor: '#ffe8c8', sunI: 2.8, hemiSky: '#c8d8ec', hemiGround: '#55604c', hemiI: 1.3, fog: 0.00005, clouds: 75, cloudBase: 1400, cloudTop: 3600, cloudColor: [1, 0.98, 0.95], cloudDark: [0.6, 0.64, 0.72], ocean: ['#0c3550', '#24707f'], exposure: 0.9 },
  sandstorm: { zenith: '#9c7b55', horizon: '#d8a96c', ground: '#a07040', sun: [0.4, 0.75, -0.5], sunColor: '#ffdcae', sunI: 2.4, hemiSky: '#e8c090', hemiGround: '#8a5a30', hemiI: 1.4, fog: 0.00015, clouds: 18, cloudBase: 2200, cloudTop: 3400, cloudColor: [0.95, 0.85, 0.7], cloudDark: [0.7, 0.55, 0.4], ocean: ['#3a3020', '#6a5030'], exposure: 0.95, dust: true, wind: 14 },
  snow:      { zenith: '#5f6f82', horizon: '#aeb9c6', ground: '#7a8794', sun: [-0.6, 0.25, -0.7], sunColor: '#ffc89a', sunI: 1.6, hemiSky: '#b8c6d8', hemiGround: '#8090a0', hemiI: 1.6, fog: 0.0001, clouds: 90, cloudBase: 1700, cloudTop: 2900, cloudColor: [0.92, 0.94, 0.98], cloudDark: [0.55, 0.6, 0.68], ocean: ['#13283a', '#2a4a5a'], exposure: 1.0, snowfall: true, wind: 6 },
  storm:     { zenith: '#20262e', horizon: '#56606b', ground: '#2a3036', sun: [0.3, 0.5, -0.8], sunColor: '#c8d0dc', sunI: 0.9, hemiSky: '#7a8696', hemiGround: '#2c3036', hemiI: 1.2, fog: 0.00012, clouds: 110, cloudBase: 1500, cloudTop: 4200, cloudColor: [0.55, 0.58, 0.63], cloudDark: [0.2, 0.22, 0.26], ocean: ['#0a1a24', '#2a3e48'], exposure: 1.1, rain: true, lightning: true, turbulence: 1, wind: 18 },
  night:     { zenith: '#01030a', horizon: '#0e1a2e', ground: '#050a12', sun: [-0.4, 0.55, 0.6], sunColor: '#9fb6e8', sunI: 0.9, hemiSky: '#3a5590', hemiGround: '#141a26', hemiI: 0.85, fog: 0.00006, clouds: 35, cloudBase: 1800, cloudTop: 3000, cloudColor: [0.2, 0.24, 0.34], cloudDark: [0.06, 0.08, 0.12], ocean: ['#02080f', '#0a1a28'], exposure: 1.3, stars: true, moon: true },
  dawn:      { zenith: '#3a4f86', horizon: '#ffb27a', ground: '#6a5a60', sun: [0.0, 0.12, -1], sunColor: '#ffb070', sunI: 2.2, hemiSky: '#ffc8a0', hemiGround: '#4a4058', hemiI: 1.1, fog: 0.00005, clouds: 40, cloudBase: 1300, cloudTop: 2800, cloudColor: [1, 0.82, 0.68], cloudDark: [0.5, 0.42, 0.5], ocean: ['#1a2a44', '#4a5a70'], exposure: 1.0 },
  afternoon: null,
  dusk: null,
};

export function atmosFor(theater, timeOverride) {
  if (timeOverride === 'dawn') return { ...ATMOS.dawn };
  return { ...(ATMOS[theater.weather] || ATMOS.clear) };
}

// ------------------------------------------------------------------ sky shader
const SKY_VERT = `varying vec3 vDir; void main(){ vDir = normalize((modelMatrix * vec4(position,1.0)).xyz - cameraPosition); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`;
const SKY_FRAG = `
uniform vec3 zenith; uniform vec3 horizon; uniform vec3 ground; uniform vec3 sunDir; uniform vec3 sunColor; uniform float stars; uniform float moon; uniform float flash;
varying vec3 vDir;
float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
void main(){
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 c = y > 0.0 ? mix(horizon, zenith, pow(clamp(y,0.0,1.0), 0.55)) : mix(horizon, ground, pow(clamp(-y*4.0,0.0,1.0),0.6));
  float sd = max(dot(d, normalize(sunDir)), 0.0);
  if (moon > 0.5) {
    c += sunColor * smoothstep(0.9995, 0.9997, sd) * 1.2;
    c += sunColor * pow(sd, 400.0) * 0.25;
  } else {
    c += sunColor * smoothstep(0.9993, 0.9996, sd) * 6.0;
    c += sunColor * pow(sd, 24.0) * 0.35 + sunColor * pow(sd, 3.0) * 0.08;
  }
  if (stars > 0.0 && y > 0.0) {
    vec3 q = floor(d * 380.0);
    float s = h(q);
    c += vec3(step(0.9975, s) * (0.5 + 0.5 * h(q + 1.0))) * stars * smoothstep(0.0, 0.3, y);
  }
  c += vec3(flash) * 0.6;
  gl_FragColor = vec4(c, 1.0);
}`;

// ------------------------------------------------------------------ ocean shader
const OCEAN_VERT = `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const OCEAN_FRAG = `
uniform float time; uniform vec3 sunDir; uniform vec3 sunColor; uniform vec3 deep; uniform vec3 shallow; uniform vec3 skyH; uniform vec3 skyZ;
uniform vec3 fogColor; uniform float fogDensity; uniform float rough;
varying vec3 vW;
vec2 wave(vec2 p, vec2 dir, float freq, float speed, float amp){ float ph = dot(p, dir) * freq + time * speed; return dir * cos(ph) * amp * freq; }
void main(){
  vec2 p = vW.xz;
  vec2 g = vec2(0.0);
  g += wave(p, normalize(vec2(1.0, 0.3)), 0.012, 1.1, 1.2 * rough);
  g += wave(p, normalize(vec2(-0.4, 1.0)), 0.021, 1.5, 0.7 * rough);
  g += wave(p, normalize(vec2(0.7, -0.8)), 0.047, 2.1, 0.35 * rough);
  g += wave(p, normalize(vec2(-0.9, -0.2)), 0.11, 3.0, 0.14 * rough);
  g += wave(p, normalize(vec2(0.2, 0.95)), 0.27, 4.5, 0.05 * rough);
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 v = normalize(cameraPosition - vW);
  float dist = length(cameraPosition - vW);
  n = normalize(mix(n, vec3(0.0,1.0,0.0), clamp(dist / 14000.0, 0.0, 0.85)));
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
  vec3 r = reflect(-v, n);
  vec3 sky = mix(skyH, skyZ, pow(clamp(r.y, 0.0, 1.0), 0.5));
  vec3 water = mix(deep, shallow, 0.25 + 0.25 * n.y);
  vec3 c = mix(water, sky, fres);
  float spec = pow(max(dot(r, normalize(sunDir)), 0.0), 260.0);
  c += sunColor * spec * 3.0;
  float f = 1.0 - exp(-fogDensity * fogDensity * dist * dist);
  gl_FragColor = vec4(mix(c, fogColor, f), 1.0);
}`;

// ------------------------------------------------------------------ cloud billboard (sorted instanced)
class CloudField {
  constructor(scene, atm, rng, radius) {
    const puffs = [];
    for (let c = 0; c < atm.clouds; c++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * radius;
      const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
      const cy = atm.cloudBase + rng() * (atm.cloudTop - atm.cloudBase - 500);
      const w = 500 + rng() * 1400, hgt = 250 + rng() * 700;
      const n = 8 + Math.floor(rng() * 14);
      for (let i = 0; i < n; i++) {
        const px = cx + (rng() - 0.5) * w * 2, pz = cz + (rng() - 0.5) * w * 2;
        const py = cy + Math.pow(rng(), 1.5) * hgt;
        const s = 350 + rng() * 650;
        const t = Math.min(1, (py - cy) / hgt + 0.15);
        const col = atm.cloudDark.map((d, k) => d + (atm.cloudColor[k] - d) * t);
        puffs.push({ x: px, y: py, z: pz, s, c: col, d: 0 });
      }
    }
    this.puffs = puffs;
    this.geo = makeBillboardGeometry(Math.max(1, puffs.length));
    this.mat = makeBillboardMaterial(TEX.cloud, false, 0.9);
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 1;
    scene.add(this.mesh);
    this.frame = 0; this.order = puffs.map((_, i) => i);
    this.write(new THREE.Vector3());
  }
  write(cam) {
    const P = this.puffs;
    for (const p of P) p.d = (p.x - cam.x) ** 2 + (p.y - cam.y) ** 2 + (p.z - cam.z) ** 2;
    this.order.sort((a, b) => P[b].d - P[a].d);
    const A = this.geo.attributes;
    this.order.forEach((idx, i) => {
      const p = P[idx];
      A.iPos.array[i * 3] = p.x; A.iPos.array[i * 3 + 1] = p.y; A.iPos.array[i * 3 + 2] = p.z;
      A.iSize.array[i] = p.s; A.iRot.array[i] = idx * 1.7;
      A.iColor.array[i * 4] = p.c[0]; A.iColor.array[i * 4 + 1] = p.c[1]; A.iColor.array[i * 4 + 2] = p.c[2]; A.iColor.array[i * 4 + 3] = 0.9;
    });
    this.geo.instanceCount = P.length;
    A.iPos.needsUpdate = A.iSize.needsUpdate = A.iColor.needsUpdate = A.iRot.needsUpdate = true;
  }
  update(cam) { if (++this.frame % 12 === 0) this.write(cam); }
  // how deep inside a cloud the point is (0..1)
  density(p) {
    let d = 0;
    for (const q of this.puffs) {
      const r = q.s * 0.35; const dx = q.x - p.x, dy = q.y - p.y, dz = q.z - p.z;
      const dd = dx * dx + dy * dy + dz * dz;
      if (dd < r * r) d = Math.max(d, 1 - Math.sqrt(dd) / r);
    }
    return d;
  }
  dispose(scene) { scene.remove(this.mesh); this.geo.dispose(); this.mat.dispose(); }
}

// ------------------------------------------------------------------ World
export class World {
  constructor(scene, opts) {
    this.scene = scene;
    this.group = new THREE.Group(); scene.add(this.group);
    this.seed = opts.seed || 1;
    let s = this.seed * 9301 + 49297;
    this.rng = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    this.biome = BIOMES[opts.biome] || BIOMES.islands;
    this.atm = opts.atmos;
    this.arena = 9000;
    this.N = makeNoise(this.seed);
    this.time = 0;
    this.wind = new THREE.Vector3((this.rng() - 0.5), 0, (this.rng() - 0.5)).normalize().multiplyScalar(this.atm.wind || 0);
    this.turbulence = this.atm.turbulence || (this.atm.wind ? 0.25 : 0.05);
    this.flash = 0;
    this.lightningT = 3 + this.rng() * 5;
    this.waterLevel = this.biome.water ? 0 : -99999;

    this._lights();
    this._sky();
    this._terrain(opts.quality === 'low' ? 140 : 220);
    if (this.biome.water) this._ocean();
    else this._groundPlane();
    this.clouds = new CloudField(this.group, this.atm, this.rng, 16000);
    this._weather();
    FOG.color.value.set(this.atm.horizon);
    FOG.density.value = this.atm.fog;
    scene.fog = new THREE.FogExp2(this.atm.horizon, this.atm.fog);
  }

  _lights() {
    const a = this.atm;
    this.sunDir = new THREE.Vector3(...a.sun).normalize();
    this.sun = new THREE.DirectionalLight(a.sunColor, a.sunI);
    this.sun.position.copy(this.sunDir).multiplyScalar(10000);
    this.group.add(this.sun);
    this.hemi = new THREE.HemisphereLight(a.hemiSky, a.hemiGround, a.hemiI);
    this.group.add(this.hemi);
    this.baseHemi = a.hemiI;
  }

  _sky() {
    const a = this.atm;
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { zenith: { value: new THREE.Color(a.zenith) }, horizon: { value: new THREE.Color(a.horizon) }, ground: { value: new THREE.Color(a.ground) },
        sunDir: { value: this.sunDir }, sunColor: { value: new THREE.Color(a.sunColor) }, stars: { value: a.stars ? 1 : 0 }, moon: { value: a.moon ? 1 : 0 }, flash: { value: 0 } },
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(50000, 32, 16), this.skyMat);
    this.sky.renderOrder = -10; this.sky.frustumCulled = false;
    this.group.add(this.sky);
  }

  _terrain(seg) {
    const size = 40000, half = size / 2, cell = size / seg;
    this.tSize = size; this.tSeg = seg; this.tHalf = half; this.tCell = cell;
    const H = new Float32Array((seg + 1) * (seg + 1));
    const B = this.biome, N = this.N;
    for (let j = 0; j <= seg; j++) for (let i = 0; i <= seg; i++) {
      const x = -half + i * cell, z = -half + j * cell;
      let h = B.h(N, x, z);
      const r = Math.sqrt(x * x + z * z) / half;
      h = h + (B.rim - h) * smooth(0.7, 0.98, r);
      // keep spawn zone sane: flatten mountains near arena center slightly
      H[j * (seg + 1) + i] = h;
    }
    this.H = H;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k), z = pos.getZ(k);
      const i = Math.round((x + half) / cell), j = Math.round((z + half) / cell);
      pos.setY(k, H[j * (seg + 1) + i]);
    }
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal;
    const cols = new Float32Array(pos.count * 3);
    const stops = B.colors.map(([h, c]) => [h, new THREE.Color(c)]);
    const rock = new THREE.Color(B.rock), snow = new THREE.Color('#f4f7fa'), tmp = new THREE.Color();
    for (let k = 0; k < pos.count; k++) {
      const y = pos.getY(k), ny = nrm.getY(k);
      let c0 = stops[0][1], c1 = stops[0][1], t = 0;
      for (let s = 0; s < stops.length - 1; s++) {
        if (y >= stops[s][0] && y < stops[s + 1][0]) { c0 = stops[s][1]; c1 = stops[s + 1][1]; t = (y - stops[s][0]) / (stops[s + 1][0] - stops[s][0]); break; }
        if (y >= stops[stops.length - 1][0]) { c0 = c1 = stops[stops.length - 1][1]; }
      }
      tmp.copy(c0).lerp(c1, t);
      const steep = smooth(0.92, 0.7, ny);
      tmp.lerp(rock, steep * 0.85);
      if (y > B.snow && ny > 0.75) tmp.lerp(snow, smooth(B.snow, B.snow + 300, y));
      const j = 0.92 + N.noise(pos.getX(k) * 0.01, pos.getZ(k) * 0.01) * 0.16;
      cols[k * 3] = tmp.r * j; cols[k * 3 + 1] = tmp.g * j; cols[k * 3 + 2] = tmp.b * j;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    this.terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.group.add(this.terrain);
  }

  _ocean() {
    const a = this.atm;
    this.oceanMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, sunDir: { value: this.sunDir }, sunColor: { value: new THREE.Color(a.sunColor).multiplyScalar(a.moon ? 0.4 : 1) },
        deep: { value: new THREE.Color(a.ocean[0]) }, shallow: { value: new THREE.Color(a.ocean[1]) },
        skyH: { value: new THREE.Color(a.horizon) }, skyZ: { value: new THREE.Color(a.zenith) },
        fogColor: FOG.color, fogDensity: FOG.density, rough: { value: a.rain ? 2.2 : 1 } },
      vertexShader: OCEAN_VERT, fragmentShader: OCEAN_FRAG,
    });
    this.ocean = new THREE.Mesh(new THREE.PlaneGeometry(120000, 120000, 1, 1).rotateX(-Math.PI / 2), this.oceanMat);
    this.ocean.position.y = 0;
    this.group.add(this.ocean);
  }

  _groundPlane() {
    const c = new THREE.Color(this.biome.colors[2][1]);
    const g = new THREE.Mesh(new THREE.PlaneGeometry(120000, 120000).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: c }));
    g.position.y = this.biome.rim - 2;
    this.ground = g; this.group.add(g);
  }

  _weather() {
    const a = this.atm;
    this.box = 600;
    if (a.rain) {
      const n = 2500; const pos = new Float32Array(n * 6);
      this.rainP = new Float32Array(n * 3);
      for (let i = 0; i < n * 3; i++) this.rainP[i] = (Math.random() - 0.5) * this.box;
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
      this.rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xaab8c8, transparent: true, opacity: 0.35, fog: false, depthWrite: false }));
      this.rain.frustumCulled = false; this.group.add(this.rain);
    }
    if (a.snowfall || a.dust) {
      const n = a.dust ? 2500 : 3000; const pos = new Float32Array(n * 3);
      this.flakeP = new Float32Array(n * 3);
      for (let i = 0; i < n * 3; i++) this.flakeP[i] = (Math.random() - 0.5) * this.box;
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
      this.flakes = new THREE.Points(geo, new THREE.PointsMaterial({ color: a.dust ? 0xd8a868 : 0xffffff, size: a.dust ? 3 : 1.6, map: TEX.soft, transparent: true, opacity: a.dust ? 0.5 : 0.9, depthWrite: false, fog: false }));
      this.flakes.frustumCulled = false; this.group.add(this.flakes);
    }
    if (a.lightning) {
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(40 * 3), 3));
      this.bolt = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xe8f0ff, transparent: true, opacity: 0, fog: false, blending: THREE.AdditiveBlending }));
      this.bolt.frustumCulled = false; this.group.add(this.bolt);
    }
  }

  // terrain height (bilinear on grid)
  terrainAt(x, z) {
    const { tHalf: half, tCell: cell, tSeg: seg, H } = this;
    const fx = (x + half) / cell, fz = (z + half) / cell;
    if (fx < 0 || fz < 0 || fx >= seg || fz >= seg) return this.biome.rim;
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    const w = seg + 1;
    const a = H[j * w + i], b = H[j * w + i + 1], c = H[(j + 1) * w + i], d = H[(j + 1) * w + i + 1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  groundAt(x, z) { return Math.max(this.terrainAt(x, z), this.waterLevel); }
  isWater(x, z) { return this.biome.water && this.terrainAt(x, z) < this.waterLevel; }

  // find a spawn altitude well above terrain
  safeAlt(x, z, min = 1500) {
    let m = -1e9;
    for (let dx = -1500; dx <= 1500; dx += 500) for (let dz = -1500; dz <= 1500; dz += 500) m = Math.max(m, this.groundAt(x + dx, z + dz));
    return Math.max(min, m + 700);
  }

  update(dt, cam, camVel, onThunder) {
    this.time += dt;
    this.sky.position.copy(cam);
    if (this.ocean) { this.ocean.position.x = Math.round(cam.x / 1000) * 1000; this.ocean.position.z = Math.round(cam.z / 1000) * 1000; this.oceanMat.uniforms.time.value = this.time; }
    if (this.ground) { this.ground.position.x = cam.x; this.ground.position.z = cam.z; }
    this.clouds.update(cam);
    const box = this.box, hb = box / 2;
    const wrap = (v) => ((v + hb) % box + box) % box - hb;
    if (this.rain) {
      const P = this.rainP, pos = this.rain.geometry.attributes.position.array;
      const fall = 90 * dt;
      const sx = (this.wind.x - camVel.x) * 0.045, sy = (-90 - camVel.y) * 0.045, sz = (this.wind.z - camVel.z) * 0.045;
      for (let i = 0; i < P.length / 3; i++) {
        P[i * 3] = wrap(P[i * 3] + (this.wind.x - camVel.x) * dt);
        P[i * 3 + 1] = wrap(P[i * 3 + 1] - fall - camVel.y * dt);
        P[i * 3 + 2] = wrap(P[i * 3 + 2] + (this.wind.z - camVel.z) * dt);
        const x = cam.x + P[i * 3], y = cam.y + P[i * 3 + 1], z = cam.z + P[i * 3 + 2];
        pos[i * 6] = x; pos[i * 6 + 1] = y; pos[i * 6 + 2] = z;
        pos[i * 6 + 3] = x - sx; pos[i * 6 + 4] = y - sy; pos[i * 6 + 5] = z - sz;
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }
    if (this.flakes) {
      const P = this.flakeP, pos = this.flakes.geometry.attributes.position.array;
      const fall = (this.atm.dust ? 2 : 6) * dt;
      for (let i = 0; i < P.length / 3; i++) {
        P[i * 3] = wrap(P[i * 3] + (this.wind.x - camVel.x) * dt + Math.sin(this.time + i) * 0.05);
        P[i * 3 + 1] = wrap(P[i * 3 + 1] - fall - camVel.y * dt);
        P[i * 3 + 2] = wrap(P[i * 3 + 2] + (this.wind.z - camVel.z) * dt);
        pos[i * 3] = cam.x + P[i * 3]; pos[i * 3 + 1] = cam.y + P[i * 3 + 1]; pos[i * 3 + 2] = cam.z + P[i * 3 + 2];
      }
      this.flakes.geometry.attributes.position.needsUpdate = true;
    }
    if (this.atm.lightning) {
      this.lightningT -= dt;
      if (this.lightningT <= 0) {
        this.lightningT = 4 + Math.random() * 9;
        this.flash = 1;
        this._makeBolt(cam);
        onThunder && onThunder();
      }
      this.flash = Math.max(0, this.flash - dt * 3.5);
      const f = this.flash * (0.6 + 0.4 * Math.sin(this.time * 70));
      this.hemi.intensity = this.baseHemi + f * 4;
      this.skyMat.uniforms.flash.value = f * 0.5;
      if (this.bolt) this.bolt.material.opacity = this.flash > 0.5 ? 1 : 0;
    }
  }

  _makeBolt(cam) {
    if (!this.bolt) return;
    const a = Math.random() * 6.28, d = 2500 + Math.random() * 5000;
    let x = cam.x + Math.cos(a) * d, z = cam.z + Math.sin(a) * d, y = 3800;
    const g = this.groundAt(x, z);
    const arr = this.bolt.geometry.attributes.position.array;
    for (let i = 0; i < 40; i++) {
      arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z;
      x += (Math.random() - 0.5) * 220; z += (Math.random() - 0.5) * 220; y -= (3800 - g) / 39;
    }
    this.bolt.geometry.attributes.position.needsUpdate = true;
  }

  dispose() {
    this.clouds.dispose(this.group);
    this.scene.remove(this.group);
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    this.scene.fog = null;
  }
}

// small showroom environment used behind menus
export function makeShowroom(scene) {
  const g = new THREE.Group();
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { zenith: { value: new THREE.Color('#0b1626') }, horizon: { value: new THREE.Color('#3a5a78') }, ground: { value: new THREE.Color('#0a0f16') },
      sunDir: { value: new THREE.Vector3(-1, 0.06, -0.35).normalize() }, sunColor: { value: new THREE.Color('#ffc890') }, stars: { value: 0.4 }, moon: { value: 0 }, flash: { value: 0 } },
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), skyMat); g.add(sky);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a2028, roughness: 0.35, metalness: 0.6 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64).rotateX(-Math.PI / 2), floorMat); floor.position.y = -3.2; g.add(floor);
  // glowing ring
  const ring = new THREE.Mesh(new THREE.RingGeometry(13.5, 14, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x38c8ff, transparent: true, opacity: 0.55 }));
  ring.position.y = -3.15; g.add(ring);
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(18, 18.15, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x38c8ff, transparent: true, opacity: 0.25 }));
  ring2.position.y = -3.15; g.add(ring2);
  const key = new THREE.DirectionalLight(0xfff0e0, 3); key.position.set(10, 14, 8); g.add(key);
  const rim = new THREE.DirectionalLight(0x6ab8ff, 2.5); rim.position.set(-12, 6, -14); g.add(rim);
  g.add(new THREE.HemisphereLight(0x9fc4ff, 0x202830, 1.1));
  scene.add(g);
  return { group: g, ring, ring2 };
}
