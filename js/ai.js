// Enemy pilot AI: state machine with styles, adaptive learning, and skill scaling.
import * as THREE from './vendor/three.module.min.js';
import { steerTo } from './aircraft.js';

const UP = new THREE.Vector3(0, 1, 0);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export class PilotAI {
  constructor(me, foe, def, battle) {
    this.me = me; this.foe = foe; this.def = def; this.b = battle;
    this.skill = def.skill;
    this.style = def.style;
    this.reaction = 0.5 - 0.38 * this.skill;
    this.timer = 0; this.state = 'pursue'; this.stateT = 0;
    this.stunT = 0;
    this.desired = new THREE.Vector3(0, 0, 1);
    this.maxPull = 0.62 + 0.38 * this.skill;
    this.flareChance = def.flares > 0 ? 0.2 + 0.65 * this.skill : 0;
    this.flareDist = 350 + 650 * this.skill;
    this.noticeChance = 0.35 + 0.65 * this.skill;
    this.evadeRange = 1200 + 2000 * this.skill;
    this.aimTol = 0.035 + 0.04 * (1 - this.skill);
    this.mem = { playerMissiles: 0, tailTime: 0, gunTime: 0, notices: new Set() };
    this.learn = 0.3 + this.skill * 0.7;
    this.defendRange = 1800 + 800 * this.skill;
    this.scissorT = 0; this.scissorDir = 1;
    this.handled = new WeakSet();
    this.noticed = new WeakSet();
    this.extendT = 0; this.energyPhase = 'climb';
    this.mcd = {};
    const m = [];
    if (this.skill > 0.4 || def.boss) m.push('roll');
    if (this.skill > 0.55 || def.boss) m.push('evasive', 'splits');
    if (this.skill > 0.65 || def.boss) m.push('immel', 'jink');
    if (this.skill > 0.75 || (def.boss && def.style === 'ace')) m.push('cobra');
    if (def.style === 'energy' || this.skill > 0.85) m.push('surge');
    this.maneuvers = m;
    this.burstT = 0; this.burstCd = 0;
    this.jinkGuns = 0;
    this.out = { gun: false, missile: false };
  }

  notice(key, text) {
    if (this.mem.notices.has(key)) return;
    this.mem.notices.add(key); this.b.message(text, '#ff9d3c');
  }

  onPlayerMissile() {
    this.mem.playerMissiles++;
    this.flareChance = Math.min(0.97, this.flareChance + 0.07 * this.learn);
    this.flareDist += 70 * this.learn;
    this.noticeChance = Math.min(1, this.noticeChance + 0.08 * this.learn);
    if (this.mem.playerMissiles === 3 && this.learn > 0.5) this.notice('msl', 'ENEMY ADAPTING — anticipating your missile launches');
  }

  tryManeuver(list) {
    for (const id of list) {
      if (!this.maneuvers.includes(id)) continue;
      if ((this.mcd[id] || 0) > this.b.time) continue;
      if (this.me.script) return false;
      if (this.b.doManeuver(this.me, id)) { this.mcd[id] = this.b.time + 14 - this.skill * 6; return true; }
    }
    return false;
  }

  update(dt) {
    const me = this.me, foe = this.foe, b = this.b;
    this.out.gun = false; this.out.missile = false;
    if (!me.alive) return this.out;
    if (this.stunT > 0) { this.stunT -= dt; me.input.pitch *= 0.97; return this.out; }
    this.timer -= dt; this.stateT += dt;

    const toFoe = foe.pos.clone().sub(me.pos);
    const dist = toFoe.length();
    const dirFoe = toFoe.clone().divideScalar(Math.max(1, dist));
    const fwd = me.fwd();
    const foeFwd = foe.fwd();
    const offNose = Math.acos(clamp(fwd.dot(dirFoe), -1, 1));
    const foeAspect = Math.acos(clamp(foeFwd.dot(dirFoe.clone().negate()), -1, 1)); // 0 = foe nose on me
    const foeBehind = fwd.dot(dirFoe) < -0.2;

    // learning: player sitting on our six
    if (foeAspect < 0.35 && dist < 1500 && foe.alive) {
      this.mem.tailTime += dt;
      if (this.mem.tailTime > 7 && this.learn > 0.5) {
        this.defendRange = 3200; this.notice('tail', 'ENEMY ADAPTING — switching to vertical defense');
      }
    }
    if (b.playerFiringGun && foeAspect < 0.2 && dist < 1500) {
      this.mem.gunTime += dt;
      if (this.mem.gunTime > 3 && this.learn > 0.45) { this.jinkGuns = 1; this.notice('gun', 'ENEMY ADAPTING — jinking against your guns'); }
    }

    if (this.timer <= 0) {
      this.timer = this.reaction * (0.7 + Math.random() * 0.6);
      const ps = this.state;
      this.decide(dist, dirFoe, fwd, foeAspect, foeBehind, offNose);
      if (ps !== this.state) this.stateT = 0;
    }

    // steer
    const st = steerTo(me, this.desired, this.maxPull, 0.25);
    me.input.pitch = st.pitch; me.input.roll = st.roll; me.input.yaw = st.yaw;
    if (this.jinkGuns && foeAspect < 0.2 && dist < 1500) {
      me.input.roll += Math.sin(b.time * 5.3) * 0.6; me.input.pitch += Math.sin(b.time * 3.7) * 0.4;
    }

    // weapons (attack states only)
    if (foe.alive && this.state !== 'avoid' && this.state !== 'evade') {
      const gun = this.def.gunDef;
      if (gun && dist < gun.range * 0.95) {
        const tof = dist / gun.speed;
        const lead = foe.pos.clone().addScaledVector(foe.vel, tof).sub(me.pos).normalize();
        const err = Math.acos(clamp(fwd.dot(lead), -1, 1));
        this.burstCd -= dt;
        if (err < this.aimTol && this.burstCd <= 0) { this.burstT = 0.4 + Math.random() * 0.7 * (0.5 + this.skill); this.burstCd = 1.6 - this.skill; }
        if (this.burstT > 0) { this.burstT -= dt; if (err < this.aimTol * 2.5) this.out.gun = true; }
      }
      const lk = b.lockOf(me);
      if (lk && lk.locked && !this.def.noMissiles) {
        const m = this.def.missileDef;
        const window = m.range * (0.35 + 0.5 * this.skill);
        const minD = 350;
        if (dist < Math.max(window, 900) && dist > minD) this.out.missile = true;
      }
    }
    return this.out;
  }

  decide(dist, dirFoe, fwd, foeAspect, foeBehind, offNose) {
    const me = this.me, foe = this.foe, b = this.b, w = b.world;
    const D = this.desired;

    // 1. terrain avoidance (highest priority)
    const look = Math.max(2.5, 4 - this.skill);
    const ahead = me.pos.clone().addScaledVector(me.vel, look);
    const ahead2 = me.pos.clone().addScaledVector(me.vel, look * 0.5);
    const clearance = 260;
    const g1 = w.groundAt(ahead.x, ahead.z), g2 = w.groundAt(ahead2.x, ahead2.z), g0 = w.groundAt(me.pos.x, me.pos.z);
    if (ahead.y < g1 + clearance || ahead2.y < g2 + clearance || me.pos.y < g0 + clearance * 0.8) {
      this.state = 'avoid';
      const flat = fwd.clone(); flat.y = 0; if (flat.lengthSq() < 0.01) flat.set(0, 0, 1); flat.normalize();
      D.copy(flat).addScaledVector(UP, 1.3).normalize();
      me.boost = true; me.throttle = 1; me.brake = false;
      return;
    }
    // 2. arena bounds / ceiling
    const r = Math.hypot(me.pos.x, me.pos.z);
    if (r > b.arena * 1.05 || me.pos.y > 9500) {
      this.state = 'return';
      D.set(-me.pos.x, 0, -me.pos.z).normalize();
      D.y = me.pos.y > 9500 ? -0.4 : 0.05; D.normalize();
      me.throttle = 1; me.boost = false;
      return;
    }

    // 3. missile threat
    const threats = b.missilesTargeting(me);
    let threat = null, td = 1e9;
    for (const m of threats) { const d = m.pos.distanceTo(me.pos); if (d < td) { td = d; threat = m; } }
    if (threat && td < this.evadeRange) {
      if (!this.noticed.has(threat)) { this.noticed.add(threat); threat.aiSeen = Math.random() < this.noticeChance; }
      if (threat.aiSeen) {
        this.state = 'evade';
        // beam the missile: fly perpendicular to its line of sight
        const m2me = me.pos.clone().sub(threat.pos).normalize();
        let side = m2me.clone().cross(UP).normalize();
        if (side.dot(fwd) < 0) side.negate();
        const alt = me.pos.y - w.groundAt(me.pos.x, me.pos.z);
        side.y = alt > 1200 ? -0.35 : 0.15;
        D.copy(side).normalize();
        me.boost = true; me.throttle = 1; me.brake = false;
        if (!this.handled.has(threat) && td < this.flareDist + threat.speed * 0.3) {
          this.handled.add(threat);
          if (Math.random() < this.flareChance) b.deployFlares(me, 1);
          if (td < 900 && Math.random() < this.skill) this.tryManeuver(['evasive', 'jink', 'roll', 'splits']);
        }
        return;
      }
    }

    // 4. defensive: foe on my six
    if (foeAspect < 0.55 && dist < this.defendRange && foeBehind && this.style !== 'rookie') {
      this.state = 'defend';
      this.scissorT -= this.reaction;
      if (this.scissorT <= 0) { this.scissorT = 1.6 + Math.random() * 2; this.scissorDir = Math.random() < 0.5 ? 1 : -1; }
      let side = dirFoe.clone().cross(UP).normalize().multiplyScalar(this.scissorDir);
      const alt = me.pos.y - w.groundAt(me.pos.x, me.pos.z);
      const vert = this.defendRange > 3000 ? (alt > 2000 ? -0.6 : 0.7) : (this.skill > 0.5 ? (Math.sin(b.time * 0.7) * 0.5) : 0);
      side.y += vert;
      D.copy(side).addScaledVector(dirFoe, -0.25).normalize();
      me.throttle = 1; me.boost = dist > 800; me.brake = false;
      this.defT = (this.defT || 0) + this.reaction;
      if (dist < 900 && Math.random() < this.skill * 0.6) this.tryManeuver(dist < 600 ? ['cobra', 'roll', 'immel', 'splits'] : ['immel', 'splits', 'roll', 'surge']);
      else if (this.defT > 7 - this.skill * 3 && this.skill > 0.45) {
        // stuck on the defensive: attempt a reversal
        if (this.tryManeuver(['cobra', 'splits', 'immel', 'jink', 'surge'])) { this.defT = 0; this.notice('rev', 'ENEMY ATTEMPTING A REVERSAL'); }
      }
      return;
    }

    this.defT = Math.max(0, (this.defT || 0) - this.reaction * 0.5);
    // 5. offensive styles
    let style = this.style;
    if (style === 'ace') {
      // ace adapts: if the player wins turning fights, go energy; if the player is passive, brawl
      style = this.mem.tailTime > 5 ? 'energy' : (dist > 3500 ? 'sniper' : 'brawler');
    }
    const lead = this.leadPoint(dist);
    const toLead = lead.sub(me.pos).normalize();
    const alt = me.pos.y;

    if (style === 'sniper') {
      if (this.state === 'extend') {
        if (dist > 3800 || this.stateT > 9) this.state = 'pursue';
        else { D.copy(dirFoe).negate(); D.y = 0.05; D.normalize(); me.boost = true; me.throttle = 1; return; }
      }
      if (dist < 1100 && this.stateT > 3 && offNose > 0.6) { this.state = 'extend'; this.stateT = 0; }
      else this.state = 'pursue';
      D.copy(toLead); me.boost = dist > 2500; me.throttle = 0.9; me.brake = false;
    } else if (style === 'energy') {
      if (this.energyPhase === 'climb') {
        D.copy(dirFoe); D.y = 0; D.normalize(); D.y = 0.55; D.normalize();
        me.boost = true; me.throttle = 1;
        if (alt > foe.pos.y + 700 || dist < 1400) this.energyPhase = 'dive';
        this.state = 'climb';
      } else if (this.energyPhase === 'dive') {
        D.copy(toLead); me.boost = true; me.throttle = 1; this.state = 'pursue';
        if (dist < 350 || (offNose > 1.6 && dist < 1200)) { this.energyPhase = 'extend'; this.extendT = 4 + Math.random() * 2; }
      } else {
        this.extendT -= this.reaction;
        D.copy(fwd); D.y = Math.max(D.y, 0.15); D.normalize(); me.boost = true; this.state = 'extend';
        if (this.extendT <= 0) this.energyPhase = 'climb';
      }
      me.brake = false;
    } else {
      // brawler / rookie pursuit with energy management
      this.state = 'pursue';
      D.copy(dist > 2500 && style === 'rookie' ? dirFoe : toLead);
      const closing = -me.vel.clone().sub(foe.vel).dot(dirFoe.clone().negate());
      if (dist < 450 && closing > 60 && offNose < 0.5) { me.throttle = 0.3; me.brake = this.skill > 0.4; me.boost = false; }
      else if (dist > 1200) { me.throttle = 1; me.boost = this.skill > 0.25; me.brake = false; }
      else { me.throttle = 0.85; me.boost = false; me.brake = false; }
      if (style === 'rookie') { me.boost = false; this.desired.y += Math.sin(b.time * 0.3) * 0.05; }
      // high skill aces sometimes use the High-G turn to pull lead
      if (offNose > 0.6 && offNose < 2 && dist < 1500 && Math.random() < this.skill * 0.15) this.tryManeuver(['highg']);
    }
  }

  leadPoint(dist) {
    const foe = this.foe;
    const gun = this.def.gunDef;
    const tof = dist < 1500 ? dist / (gun ? gun.speed : 1000) : Math.min(2.5, dist / 800);
    const k = 0.4 + this.skill * 0.6;
    return foe.pos.clone().addScaledVector(foe.vel, tof * k);
  }
}
