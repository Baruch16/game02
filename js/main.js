// SKY DOMINANCE — application bootstrap, render loop, showroom.
import * as THREE from './vendor/three.module.min.js';
import { initTextures } from './fx.js';
import { makeShowroom } from './world.js';
import { buildJet, setFlame } from './models.js';
import { Battle } from './battle.js';
import { HUD } from './hud.js';
import { input } from './input.js';
import { audio } from './audio.js';
import { profile } from './save.js';
import { UI } from './ui.js';

class App {
  constructor() {
    const canvas = document.getElementById('gl');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, profile.settings.quality === 'low' ? 1 : 1.75));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.5, 80000);
    initTextures();
    this.hud = new HUD(document.getElementById('hud'));
    // showroom (separate scene for menus)
    this.showScene = new THREE.Scene();
    this.showCam = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 2000);
    this.show = makeShowroom(this.showScene);
    this.showJetKey = ''; this.showJet = null; this.showRot = 0.6; this.showOffset = 0; this.drag = null;
    this.battle = null;
    this.last = performance.now();
    input.init();
    window.addEventListener('resize', () => this.resize());
    const gl = canvas;
    gl.addEventListener('pointerdown', e => { if (!this.battle) this.drag = { x: e.clientX, r: this.showRot }; });
    window.addEventListener('pointermove', e => { if (this.drag) this.showRot = this.drag.r + (e.clientX - this.drag.x) * 0.01; });
    window.addEventListener('pointerup', () => this.drag = null);
    this.ui = new UI(this);
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  resize() {
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = this.showCam.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix(); this.showCam.updateProjectionMatrix();
    this.hud.resize();
  }

  setShowJet(design, paint, scale = 1) {
    const key = design + JSON.stringify(paint) + scale;
    if (key === this.showJetKey) return;
    this.showJetKey = key;
    if (this.showJet) { this.showScene.remove(this.showJet); this.showJet.traverse(o => o.geometry && o.geometry.dispose()); }
    this.showJet = buildJet(design, paint, { scale });
    this.showScene.add(this.showJet);
    this.showJet.userData.pop = 0;
  }

  startBattle(cfg) {
    audio.init(); audio.setVolume(profile.settings.volume);
    if (this.battle) this.battle.dispose();
    document.body.classList.add('in-battle');
    this.battle = new Battle(this, cfg);
    this.camera.fov = 68; this.camera.updateProjectionMatrix();
  }

  endBattle() {
    if (this.battle) { this.battle.dispose(); this.battle = null; }
    document.body.classList.remove('in-battle');
    this.renderer.toneMappingExposure = 1;
    this.hud.clear();
  }

  loop(now) {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    if (this.battle) {
      this.battle.update(dt);
      if (this.battle) {
        this.renderer.render(this.scene, this.camera);
        this.hud.draw(this.battle, this.camera);
        this.ui.battleTick && this.ui.battleTick();
      }
      return;
    }
    // showroom
    const t = now / 1000;
    if (!this.drag) this.showRot += dt * 0.25;
    if (this.showJet) {
      const j = this.showJet;
      j.userData.pop = Math.min(1, j.userData.pop + dt * 3);
      const len = j.userData.len;
      j.rotation.set(Math.sin(t * 0.7) * 0.04, this.showRot, Math.sin(t * 0.9) * 0.06);
      j.position.y = Math.sin(t * 1.2) * 0.25 + 0.4;
      j.scale.setScalar(0.85 + 0.15 * j.userData.pop);
      setFlame(j, 0.6, false, t);
      const d = 17 + len * 1.75;
      this.showCam.position.set(Math.sin(0.5) * d * 0.25 + this.showOffset * d * 0.5, 3.2 + len * 0.15, d);
      this.showCam.lookAt(this.showOffset * d * 0.5, 0, 0);
    }
    this.show.ring.material.opacity = 0.4 + Math.sin(t * 2) * 0.15;
    this.renderer.toneMappingExposure = 1;
    this.renderer.render(this.showScene, this.showCam);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  try { window.app = new App(); }
  catch (e) {
    console.error(e);
    document.getElementById('ui').innerHTML = `<div class="fatal"><h2>Unable to start SKY DOMINANCE</h2><p>WebGL is required. ${e.message}</p></div>`;
  }
  const ld = document.getElementById('loading'); if (ld) { ld.classList.add('done'); setTimeout(() => ld.remove(), 600); }
});
