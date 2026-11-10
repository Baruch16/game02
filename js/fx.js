// Visual effects: instanced billboard particle systems, tracers, procedural textures.
import * as THREE from './vendor/three.module.min.js';

// Shared fog uniforms (updated by world when weather changes)
export const FOG = { color: { value: new THREE.Color(0xbfd4e6) }, density: { value: 0.00008 } };

// ------------------------------------------------------------------ textures
function canvasTex(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); draw(g, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export const TEX = {};
export function initTextures() {
  TEX.soft = canvasTex(64, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.8)');
    r.addColorStop(0.6, 'rgba(255,255,255,0.2)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, s, s);
  });
  TEX.smoke = canvasTex(128, (g, s) => {
    for (let i = 0; i < 26; i++) {
      const x = s / 2 + (Math.random() - 0.5) * s * 0.45, y = s / 2 + (Math.random() - 0.5) * s * 0.45;
      const rr = s * (0.14 + Math.random() * 0.2);
      const r = g.createRadialGradient(x, y, 0, x, y, rr);
      const a = 0.18 + Math.random() * 0.15;
      r.addColorStop(0, `rgba(255,255,255,${a})`); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, s, s);
    }
  });
  TEX.cloud = canvasTex(256, (g, s) => {
    for (let i = 0; i < 60; i++) {
      const ang = Math.random() * Math.PI * 2, d = Math.random() * s * 0.28;
      const x = s / 2 + Math.cos(ang) * d, y = s / 2 + Math.sin(ang) * d * 0.8;
      const rr = s * (0.08 + Math.random() * 0.16);
      const r = g.createRadialGradient(x, y, 0, x, y, rr);
      const a = 0.14 + Math.random() * 0.12;
      r.addColorStop(0, `rgba(255,255,255,${a})`); r.addColorStop(0.6, `rgba(255,255,255,${a * 0.5})`); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, s, s);
    }
  });
  TEX.flash = canvasTex(128, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.1, 'rgba(255,255,255,0.9)');
    r.addColorStop(0.35, 'rgba(255,255,255,0.25)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, s, s);
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2;
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(s / 2 - Math.cos(a) * s / 2, s / 2 - Math.sin(a) * s / 2); g.lineTo(s / 2 + Math.cos(a) * s / 2, s / 2 + Math.sin(a) * s / 2); g.stroke(); }
  });
}

// ------------------------------------------------------------------ billboard shader
const VERT = `
attribute vec3 iPos; attribute float iSize; attribute vec4 iColor; attribute float iRot;
varying vec2 vUv; varying vec4 vColor; varying float vFog; varying float vNear;
uniform float fogDensity; uniform float nearFade;
void main(){
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  float c = cos(iRot), s = sin(iRot);
  vec2 p = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * iSize;
  mv.xy += p;
  gl_Position = projectionMatrix * mv;
  vUv = uv; vColor = iColor;
  float d = -mv.z;
  vFog = 1.0 - exp(-fogDensity * fogDensity * d * d);
  vNear = nearFade > 0.0 ? clamp((d - iSize * 0.25) / (iSize * nearFade), 0.0, 1.0) : 1.0;
}`;
const FRAG_NORMAL = `
uniform sampler2D map; uniform vec3 fogColor;
varying vec2 vUv; varying vec4 vColor; varying float vFog; varying float vNear;
void main(){
  vec4 t = texture2D(map, vUv);
  vec4 c = t * vColor;
  c.rgb = mix(c.rgb, fogColor, vFog);
  c.a *= vNear * (1.0 - vFog * 0.6);
  if (c.a < 0.003) discard;
  gl_FragColor = c;
}`;
const FRAG_ADD = `
uniform sampler2D map; uniform vec3 fogColor;
varying vec2 vUv; varying vec4 vColor; varying float vFog; varying float vNear;
void main(){
  vec4 t = texture2D(map, vUv);
  vec3 c = t.rgb * vColor.rgb * t.a * vColor.a * (1.0 - vFog * 0.85) * vNear;
  gl_FragColor = vec4(c, 1.0);
}`;

export function makeBillboardMaterial(tex, additive, nearFade = 0) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, fogColor: FOG.color, fogDensity: FOG.density, nearFade: { value: nearFade } },
    vertexShader: VERT, fragmentShader: additive ? FRAG_ADD : FRAG_NORMAL,
    transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

export function makeBillboardGeometry(max) {
  const geo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  geo.setAttribute('uv', quad.attributes.uv);
  const mk = (n) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(max * n), n); a.setUsage(THREE.DynamicDrawUsage); return a; };
  geo.setAttribute('iPos', mk(3)); geo.setAttribute('iSize', mk(1)); geo.setAttribute('iColor', mk(4)); geo.setAttribute('iRot', mk(1));
  geo.instanceCount = 0;
  return geo;
}

