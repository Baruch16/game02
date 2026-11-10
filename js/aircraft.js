// Arcade flight model shared by player and AI aircraft.
import * as THREE from './vendor/three.module.min.js';

const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export class Aircraft {
  constructor({ stats, mesh, team, name, scale = 1 }) {
    this.stats = stats; this.mesh = mesh; this.team = team; this.name = name;
    this.pos = new THREE.Vector3(); this.q = new THREE.Quaternion(); this.vel = new THREE.Vector3();
    this.speed = stats.speed * 0.75;
    this.maxHp = stats.hp; this.hp = stats.hp;
    this.alive = true;
    this.throttle = 0.75; this.boost = false; this.brake = false;
    this.input = { pitch: 0, roll: 0, yaw: 0 };
    this.c = { pitch: 0, roll: 0, yaw: 0 }; // smoothed inputs
    this.mods = { pitchMul: 1, speedMul: 1, dragMul: 1, jink: 0, highG: false };
    this.script = null;       // scripted maneuver
    this.cobra = 0;           // visual pitch-up angle for cobra
    this.g = 1; this.aoa = 0;
    this.radius = Math.max(5, (mesh?.userData?.len || 14) * 0.42);
    this.lastHit = -99; this.time = 0;
    this.fuelBoost = 1;
    this.stalled = false;
    this.assist = false;
    this.wobble = new THREE.Vector3();
  }

  fwd(out = new THREE.Vector3()) { return out.copy(AZ).applyQuaternion(this.q); }
  up(out = new THREE.Vector3()) { return out.copy(AY).applyQuaternion(this.q); }
  right(out = new THREE.Vector3()) { return out.set(-1, 0, 0).applyQuaternion(this.q); }

  // bank angle: + when right wing down
  bank() {
    const r = this.right(_v), u = this.up(_v2);
    return Math.atan2(-r.y, u.y);
  }
  pitchAngle() { return Math.asin(clamp(this.fwd(_v).y, -1, 1)); }
  heading() { const f = this.fwd(_v); return Math.atan2(f.x, f.z); }

  rotLocal(axis, ang) { _q.setFromAxisAngle(axis, ang); this.q.multiply(_q); }

  update(dt, world) {
    this.time += dt;
    const s = this.stats;
    let { pitch, roll, yaw } = this.input;
    let pitchRateOverride = 0, rollRateOverride = 0;
    if (this.script) {
      const o = this.script.update(dt, this);
      if (o === false) this.script = null;
      else if (o) { pitch = o.pitch ?? pitch; roll = o.roll ?? roll; yaw = o.yaw ?? yaw; pitchRateOverride = o.pitchRate || 0; rollRateOverride = o.rollRate || 0; }
    }
    // flight assist: gently level the wings only when the pilot is neither rolling nor pulling
    if (this.assist && !this.script && Math.abs(roll) < 0.1 && Math.abs(pitch) < 0.15) {
      const b = this.bank();
      roll = clamp(-b * 0.8, -0.5, 0.5);
    }
    if (this.mods.jink > 0) {
      pitch += Math.sin(this.time * 9.3) * 0.5; roll += Math.sin(this.time * 6.1 + 1) * 0.8;
    }
    // input smoothing (control surface lag)
    const k = Math.min(1, dt * 9);
    this.c.pitch += (clamp(pitch, -1, 1) - this.c.pitch) * k;
    this.c.roll += (clamp(roll, -1, 1) - this.c.roll) * Math.min(1, dt * 12);
    this.c.yaw += (clamp(yaw, -1, 1) - this.c.yaw) * k;

    const v = this.speed;
    const maxV = s.speed * this.mods.speedMul;
    let eff = v < s.corner ? clamp(v / s.corner, 0.22, 1) : 1 - 0.32 * clamp((v - s.corner) / (maxV * 1.25 - s.corner), 0, 1);
    if (s.traits && s.traits.includes('highAoA')) eff = Math.max(eff, Math.min(1, 0.5 + v / s.corner * 0.5));
    if (s.traits && s.traits.includes('forgiving')) eff = Math.max(eff, 0.4);

    const pRate = pitchRateOverride || s.pitch * eff * this.mods.pitchMul;
    const rRate = rollRateOverride || s.roll * (0.45 + 0.55 * eff);
    const yRate = s.yaw * eff;
    const pitchUp = this.c.pitch;
    // negative pitch (push) is weaker, like real jets
    const pAct = pitchUp >= 0 ? pitchUp * pRate : pitchUp * pRate * 0.6;
    this.rotLocal(AX, -pAct * dt);
    this.rotLocal(AZ, this.c.roll * rRate * dt);
    this.rotLocal(AY, -this.c.yaw * yRate * dt);

    // stall: nose falls toward the ground
    const f = this.fwd(_v);
    const stallV = 68;
    this.stalled = v < stallV && this.cobra <= 0;
    if (v < stallV + 15) {
      const amt = clamp((stallV + 15 - v) / (stallV + 15), 0, 1) * 1.4 * dt;
      const axis = _v2.copy(f).cross(new THREE.Vector3(0, -1, 0));
      if (axis.lengthSq() > 1e-4) { axis.normalize(); _q.setFromAxisAngle(axis, amt); this.q.premultiply(_q); }
    }
    this.q.normalize();

    // energy
    const fw = this.fwd(new THREE.Vector3());
    const thr = this.throttle + (this.boost ? 0.62 * this.fuelBoost : 0);
    const thrustA = s.thrust * thr * (this.mods.thrustMul || 1);
    const dragK = s.thrust / (maxV * maxV);
    let drag = dragK * v * v * (this.brake ? 3.2 : 1) * this.mods.dragMul;
    const grav = -9.81 * fw.y;
    const pullLoad = Math.abs(pAct) / Math.max(0.5, s.pitch);
    const tv = s.traits && s.traits.includes('tv');
    const induced = pullLoad * v * 0.075 * (this.mods.highG ? 2.1 : 1) * (tv ? 1.15 : 1);
    let dv = (thrustA - drag + grav - induced) * dt;
    this.speed = clamp(v + dv, 25, maxV * 1.7);
    if (this.cobra > 0) this.speed = Math.max(55, this.speed * (1 - 1.6 * dt));

    this.g = 1 + (pAct * this.speed) / 9.81 * (pitchUp >= 0 ? 1 : -1) * Math.sign(pAct || 1);
    this.g = 1 + Math.abs(pAct) * this.speed / 9.81;

    // velocity
    this.vel.copy(fw).multiplyScalar(this.speed);
    if (v < stallV) this.vel.y -= (stallV - v) * 0.9;
    if (world) {
      this.vel.addScaledVector(world.wind, 0.5);
      if (world.turbulence > 0) {
        const tb = world.turbulence;
        this.wobble.set(Math.sin(this.time * 1.7) + Math.sin(this.time * 4.3) * 0.5, Math.sin(this.time * 2.3 + 1) + Math.sin(this.time * 5.1) * 0.4, 0).multiplyScalar(tb);
        this.rotLocal(AX, this.wobble.y * 0.012 * dt * 10);
        this.rotLocal(AZ, this.wobble.x * 0.02 * dt * 10);
      }
    }
    this.pos.addScaledVector(this.vel, dt);
    this.aoa = this.cobra;
  }

  syncMesh() {
    if (!this.mesh) return;
    this.mesh.position.copy(this.pos);
    this.mesh.quaternion.copy(this.q);
    if (this.cobra > 0) { _q.setFromAxisAngle(AX, -this.cobra); this.mesh.quaternion.multiply(_q); }
  }
}

