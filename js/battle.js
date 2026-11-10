// Battle: one-on-one dogfight simulation, weapons, camera, effects, scoring.
import * as THREE from './vendor/three.module.min.js';
import { World, atmosFor } from './world.js';
import { FX, rndDir } from './fx.js';
import { buildJet, setFlame, buildMissileModel } from './models.js';
import { Aircraft, steerTo } from './aircraft.js';
import { PilotAI } from './ai.js';
import { performManeuver, tickEffects } from './maneuvers.js';
import { MISSILE_BY_ID, GUN_BY_ID, ENEMY_PAINTS, MANEUVER_BY_ID } from './data.js';
import { audio } from './audio.js';
import { input } from './input.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion();
const FLIP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

export class Battle {
  constructor(app, cfg) {
    this.app = app; this.cfg = cfg;
    this.scene = app.scene; this.camera = app.camera;
    this.rules = cfg.rules || {};
    this.time = 0; this.timeScale = 1; this.paused = false; this.over = false; this.result = null;
    this.messages = []; this.arena = 9000;
    this.missiles = []; this.bullets = []; this.flares = [];
    this.locks = new Map();
    this.camMode = cfg.settings.camera || 'chase';
    this.camQ = new THREE.Quaternion(); this.shake = 0;
    this.killcam = null; this.hitFlash = 0; this.damageFlash = 0;
    this.stats = { damageTaken: 0, damageDealt: 0, shotsFired: 0, shotsHit: 0, missilesFired: 0, missileHits: 0, evades: 0, flareDecoys: 0,
      maneuvers: 0, maneuverTypes: {}, lowAltTime: 0, gunKill: false };
    this.oobT = 0; this.playerFiringGun = false;
    this.cloudDensity = 0;
    this.setup();
  }