// ------------------------------------------------------------------ particle system
export class Particles {
  constructor(scene, max, tex, additive, order = 0) {
    this.max = max; this.n = 0;
    this.geo = makeBillboardGeometry(max);
    this.mesh = new THREE.Mesh(this.geo, makeBillboardMaterial(tex, additive));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = order;
    scene.add(this.mesh);
    const F = () => new Float32Array(max);
    this.p = { x: F(), y: F(), z: F(), vx: F(), vy: F(), vz: F(), life: F(), max: F(), s0: F(), s1: F(),
      r0: F(), g0: F(), b0: F(), a0: F(), r1: F(), g1: F(), b1: F(), a1: F(), drag: F(), grav: F(), rot: F(), rv: F() };
  }
  spawn(x, y, z, vx, vy, vz, life, s0, s1, c0, c1, drag = 0, grav = 0) {
    if (this.n >= this.max) return;
    const i = this.n++, p = this.p;
    p.x[i] = x; p.y[i] = y; p.z[i] = z; p.vx[i] = vx; p.vy[i] = vy; p.vz[i] = vz;
    p.life[i] = life; p.max[i] = life; p.s0[i] = s0; p.s1[i] = s1;
    p.r0[i] = c0[0]; p.g0[i] = c0[1]; p.b0[i] = c0[2]; p.a0[i] = c0[3];
    p.r1[i] = c1[0]; p.g1[i] = c1[1]; p.b1[i] = c1[2]; p.a1[i] = c1[3];
    p.drag[i] = drag; p.grav[i] = grav; p.rot[i] = Math.random() * 6.28; p.rv[i] = (Math.random() - 0.5) * 1.2;
  }
  _kill(i) {
    const j = --this.n, p = this.p;
    if (i !== j) for (const k in p) p[k][i] = p[k][j];
  }
  update(dt) {
    const p = this.p;
    for (let i = 0; i < this.n; i++) {
      p.life[i] -= dt;
      if (p.life[i] <= 0) { this._kill(i); i--; continue; }
      const dr = Math.max(0, 1 - p.drag[i] * dt);
      p.vx[i] *= dr; p.vy[i] = p.vy[i] * dr + p.grav[i] * dt; p.vz[i] *= dr;
      p.x[i] += p.vx[i] * dt; p.y[i] += p.vy[i] * dt; p.z[i] += p.vz[i] * dt;
      p.rot[i] += p.rv[i] * dt;
    }
    const A = this.geo.attributes;
    const pos = A.iPos.array, size = A.iSize.array, col = A.iColor.array, rot = A.iRot.array;
    for (let i = 0; i < this.n; i++) {
      const t = 1 - p.life[i] / p.max[i];
      pos[i * 3] = p.x[i]; pos[i * 3 + 1] = p.y[i]; pos[i * 3 + 2] = p.z[i];
      size[i] = p.s0[i] + (p.s1[i] - p.s0[i]) * t;
      col[i * 4] = p.r0[i] + (p.r1[i] - p.r0[i]) * t;
      col[i * 4 + 1] = p.g0[i] + (p.g1[i] - p.g0[i]) * t;
      col[i * 4 + 2] = p.b0[i] + (p.b1[i] - p.b0[i]) * t;
      col[i * 4 + 3] = p.a0[i] + (p.a1[i] - p.a0[i]) * t;
      rot[i] = p.rot[i];
    }
    this.geo.instanceCount = this.n;
    A.iPos.needsUpdate = A.iSize.needsUpdate = A.iColor.needsUpdate = A.iRot.needsUpdate = true;
  }
  clear() { this.n = 0; this.geo.instanceCount = 0; }
  dispose(scene) { scene.remove(this.mesh); this.geo.dispose(); this.mesh.material.dispose(); }
}