// ------------------------------------------------------------------ steering helper (used by AI + autopilot)
const _inv = new THREE.Quaternion(), _l = new THREE.Vector3();
export function steerTo(ac, dir, maxPull = 1, levelBias = 0.3) {
  _inv.copy(ac.q).invert();
  _l.copy(dir).normalize().applyQuaternion(_inv); // local: x=left, y=up, z=fwd
  const ang = Math.acos(clamp(_l.z, -1, 1));
  let pitch, roll, yaw;
  if (ang < 0.18) {
    pitch = clamp(_l.y * 9, -1, 1);
    yaw = clamp(-_l.x * 9, -1, 1);
    roll = clamp(-ac.bank() * levelBias * 2, -0.5, 0.5) + clamp(-_l.x * 4, -0.4, 0.4);
  } else {
    const rollErr = Math.atan2(-_l.x, _l.y);
    roll = clamp(rollErr * 2.6, -1, 1);
    const aligned = Math.abs(rollErr) < 0.9 ? 1 : Math.abs(rollErr) < 1.6 ? 0.45 : 0.1;
    pitch = clamp(ang * 2.5, 0, 1) * aligned * maxPull;
    if (_l.y < 0 && Math.abs(rollErr) > 2.4 && ang < 0.6) { pitch = clamp(_l.y * 3, -0.6, 0); roll *= 0.3; }
    yaw = clamp(-_l.x * 2, -0.6, 0.6);
  }
  return { pitch, roll, yaw, ang };
}