  // ------------------------------------------------------------------ setup
  setup() {
    const cfg = this.cfg, L = cfg.loadout;
    const atm = atmosFor(cfg.theater, cfg.timeOverride);
    this.world = new World(this.scene, { biome: cfg.theater.biome, atmos: atm, seed: cfg.seed, quality: cfg.settings.quality });
    this.app.renderer.toneMappingExposure = atm.exposure || 1;
    this.fx = new FX(this.scene);

    // player
    const ps = { ...L.stats };
    const pMesh = buildJet(L.aircraft.design, L.paint);
    this.scene.add(pMesh);
    this.player = new Aircraft({ stats: ps, mesh: pMesh, team: 0, name: L.aircraft.name });
    this.player.assist = cfg.settings.assist;
    if (this.rules.playerHp) this.player.hp = this.player.maxHp * this.rules.playerHp;
    this.player.flares = ps.flares; this.player.flareBonus = L.flareBonus;
    this.pw = {
      gun: L.gun, heat: 0, overheat: false, gunAcc: 0,
      missiles: L.missiles.map(m => ({ ...m, max: m.ammo, cd: 0 })), sel: 0,
      mcd: Object.fromEntries(L.maneuvers.map(id => [id, 0])), slots: L.maneuvers,
      shieldMax: L.shield ? ps.hp * 0.45 : 0, shield: L.shield ? ps.hp * 0.45 : 0,
      secondWind: L.secondWind, regen: L.regen,
    };
    this.pylonMissiles = pMesh.userData.missiles;

    // enemy
    const e = this.enemyDef = { ...cfg.enemy };
    if (this.rules.mirror) {
      Object.assign(e, { design: L.aircraft.design, speed: ps.speed, thrust: ps.thrust, pitch: ps.pitch, roll: ps.roll, yaw: ps.yaw, hp: ps.hp, stealth: ps.stealth, corner: ps.corner,
        missile: L.missiles[0]?.id || 'ir9', gun: L.gun.id });
    }
    const es = { speed: e.speed, thrust: e.thrust, pitch: e.pitch, roll: e.roll, yaw: e.yaw, hp: e.hp, corner: e.corner, stealth: e.stealth,
      traits: (e.design === 'tempest' || e.design === 'phantom' || e.design === 'wraith') ? ['tv'] : [] };
    const paint = ENEMY_PAINTS[e.paint] || ENEMY_PAINTS.red;
    const eMesh = buildJet(e.design, paint, { scale: e.scale || 1 });
    this.scene.add(eMesh);
    this.enemy = new Aircraft({ stats: es, mesh: eMesh, team: 1, name: e.name });
    this.enemy.flares = e.flares || 0; this.enemy.flareBonus = 0;
    e.gunDef = GUN_BY_ID[e.gun || 'g20'];
    const md = MISSILE_BY_ID[e.missile || 'ir9'];
    e.missileDef = { ...md, lock: md.lock * (1.7 - e.skill * 0.7), dmg: md.dmg * (0.7 + e.skill * 0.35), turn: md.turn * (0.85 + e.skill * 0.25) };
    e.noMissiles = !!this.rules.enemyNoMissiles;
    this.ew = { gunAcc: 0, mcd: 0, ammo: this.rules.enemyMissileCd ? 999 : 4 + Math.floor((cfg.level || 1) / 4) + (e.boss ? 6 : 0), salvoLeft: 0, salvoT: 0,
      missileCd: this.rules.enemyMissileCd || e.missileCd };
    this.ai = new PilotAI(this.enemy, this.player, e, this);

    // spawn
    const w = this.world;
    const px = (Math.random() - 0.5) * 1500, pz = -3600;
    this.player.pos.set(px, w.safeAlt(px, pz, 1600), pz);
    this.player.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0);
    this.player.speed = ps.speed * 0.8;
    const ex = (Math.random() - 0.5) * 3000, ez = 3600;
    this.enemy.pos.set(ex, w.safeAlt(ex, ez, 1700) + (Math.random() - 0.3) * 600, ez);
    this.enemy.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI + (Math.random() - 0.5) * 0.6);
    this.enemy.speed = es.speed * 0.8;
    this.camQ.copy(this.player.q);
    this.locks.set(this.player, { progress: 0, locked: false, inCone: false });
    this.locks.set(this.enemy, { progress: 0, locked: false, inCone: false });
    this.player.syncMesh(); this.enemy.syncMesh();
    this.updateCamera(0.016, true);

    this.message(`ENGAGE: ${e.name.toUpperCase()}`, '#ff5a4a', 4, true);
    if (e.boss) this.message('BOSS AIRCRAFT — ' + (e.title || ''), '#ffd25a', 4);
    else if (e.elite) this.message('ELITE PILOT DETECTED', '#ffd25a', 4);
    this.holdFire = 2.5;
    audio.startEngine();
  }

  opponentOf(ac) { return ac === this.player ? this.enemy : this.player; }
  lockOf(ac) { return this.locks.get(ac); }
  message(text, color = '#9fe8ff', dur = 3, big = false) { this.messages.push({ text, color, t: dur, max: dur, big }); if (this.messages.length > 5) this.messages.shift(); }
  stun(ac, t) { if (ac === this.enemy) { this.ai.stunT = Math.max(this.ai.stunT, t); this.message('ENEMY OVERSHOOT!', '#7dff9a'); } else { this.playerStun = t; } }
  resetLock(ac) { const l = this.locks.get(ac); if (l) { l.progress = 0; l.locked = false; } }
  missilesTargeting(ac) { return this.missiles.filter(m => m.alive && m.tracking && m.target === ac); }

  breakMissile(m, toFlare = false) {
    const fl = toFlare ? this.flares.filter(f => f.owner === m.target && f.alive) : [];
    if (fl.length) { m.target = fl[Math.floor(Math.random() * fl.length)]; m.decoyed = true; }
    else m.tracking = false;
    this.missileLost(m);
  }

  missileLost(m) {
    if (m.owner === this.enemy && m.everTrackedPlayer && !m.counted) {
      m.counted = true; this.stats.evades++; this.message('MISSILE EVADED', '#7dff9a', 1.8);
    }
  }

  doManeuver(ac, id) {
    if (ac.script || ac.cobra > 0) return false;
    const ok = performManeuver(id, ac, this);
    if (ok && ac === this.player) {
      this.stats.maneuvers++; this.stats.maneuverTypes[id] = true;
      this.message(MANEUVER_BY_ID[id].name.toUpperCase(), '#9fe8ff', 1.5);
    }
    return ok;
  }

  deployFlares(ac, bursts = 1, free = false) {
    if (!free) { if (ac.flares <= 0 || (ac.flareCd || 0) > this.time) return false; ac.flares--; ac.flareCd = this.time + 0.7; }
    audio.flare();
    const f = ac.fwd(_v3).clone(), r = ac.right(), u = ac.up();
    for (let b = 0; b < bursts; b++) for (let i = 0; i < 4; i++) {
      const side = (i % 2 ? 1 : -1) * (0.5 + Math.random() * 0.8);
      const vel = ac.vel.clone().multiplyScalar(0.55).addScaledVector(r, side * 40).addScaledVector(u, -20 - Math.random() * 25).addScaledVector(f, -30 - b * 25);
      this.flares.push({ pos: ac.pos.clone().addScaledVector(f, -4), vel, life: 3.5 + Math.random(), alive: true, owner: ac, radius: 0 });
    }
    // decoy rolls
    for (const m of this.missilesTargeting(ac)) {
      const base = m.def.seeker === 'ir' ? 0.82 : m.def.seeker === 'radar' ? 0.62 : 0.45;
      let p = base * (1 - m.cm) + (ac.flareBonus || 0);
      const d = m.pos.distanceTo(ac.pos);
      if (d > 3000) p *= 0.4;
      if (Math.random() < p) {
        const fl = this.flares.filter(x => x.owner === ac && x.alive);
        m.target = fl[Math.floor(Math.random() * fl.length)]; m.decoyed = true;
        if (ac === this.player) { this.stats.flareDecoys++; this.missileLost(m); }
      }
    }
    // chaff degrades locks on the deploying aircraft
    const opp = this.opponentOf(ac); const lk = this.locks.get(opp);
    if (lk) lk.progress *= 0.45;
    return true;
  }

  // ------------------------------------------------------------------ damage
  damage(target, amount, source, kind, at) {
    if (!target.alive || this.over && target === this.player && this.result === 'win') return;
    const attacker = source;
    if (attacker === this.player) {
      if (this.cfg.loadout.predator) { _v.copy(attacker.pos).sub(target.pos).normalize(); if (_v.dot(target.fwd()) < 0) amount *= 1.2; }
      if (kind === 'gun' && this.pw.gun.executioner && target.hp / target.maxHp < 0.35) amount *= 1.6;
      this.stats.damageDealt += amount;
      this.hitFlash = 0.15;
    }
    if (target === this.player) {
      if (this.pw.shield > 0) { const a = Math.min(this.pw.shield, amount); this.pw.shield -= a; amount -= a; }
      this.stats.damageTaken += amount;
      this.damageFlash = Math.min(1, this.damageFlash + amount / 30);
      this.shake = Math.min(2.5, this.shake + (kind === 'missile' ? 2 : 0.25));
      if (kind === 'missile') this.message('HIT! HULL DAMAGED', '#ff5a4a', 1.5);
      if (this.player.hp - amount <= 0 && this.pw.secondWind) {
        this.pw.secondWind = false; this.player.hp = this.player.maxHp * 0.3; this.message('SECOND WIND!', '#ffd25a', 2.5, true); return;
      }
    }
    target.hp -= amount; target.lastHit = this.time;
    if (target.hp <= 0) this.destroy(target, kind, attacker);
  }

  destroy(ac, kind, attacker) {
    if (!ac.alive) return;
    ac.alive = false; ac.hp = 0;
    this.fx.explosion(ac.pos, 1.6 * (ac === this.enemy ? (this.enemyDef.scale || 1) : 1), ac.vel);
    audio.explosion(ac.pos.distanceTo(this.camera.position), true);
    ac.wreck = { spin: new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 5), vy: 0 };
    this.shake = 2;
    if (ac === this.enemy) {
      this.stats.gunKill = kind === 'gun';
      this.message(kind === 'gun' ? 'SPLASH ONE — GUN KILL!' : kind === 'crash' ? 'ENEMY CRASHED — SPLASH ONE!' : 'SPLASH ONE!', '#7dff9a', 4, true);
      this.endBattle('win');
    } else {
      this.message(kind === 'crash' ? 'YOU CRASHED' : 'YOU WERE SHOT DOWN', '#ff5a4a', 4, true);
      this.endBattle('loss');
    }
  }

  endBattle(res) {
    if (this.over) return;
    this.over = true; this.result = res;
    const victim = res === 'win' ? this.enemy : this.player;
    this.killcam = { t: 0, target: victim, angle: Math.random() * 6.28, dur: 4.2 };
    this.timeScale = 0.3;
    audio.stopAllTones();
  }

  // ------------------------------------------------------------------ weapons: guns
  fireGun(ac, gun, w, dt, spreadExtra, color, target) {
    w.gunAcc += dt * gun.rof;
    let fired = 0;
    while (w.gunAcc >= 1) {
      w.gunAcc -= 1; fired++;
      const f = ac.fwd(new THREE.Vector3());
      // aim assist toward lead point
      if (target && target.alive && gun.assist) {
        const dist = target.pos.distanceTo(ac.pos);
        if (dist < gun.range) {
          const lead = target.pos.clone().addScaledVector(target.vel, dist / gun.speed).sub(ac.pos).normalize();
          const ang = Math.acos(clamp(f.dot(lead), -1, 1));
          if (ang < gun.assist) f.lerp(lead, 0.6).normalize();
        }
      }
      const sp = gun.spread + spreadExtra;
      f.x += (Math.random() - 0.5) * sp * 2; f.y += (Math.random() - 0.5) * sp * 2; f.z += (Math.random() - 0.5) * sp * 2; f.normalize();
      const muzzle = ac.pos.clone().addScaledVector(f, ac.radius * 1.1);
      const vel = ac.vel.clone().addScaledVector(f, gun.speed);
      this.bullets.push({ x: muzzle.x, y: muzzle.y, z: muzzle.z, vx: vel.x, vy: vel.y, vz: vel.z, life: gun.range / gun.speed, owner: ac,
        dmg: gun.dmg, color, laser: gun.id === 'laser' });
      if (ac === this.player) this.stats.shotsFired++;
    }
    return fired;
  }

  updateBullets(dt) {
    const B = this.bullets;
    for (let i = B.length - 1; i >= 0; i--) {
      const b = B[i];
      const ox = b.x, oy = b.y, oz = b.z;
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.life -= dt;
      let dead = b.life <= 0;
      const tgt = b.owner === this.player ? this.enemy : this.player;
      if (!dead && tgt.alive) {
        // relative segment test vs sphere
        const tx = tgt.pos.x, ty = tgt.pos.y, tz = tgt.pos.z;
        const ax = ox - (tx - tgt.vel.x * dt), ay = oy - (ty - tgt.vel.y * dt), az = oz - (tz - tgt.vel.z * dt);
        const bx = b.x - tx, by = b.y - ty, bz = b.z - tz;
        const dx = bx - ax, dy = by - ay, dz = bz - az;
        const l2 = dx * dx + dy * dy + dz * dz;
        const t = l2 > 0 ? clamp(-(ax * dx + ay * dy + az * dz) / l2, 0, 1) : 0;
        const cx = ax + dx * t, cy = ay + dy * t, cz = az + dz * t;
        if (cx * cx + cy * cy + cz * cz < tgt.radius * tgt.radius) {
          dead = true;
          _v.set(tx + cx, ty + cy, tz + cz);
          this.fx.smallHit(_v);
          if (b.owner === this.player) { this.stats.shotsHit++; if (Math.random() < 0.3) audio.hit(); }
          else audio.hit();
          this.damage(tgt, b.dmg, b.owner, 'gun', _v);
        }
      }
      if (!dead && b.y < this.world.groundAt(b.x, b.z)) dead = true;
      if (dead) { B[i] = B[B.length - 1]; B.pop(); }
    }
    this.fx.setTracers(B);
  }

  // ------------------------------------------------------------------ weapons: missiles
  launchMissile(ac, def, target, locked, extra = {}) {
    const f = ac.fwd(new THREE.Vector3()), r = ac.right(), u = ac.up();
    const side = ((this.missiles.length % 2) ? 1 : -1) * 2.5;
    const pos = ac.pos.clone().addScaledVector(r, side).addScaledVector(u, -1.5);
    const mesh = buildMissileModel(ac === this.player ? 0xf0f0f0 : 0xd8c8b0);
    this.scene.add(mesh);
    const life = def.range / def.speed * 1.35 + 1.5;
    const m = {
      def, owner: ac, target, tracking: !!(locked && target), pos, dir: f.clone(), vel: new THREE.Vector3(), speed: ac.speed + 20, maxSpeed: def.speed + ac.speed * 0.6,
      life, burn: life * 0.65, age: 0, mesh, dmg: def.dmg, cm: def.cm, turn: def.turn, alive: true, smokeT: 0, decoyed: false,
      fuse: def.count > 1 ? 9 : 13, everTrackedPlayer: false, counted: false, radius: 2, ...extra,
    };
    if (extra.spreadDir) m.dir.add(extra.spreadDir).normalize();
    this.missiles.push(m);
    audio.missileLaunch();
    if (ac === this.player) this.stats.missilesFired++; else this.stats.enemyMissiles = (this.stats.enemyMissiles || 0) + 1;
    return m;
  }

  firePlayerMissile() {
    if (this.rules.noMissiles) { this.message('MISSILES DISABLED', '#ff9d3c', 1); return; }
    const w = this.pw, m = w.missiles[w.sel];
    if (!m) return;
    if (m.ammo <= 0) { this.message('NO ' + m.name.toUpperCase() + ' LEFT', '#ff9d3c', 1); audio.deny(); return; }
    if (m.cd > 0) return;
    const lk = this.locks.get(this.player);
    const locked = lk.locked;
    m.ammo--; m.cd = m.reload;
    if (m.count > 1) {
      const incoming = this.missilesTargeting(this.player).sort((a, b) => a.pos.distanceTo(this.player.pos) - b.pos.distanceTo(this.player.pos));
      for (let i = 0; i < m.count; i++) {
        let tgt = this.enemy, lockIt = locked;
        if (i >= 2 && incoming.length) { tgt = incoming[(i - 2) % incoming.length]; lockIt = true; }
        const sd = rndDir().clone().multiplyScalar(0.12);
        setTimeout(() => !this.disposed && !this.over && this.launchMissile(this.player, m, tgt, lockIt, { spreadDir: sd, fuse: tgt === this.enemy ? 9 : 14 }), i * 90);
      }
    } else this.launchMissile(this.player, m, this.enemy, locked);
    this.ai.onPlayerMissile();
    // hide pylon missile visuals proportionally
    const total = w.missiles.reduce((s, x) => s + x.ammo, 0), max = w.missiles.reduce((s, x) => s + x.max, 0);
    const vis = Math.ceil(this.pylonMissiles.length * total / Math.max(1, max));
    this.pylonMissiles.forEach((mm, i) => mm.visible = i < vis);
  }

  updateMissiles(dt) {
    const M = this.missiles;
    for (let i = M.length - 1; i >= 0; i--) {
      const m = M[i];
      if (!m.alive) { this.scene.remove(m.mesh); M.splice(i, 1); continue; }
      m.age += dt; m.life -= dt;
      if (m.age < m.burn) m.speed = Math.min(m.maxSpeed, m.speed + m.maxSpeed * 1.3 * dt);
      else m.speed -= m.speed * 0.12 * dt;
      const tgt = m.target;
      if (m.tracking && tgt && tgt.alive !== false) {
        _v.copy(tgt.pos).sub(m.pos);
        const dist = _v.length(); _v.divideScalar(Math.max(1, dist));
        const off = Math.acos(clamp(m.dir.dot(_v), -1, 1));
        if (off > 1.35 && m.age > 0.5) { m.tracking = false; this.missileLost(m); }
        else {
          const closing = Math.max(80, m.speed * Math.max(0.2, m.dir.dot(_v)) - (tgt.vel ? tgt.vel.dot(_v) : 0));
          const tgo = Math.min(4, dist / closing);
          _v2.copy(tgt.pos); if (tgt.vel) _v2.addScaledVector(tgt.vel, tgo * 0.9);
          _v2.sub(m.pos).normalize();
          let turn = m.turn * (m.age < 0.25 ? 0.3 : 1);
          if (tgt.mods && tgt.mods.jink) turn *= 0.25;
          if (tgt.cobra > 0 && (m.def.seeker === 'radar')) turn *= 0.5;
          const ang = Math.acos(clamp(m.dir.dot(_v2), -1, 1));
          if (ang > 1e-4) {
            const k = Math.min(1, (turn * dt) / ang);
            m.dir.lerp(_v2, k).normalize();
          }
          if (tgt === this.player) m.everTrackedPlayer = true;
        }
      }
      const prev = _v3.copy(m.pos);
      const px = prev.x, py = prev.y, pz = prev.z;
      m.vel.copy(m.dir).multiplyScalar(m.speed);
      m.pos.addScaledVector(m.vel, dt);
      // proximity fuse (relative segment)
      if (tgt && tgt.alive !== false && (m.tracking || m.age > 0.3)) {
        const tv = tgt.vel || _v.set(0, 0, 0);
        const ax = px - (tgt.pos.x - tv.x * dt), ay = py - (tgt.pos.y - tv.y * dt), az = pz - (tgt.pos.z - tv.z * dt);
        const bx = m.pos.x - tgt.pos.x, by = m.pos.y - tgt.pos.y, bz = m.pos.z - tgt.pos.z;
        const dx = bx - ax, dy = by - ay, dz = bz - az, l2 = dx * dx + dy * dy + dz * dz;
        const t = l2 > 0 ? clamp(-(ax * dx + ay * dy + az * dz) / l2, 0, 1) : 0;
        const cx = ax + dx * t, cy = ay + dy * t, cz = az + dz * t;
        const fuse = m.fuse * ((tgt.mods && tgt.mods.jink) ? 0.5 : 1) + (tgt.radius || 0) * 0.5;
        if (cx * cx + cy * cy + cz * cz < fuse * fuse) { this.detonate(m, tgt); continue; }
      }
      // also hit the non-target aircraft if passing extremely close (unguided shots)
      const other = m.owner === this.player ? this.enemy : this.player;
      if (other !== tgt && other.alive && m.age > 0.3 && m.pos.distanceTo(other.pos) < other.radius + 6) { this.detonate(m, other); continue; }
      if (m.pos.y < this.world.groundAt(m.pos.x, m.pos.z)) {
        this.fx.explosion(m.pos, 0.6); if (this.world.isWater(m.pos.x, m.pos.z)) this.fx.splash(m.pos);
        audio.explosion(m.pos.distanceTo(this.camera.position));
        m.alive = false; this.missileLost(m); continue;
      }
      if (m.life <= 0 || (m.age > m.burn && m.speed < 170)) {
        this.fx.explosion(m.pos, 0.35); m.alive = false; this.missileLost(m); continue;
      }
      // visuals
      m.mesh.position.copy(m.pos);
      _q.setFromUnitVectors(_v.set(0, 0, 1), m.dir); m.mesh.quaternion.copy(_q);
      m.smokeT -= dt;
      const tail = _v2.copy(m.pos).addScaledVector(m.dir, -3);
      if (m.smokeT <= 0) {
        m.smokeT = 0.018;
        const burning = m.age < m.burn;
        this.fx.smoke.spawn(tail.x, tail.y, tail.z, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3 + 1, (Math.random() - 0.5) * 3,
          burning ? 3.5 + Math.random() * 1.5 : 1.2, 2.5, burning ? 16 : 8, [0.92, 0.92, 0.92, burning ? 0.55 : 0.2], [0.85, 0.85, 0.88, 0], 0.4, 1);
        if (burning) this.fx.fire.spawn(tail.x, tail.y, tail.z, 0, 0, 0, 0.08, 4, 1.5, [1, 0.85, 0.5, 1], [1, 0.4, 0.1, 0]);
      }
    }
  }

  detonate(m, tgt) {
    m.alive = false;
    this.fx.explosion(m.pos, 0.8, tgt.vel);
    audio.explosion(m.pos.distanceTo(this.camera.position));
    if (tgt.hp !== undefined && tgt.alive) {
      if (m.owner === this.player) { this.stats.missileHits++; this.message('MISSILE HIT', '#7dff9a', 1.4); }
      else this.stats.enemyMissileHits = (this.stats.enemyMissileHits || 0) + 1;
      this.damage(tgt, m.dmg, m.owner, 'missile', m.pos);
      if (tgt === this.player) this.shake = 2.5;
    } else if (tgt.def) { // intercepted a missile
      tgt.alive = false; this.fx.explosion(tgt.pos, 0.6); this.missileLost(tgt);
      if (m.owner === this.player) this.message('MISSILE INTERCEPTED', '#7dff9a', 1.6);
    } else {
      this.missileLost(m);
    }
  }

  updateFlares(dt) {
    for (let i = this.flares.length - 1; i >= 0; i--) {
      const f = this.flares[i];
      f.life -= dt; f.vel.multiplyScalar(1 - 0.9 * dt); f.vel.y -= 9.81 * dt;
      f.pos.addScaledVector(f.vel, dt);
      this.fx.fire.spawn(f.pos.x, f.pos.y, f.pos.z, 0, 0, 0, 0.15, 7, 3, [1, 0.95, 0.8, 1], [1, 0.5, 0.2, 0]);
      if (Math.random() < 0.6) this.fx.smoke.spawn(f.pos.x, f.pos.y, f.pos.z, 0, 2, 0, 1.6, 2, 9, [0.9, 0.9, 0.9, 0.35], [0.9, 0.9, 0.9, 0], 0.5);
      if (f.life <= 0) { f.alive = false; this.flares.splice(i, 1); }
    }
  }

  // ------------------------------------------------------------------ lock-on
  updateLock(ac, target, wdef, radar, dt) {
    const lk = this.locks.get(ac);
    if (!wdef || !target.alive || !ac.alive) { lk.progress = 0; lk.locked = false; lk.inCone = false; return; }
    _v.copy(target.pos).sub(ac.pos); const dist = _v.length(); _v.divideScalar(dist);
    const off = Math.acos(clamp(ac.fwd(_v2).dot(_v), -1, 1));
    const det = radar * (1 - target.stats.stealth * 0.45);
    lk.dist = dist; lk.off = off;
    lk.inCone = off < wdef.fov && dist < Math.min(wdef.range, det);
    if (lk.inCone) lk.progress += dt / (wdef.lock * (1 + target.stats.stealth * 1.4));
    else lk.progress -= dt * (ac === this.player ? 2 : 0.6);
    lk.progress = clamp(lk.progress, 0, 1);
    const was = lk.locked; lk.locked = lk.progress >= 1;
    if (lk.locked && !was && ac === this.player) this.message('LOCKED', '#ff5a4a', 0.8);
  }

  // ------------------------------------------------------------------ main update
  update(rawDt) {
    if (this.paused) return;
    const dt = Math.min(0.05, rawDt) * this.timeScale;
    this.time += dt;
    const P = this.player, E = this.enemy, w = this.world, pw = this.pw;
    input.pollPad();
    const pad = input.pad;

    // ---------- player controls
    if (P.alive) {
      const inv = this.cfg.settings.invert ? -1 : 1;
      let pitch = (input.down('KeyS', 'ArrowDown') ? 1 : 0) - (input.down('KeyW', 'ArrowUp') ? 1 : 0);
      pitch *= inv;
      let roll = (input.down('KeyD', 'ArrowRight') ? 1 : 0) - (input.down('KeyA', 'ArrowLeft') ? 1 : 0);
      let yaw = (input.down('KeyE') ? 1 : 0) - (input.down('KeyQ') ? 1 : 0);
      if (pad) { pitch += pad.ly * inv; roll += pad.lx; yaw += pad.rx; }
      P.input.pitch = clamp(pitch, -1, 1); P.input.roll = clamp(roll, -1, 1); P.input.yaw = clamp(yaw, -1, 1);
      P.boost = input.down('ShiftLeft', 'ShiftRight') || !!(pad && pad.boost);
      P.brake = input.down('KeyX') || !!(pad && pad.brake);
      P.throttle = P.brake ? 0.2 : 0.8;
      // out-of-bounds autopilot
      const r = Math.hypot(P.pos.x, P.pos.z);
      if (r > this.arena) {
        this.oobT += dt;
        if (this.oobT > 5) { const st = steerTo(P, _v.set(-P.pos.x, 0.05, -P.pos.z).normalize(), 1); P.input.pitch = st.pitch; P.input.roll = st.roll; }
      } else this.oobT = Math.max(0, this.oobT - dt * 2);
      if (this.playerStun > 0) this.playerStun -= dt;

      // weapons
      let gunHeld = input.down('Space') || input.mouse.left || !!(pad && pad.gun);
      let fireMsl = input.hit('KeyF') || input.hit('MouseRight') || !!(pad && pad.missile);
      if (this.autopilot) { const o = this.autopilot(this, dt) || {}; gunHeld = !!o.gun; fireMsl = !!o.missile; }
      this.playerFiringGun = false;
      const gun = pw.gun;
      if (gunHeld && !pw.overheat && this.holdFire <= 0.5) {
        const n = this.fireGun(P, gun, pw, dt, 0, gun.id === 'laser' ? [0.4, 1, 1] : [1, 0.85, 0.45], E);
        if (n > 0) { pw.heat += gun.heat * n; this.playerFiringGun = true; if (Math.random() < 0.5 || n > 1) audio.gunBurst(gun.id === 'g30', gun.id === 'laser'); this.shake = Math.max(this.shake, 0.12); }
        if (pw.heat >= 1) { pw.overheat = true; this.message('GUN OVERHEAT', '#ff9d3c', 1.2); }
      } else pw.gunAcc = 0;
      pw.heat = Math.max(0, pw.heat - dt * (pw.overheat ? 0.45 : 0.32));
      if (pw.overheat && pw.heat <= 0.25) pw.overheat = false;
      if (fireMsl) this.firePlayerMissile();
      if (input.hit('KeyR') || input.hit('Tab') || (pad && pad.swap)) { if (pw.missiles.length > 1) { pw.sel = (pw.sel + 1) % pw.missiles.length; this.resetLock(P); this.message(pw.missiles[pw.sel].name.toUpperCase(), '#9fe8ff', 1); audio.click(); } }
      if (input.hit('KeyG') || (pad && pad.flare)) { if (this.deployFlares(P)) {} else if (P.flares <= 0) this.message('NO FLARES', '#ff9d3c', 1); }
      pw.slots.forEach((id, i) => {
        if (input.hit('Digit' + (i + 1)) || (pad && pad.m[i])) {
          if (pw.mcd[id] > 0) { audio.deny(); return; }
          if (this.doManeuver(P, id)) pw.mcd[id] = MANEUVER_BY_ID[id].cd * this.cfg.loadout.cdMul;
        }
      });
      for (const id in pw.mcd) pw.mcd[id] = Math.max(0, pw.mcd[id] - dt);
      pw.missiles.forEach(m => m.cd = Math.max(0, m.cd - dt));
      // regen / shield
      if (pw.regen && this.time - P.lastHit > 4) P.hp = Math.min(P.maxHp, P.hp + pw.regen * dt);
      if (pw.shieldMax && this.time - P.lastHit > 3) pw.shield = Math.min(pw.shieldMax, pw.shield + 7 * dt);
      const alt = P.pos.y - w.groundAt(P.pos.x, P.pos.z);
      if (alt < 150) this.stats.lowAltTime += dt;
    }
    if (input.hit('KeyV') || (pad && pad.cam)) { this.camMode = this.camMode === 'chase' ? 'cockpit' : 'chase'; }
    this.lookTarget = input.down('KeyC') || !!(pad && pad.look);
    this.holdFire -= dt;

    // ---------- AI
    if (E.alive && P.alive) {
      const o = this.ai.update(dt);
      if (this.holdFire <= 0) {
        if (o.gun) {
          const e = this.enemyDef;
          const g = { ...e.gunDef, dmg: e.gunDef.dmg * (e.gunDmgMul || 1), rof: e.gunDef.rof * 0.6, assist: 0 };
          const spread = (1 - e.skill) * 0.02 + 0.004 + (P.gunDodge > 0 ? 0.03 : 0) + (P.mods.jink ? 0.015 : 0);
          const n = this.fireGun(E, g, this.ew, dt, spread, g.id === 'laser' ? [1, 0.3, 0.3] : [1, 0.45, 0.25], null);
          if (n && Math.random() < 0.3) audio.gunBurst(false, g.id === 'laser');
        } else this.ew.gunAcc = 0;
        this.ew.mcd -= dt;
        if (o.missile && this.ew.mcd <= 0 && this.ew.ammo > 0 && this.ew.salvoLeft <= 0) {
          this.ew.salvoLeft = this.enemyDef.salvo || 1; this.ew.salvoT = 0; this.ew.mcd = this.ew.missileCd;
        }
        if (this.ew.salvoLeft > 0) {
          this.ew.salvoT -= dt;
          if (this.ew.salvoT <= 0) {
            this.ew.salvoT = 0.3; this.ew.salvoLeft--; this.ew.ammo--;
            const md = this.enemyDef.missileDef;
            if (md.count > 1) for (let k = 0; k < md.count; k++) this.launchMissile(E, md, P, true, { spreadDir: rndDir().clone().multiplyScalar(0.15) });
            else this.launchMissile(E, md, P, true);
            this.message('MISSILE LAUNCH DETECTED', '#ff5a4a', 1.6);
          }
        }
      }
    }
    if (P.gunDodge > 0) P.gunDodge -= dt;

    // ---------- physics
    for (const ac of [P, E]) {
      if (ac.alive) {
        ac.update(dt, w);
        tickEffects(ac, dt);
        const g = w.groundAt(ac.pos.x, ac.pos.z);
        if (ac.pos.y < g + 2) {
          ac.pos.y = g + 2;
          if (w.isWater(ac.pos.x, ac.pos.z)) this.fx.splash(ac.pos);
          this.destroy(ac, 'crash', null);
        }
      } else if (ac.wreck) this.updateWreck(ac, dt);
      ac.syncMesh();
      if (ac.mesh) setFlame(ac.mesh, ac.throttle, ac.boost && ac.alive, this.time);
    }
    // mid-air collision
    if (P.alive && E.alive && P.pos.distanceTo(E.pos) < (P.radius + E.radius) * 0.8 && (this.collideT || 0) < this.time) {
      this.collideT = this.time + 1.5;
      this.fx.explosion(_v.copy(P.pos).lerp(E.pos, 0.5), 0.7);
      audio.explosion(0);
      this.message('MID-AIR COLLISION!', '#ff5a4a', 1.5);
      _v.copy(P.pos).sub(E.pos).normalize();
      P.pos.addScaledVector(_v, 12); E.pos.addScaledVector(_v, -12);
      this.damage(E, 30 + E.maxHp * 0.1, P, 'collision'); this.damage(P, 40 + P.maxHp * 0.2, E, 'collision');
    }

    // ---------- locks
    const curM = pw.missiles[pw.sel];
    this.updateLock(P, E, this.rules.noMissiles ? null : curM && curM.ammo > 0 ? curM : null, P.stats.radar, dt);
    this.updateLock(E, P, this.enemyDef.noMissiles ? null : this.enemyDef.missileDef, 7000, dt);

    this.updateBullets(dt);
    this.updateMissiles(dt);
    this.updateFlares(dt);
    this.updateTrails(dt);
    this.fx.update(dt);
    const camVel = this.player.alive ? this.player.vel : _v.set(0, 0, 0);
    w.update(dt, this.camera.position, camVel, () => audio.thunder());
    this.updateCamera(rawDt * (this.timeScale < 1 ? 0.6 : 1));
    this.cloudDensity = w.clouds.density(this.camera.position);

    // messages
    for (const m of this.messages) m.t -= rawDt;
    this.messages = this.messages.filter(m => m.t > 0);
    this.hitFlash = Math.max(0, this.hitFlash - rawDt);
    this.damageFlash = Math.max(0, this.damageFlash - rawDt * 1.5);
    this.shake = Math.max(0, this.shake - rawDt * 3);

    this.updateAudio();
    if (this.killcam) {
      this.killcam.t += rawDt;
      if (this.killcam.t > 1.4) this.timeScale = Math.min(1, this.timeScale + rawDt * 0.8);
      if (this.killcam.t > 1.2 && (input.hit('Enter') || input.hit('Escape') || input.hit('KeyF'))) this.killcam.t = this.killcam.dur + 1;
      if (this.killcam.t > this.killcam.dur && !this.finished) { this.finished = true; this.cfg.onEnd(this.summary()); }
    }
    input.endFrame();
  }

  updateWreck(ac, dt) {
    const wr = ac.wreck;
    wr.vy -= 9.81 * dt * 2;
    ac.vel.multiplyScalar(1 - 0.3 * dt); ac.vel.y += wr.vy * dt;
    ac.pos.addScaledVector(ac.vel, dt);
    _q.setFromEuler(new THREE.Euler(wr.spin.x * dt, wr.spin.y * dt, wr.spin.z * dt)); ac.q.multiply(_q);
    ac.cobra = 0;
    this.fx.fire.spawn(ac.pos.x, ac.pos.y, ac.pos.z, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, 0.5, 8, 16, [1, 0.6, 0.2, 1], [0.6, 0.1, 0, 0], 1);
    this.fx.smoke.spawn(ac.pos.x, ac.pos.y, ac.pos.z, (Math.random() - 0.5) * 6, 4, (Math.random() - 0.5) * 6, 5, 10, 40, [0.08, 0.08, 0.08, 0.8], [0.25, 0.25, 0.25, 0], 0.4, 3);
    const g = this.world.groundAt(ac.pos.x, ac.pos.z);
    if (ac.pos.y < g + 2) {
      if (this.world.isWater(ac.pos.x, ac.pos.z)) this.fx.splash(ac.pos);
      this.fx.explosion(ac.pos, 2.2);
      audio.explosion(ac.pos.distanceTo(this.camera.position), true);
      ac.wreck = null; ac.mesh.visible = false;
    }
  }

  updateTrails(dt) {
    for (const ac of [this.player, this.enemy]) {
      if (!ac.alive) continue;
      const frac = ac.hp / ac.maxHp;
      const tail = _v.copy(ac.pos).addScaledVector(ac.fwd(_v2), -ac.radius);
      if (frac < 0.6 && Math.random() < (1 - frac) * 1.5 * dt * 30) {
        const dark = frac < 0.3;
        this.fx.smoke.spawn(tail.x, tail.y, tail.z, (Math.random() - 0.5) * 4, 2, (Math.random() - 0.5) * 4, dark ? 3.5 : 2.2, 3, dark ? 18 : 12,
          dark ? [0.12, 0.12, 0.12, 0.7] : [0.6, 0.6, 0.6, 0.45], [0.3, 0.3, 0.3, 0], 0.5, 1);
        if (dark && Math.random() < 0.5) this.fx.fire.spawn(tail.x, tail.y, tail.z, 0, 0, 0, 0.2, 3, 5, [1, 0.6, 0.2, 1], [0.8, 0.2, 0, 0]);
      }
      // wingtip vapor on high-G
      if (ac.g > 5.5 && ac.mesh) {
        for (const n of ac.mesh.userData.navs) {
          n.getWorldPosition(_v3);
          this.fx.smoke.spawn(_v3.x, _v3.y, _v3.z, 0, 0, 0, 0.6, 0.8, 2.5, [1, 1, 1, Math.min(0.5, (ac.g - 5.5) * 0.12)], [1, 1, 1, 0]);
        }
      }
      // boosting heat shimmer / exhaust at high speed
      if (ac.boost && Math.random() < 0.5) this.fx.smoke.spawn(tail.x, tail.y, tail.z, 0, 0, 0, 0.6, 2, 5, [0.8, 0.8, 0.8, 0.08], [0.8, 0.8, 0.8, 0]);
    }
  }

  // ------------------------------------------------------------------ camera
  updateCamera(dt, snap = false) {
    const cam = this.camera, P = this.player;
    if (this.killcam) {
      const k = this.killcam, t = k.target;
      k.angle += dt * 0.5;
      const d = 45 + k.t * 12;
      _v.set(Math.cos(k.angle) * d, 12 + k.t * 4, Math.sin(k.angle) * d);
      cam.position.copy(t.pos).add(_v);
      cam.up.set(0, 1, 0);
      cam.lookAt(t.pos);
      this.applyShake(dt);
      cam.fov += (62 - cam.fov) * Math.min(1, dt * 3); cam.updateProjectionMatrix();
      if (P.mesh) P.mesh.visible = true;
      return;
    }
    const meshQ = P.mesh.quaternion;
    if (this.camMode === 'cockpit') {
      P.mesh.visible = false;
      cam.position.copy(P.pos).add(_v.set(0, 1.0, P.radius * 0.35).applyQuaternion(meshQ));
      cam.quaternion.copy(meshQ).multiply(FLIP);
      cam.up.set(0, 1, 0).applyQuaternion(meshQ);
    } else {
      P.mesh.visible = true;
      const k = snap ? 1 : 1 - Math.exp(-dt * 5.5);
      this.camQ.slerp(meshQ, k);
      const dist = 18 + P.radius * 2.6, h = 4 + P.radius * 0.5;
      if (this.lookTarget && this.enemy.alive) {
        _v2.copy(this.enemy.pos).sub(P.pos).normalize();
        const up = _v3.set(0, 1, 0).applyQuaternion(this.camQ);
        cam.position.copy(P.pos).addScaledVector(_v2, -dist).addScaledVector(up, h);
        cam.up.copy(up);
        cam.lookAt(_v.copy(P.pos).addScaledVector(_v2, 60));
      } else {
        const off = _v.set(0, h, -dist).applyQuaternion(this.camQ);
        cam.position.copy(P.pos).add(off);
        cam.up.set(0, 1, 0).applyQuaternion(this.camQ);
        const fwd = _v2.set(0, 0, 1).applyQuaternion(this.camQ);
        cam.lookAt(_v3.copy(P.pos).addScaledVector(fwd, 70).addScaledVector(cam.up, h * 0.6));
      }
    }
    const spd = P.speed / P.stats.speed;
    const tf = 68 + clamp(spd - 0.6, 0, 1) * 14 + (P.boost ? 4 : 0);
    cam.fov += (tf - cam.fov) * Math.min(1, dt * 2); cam.updateProjectionMatrix();
    this.applyShake(dt);
  }
  applyShake() {
    const s = this.shake * 0.35 + (this.player.boost && this.player.alive ? 0.04 : 0) + (this.world.turbulence > 0.5 ? 0.05 : 0);
    if (s > 0) this.camera.position.add(_v.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s));
  }

  // ------------------------------------------------------------------ audio state
  updateAudio() {
    const P = this.player;
    if (!P.alive || this.over) { audio.stopAllTones(); audio.updateEngine(0.3, false, 0.3); return; }
    audio.updateEngine(P.throttle, P.boost, P.speed / P.stats.speed);
    const lk = this.locks.get(P);
    const t = this.time;
    if (lk.locked) audio.setTone('lock', true, 1750, 0.06);
    else if (lk.progress > 0.02) audio.setTone('lock', (t * 6) % 1 < 0.5, 1150, 0.05);
    else audio.setTone('lock', false);
    const incoming = this.missilesTargeting(P).length > 0;
    const elk = this.locks.get(this.enemy);
    if (incoming) audio.setTone('warn', (t * 9) % 1 < 0.5, 900, 0.07, 'square');
    else if (elk.progress > (this.cfg.loadout.earlyWarn ? 0.15 : 0.4)) audio.setTone('warn', (t * 2.5) % 1 < 0.35, 650, 0.05, 'square');
    else audio.setTone('warn', false);
  }

  // ------------------------------------------------------------------ results
  summary() {
    const won = this.result === 'win';
    return {
      won, time: this.time, hpFrac: Math.max(0, this.player.hp / this.player.maxHp), damageTaken: this.stats.damageTaken,
      ...this.stats, gunKill: won && this.stats.gunKill, boss: !!this.enemyDef.boss, elite: !!this.enemyDef.elite, enemyName: this.enemyDef.name,
    };
  }

  dispose() {
    this.disposed = true;
    audio.stopAllTones(); audio.stopEngine();
    this.missiles.forEach(m => this.scene.remove(m.mesh));
    for (const ac of [this.player, this.enemy]) if (ac.mesh) { this.scene.remove(ac.mesh); ac.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    this.fx.dispose(); this.world.dispose();
  }
}