// ------------------------------------------------------------------ FX manager
export class FX {
  constructor(scene) {
    this.scene = scene;
    this.smoke = new Particles(scene, 6000, TEX.smoke, false, 2);
    this.fire = new Particles(scene, 4000, TEX.soft, true, 3);
    this.flash = new Particles(scene, 300, TEX.flash, true, 4);
    // tracers
    const maxT = 600;
    this.tGeo = new THREE.BufferGeometry();
    this.tPos = new Float32Array(maxT * 6); this.tCol = new Float32Array(maxT * 6);
    this.tGeo.setAttribute('position', new THREE.BufferAttribute(this.tPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.tGeo.setAttribute('color', new THREE.BufferAttribute(this.tCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.tracers = new THREE.LineSegments(this.tGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.tracers.frustumCulled = false; this.tracers.renderOrder = 5;
    scene.add(this.tracers);
    this.maxT = maxT;
    // flash lights pool
    this.lights = [];
    for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xffaa55, 0, 900, 1.6); scene.add(l); this.lights.push({ l, t: 0, max: 1, i0: 0 }); }
  }

  setTracers(bullets) {
    const n = Math.min(bullets.length, this.maxT);
    for (let i = 0; i < n; i++) {
      const b = bullets[i];
      const L = b.laser ? 0.06 : 0.03;
      this.tPos[i * 6] = b.x; this.tPos[i * 6 + 1] = b.y; this.tPos[i * 6 + 2] = b.z;
      this.tPos[i * 6 + 3] = b.x - b.vx * L; this.tPos[i * 6 + 4] = b.y - b.vy * L; this.tPos[i * 6 + 5] = b.z - b.vz * L;
      const c = b.color;
      this.tCol[i * 6] = c[0]; this.tCol[i * 6 + 1] = c[1]; this.tCol[i * 6 + 2] = c[2];
      this.tCol[i * 6 + 3] = c[0] * 0.3; this.tCol[i * 6 + 4] = c[1] * 0.3; this.tCol[i * 6 + 5] = c[2] * 0.3;
    }
    this.tGeo.setDrawRange(0, n * 2);
    this.tGeo.attributes.position.needsUpdate = true; this.tGeo.attributes.color.needsUpdate = true;
  }

  light(pos, intensity, dur, color = 0xffaa55) {
    let best = this.lights[0];
    for (const L of this.lights) if (L.t <= 0) { best = L; break; }
    best.l.position.copy(pos); best.l.color.set(color); best.t = dur; best.max = dur; best.i0 = intensity;
  }

  explosion(pos, scale = 1, vel = null) {
    const vx = vel ? vel.x * 0.3 : 0, vy = vel ? vel.y * 0.3 : 0, vz = vel ? vel.z * 0.3 : 0;
    this.flash.spawn(pos.x, pos.y, pos.z, vx, vy, vz, 0.3, 30 * scale, 70 * scale, [1, 0.85, 0.6, 0.9], [1, 0.5, 0.2, 0]);
    for (let i = 0; i < 40 * scale; i++) {
      const d = rndDir(); const sp = (20 + Math.random() * 70) * scale;
      this.fire.spawn(pos.x, pos.y, pos.z, vx + d.x * sp, vy + d.y * sp, vz + d.z * sp, 0.6 + Math.random() * 0.8,
        12 * scale, (28 + Math.random() * 20) * scale, [1, 0.75, 0.35, 1], [0.7, 0.15, 0.02, 0], 2.2, 3);
    }
    for (let i = 0; i < 26 * scale; i++) {
      const d = rndDir(); const sp = (10 + Math.random() * 40) * scale;
      this.smoke.spawn(pos.x, pos.y, pos.z, vx + d.x * sp, vy + d.y * sp, vz + d.z * sp, 2.5 + Math.random() * 3,
        18 * scale, (60 + Math.random() * 40) * scale, [0.25, 0.22, 0.2, 0.75], [0.35, 0.34, 0.33, 0], 1.2, 2);
    }
    // sparks
    for (let i = 0; i < 30 * scale; i++) {
      const d = rndDir(); const sp = (80 + Math.random() * 160) * scale;
      this.fire.spawn(pos.x, pos.y, pos.z, vx + d.x * sp, vy + d.y * sp, vz + d.z * sp, 0.5 + Math.random() * 0.8,
        2.5, 1, [1, 0.85, 0.5, 1], [1, 0.4, 0.1, 0], 0.8, -30);
    }
    this.light(pos, 40 * scale, 0.6);
  }

  smallHit(pos) {
    for (let i = 0; i < 6; i++) {
      const d = rndDir(); const sp = 30 + Math.random() * 60;
      this.fire.spawn(pos.x, pos.y, pos.z, d.x * sp, d.y * sp, d.z * sp, 0.25 + Math.random() * 0.2, 1.8, 0.6, [1, 0.9, 0.6, 1], [1, 0.4, 0.1, 0]);
    }
    this.fire.spawn(pos.x, pos.y, pos.z, 0, 0, 0, 0.12, 6, 10, [1, 0.8, 0.5, 1], [1, 0.4, 0.1, 0]);
    this.smoke.spawn(pos.x, pos.y, pos.z, 0, 0, 0, 1.2, 4, 14, [0.3, 0.3, 0.3, 0.5], [0.4, 0.4, 0.4, 0], 1);
  }

  splash(pos) {
    for (let i = 0; i < 50; i++) {
      const a = Math.random() * 6.28, sp = 10 + Math.random() * 40;
      this.smoke.spawn(pos.x, pos.y, pos.z, Math.cos(a) * sp, 40 + Math.random() * 90, Math.sin(a) * sp, 2 + Math.random() * 2,
        10, 40, [0.9, 0.95, 1, 0.9], [0.9, 0.95, 1, 0], 0.5, -40);
    }
  }

  update(dt) {
    this.smoke.update(dt); this.fire.update(dt); this.flash.update(dt);
    for (const L of this.lights) {
      if (L.t > 0) { L.t -= dt; L.l.intensity = Math.max(0, L.i0 * (L.t / L.max)) * 1000; } else L.l.intensity = 0;
    }
  }

  clear() { this.smoke.clear(); this.fire.clear(); this.flash.clear(); this.tGeo.setDrawRange(0, 0); this.lights.forEach(L => { L.t = 0; L.l.intensity = 0; }); }

  dispose() {
    this.smoke.dispose(this.scene); this.fire.dispose(this.scene); this.flash.dispose(this.scene);
    this.scene.remove(this.tracers); this.tGeo.dispose();
    this.lights.forEach(L => this.scene.remove(L.l));
  }
}

const _d = new THREE.Vector3();
export function rndDir() {
  do { _d.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1); } while (_d.lengthSq() > 1 || _d.lengthSq() < 0.01);
  return _d.normalize();
}
