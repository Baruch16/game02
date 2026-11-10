// Special maneuvers: scripted flight sequences with tactical side-effects.
import * as THREE from './vendor/three.module.min.js';

const _v = new THREE.Vector3();

function addEffect(ac, dur, onEnd) { ac.effects = ac.effects || []; ac.effects.push({ t: dur, onEnd }); }

export function tickEffects(ac, dt) {
  if (!ac.effects) return;
  for (let i = ac.effects.length - 1; i >= 0; i--) {
    const e = ac.effects[i]; e.t -= dt;
    if (e.t <= 0) { e.onEnd && e.onEnd(); ac.effects.splice(i, 1); }
  }
}

// script that rolls to a target bank, then pulls through `angle`, then optional roll-out
function loopScript(ac, { preBank, angle, rollOut, pitchRate, onDone }) {
  let phase = 0, acc = 0, t = 0, rolled = 0;
  return {
    update(dt) {
      t += dt;
      if (phase === 0) {
        const b = ac.bank();
        let err = preBank - b; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
        if (Math.abs(err) < 0.12 || t > 1.4) { phase = 1; t = 0; }
        return { pitch: 0, roll: Math.max(-1, Math.min(1, err * 3)), yaw: 0, rollRate: ac.stats.roll * 1.3 };
      }
      if (phase === 1) {
        acc += pitchRate * dt;
        if (acc >= angle) { phase = rollOut ? 2 : 3; t = 0; }
        return { pitch: 1, roll: 0, yaw: 0, pitchRate };
      }
      if (phase === 2) {
        const rr = ac.stats.roll * 1.2; rolled += rr * dt;
        if (rolled >= Math.PI) { phase = 3; }
        return { pitch: 0, roll: 1, yaw: 0, rollRate: rr };
      }
      onDone && onDone();
      return false;
    },
  };
}

export function performManeuver(id, ac, battle) {
  const foe = battle.opponentOf(ac);
  const behindFoe = (range) => {
    if (!foe || !foe.alive) return false;
    _v.copy(foe.pos).sub(ac.pos);
    const d = _v.length(); if (d > range) return false;
    return _v.normalize().dot(ac.fwd()) < -0.2; // foe is behind me
  };
  const s = ac.stats;
  switch (id) {
    case 'highg':
      ac.mods.pitchMul = 1.8; ac.mods.highG = true;
      addEffect(ac, 3, () => { ac.mods.pitchMul = 1; ac.mods.highG = false; });
      break;
    case 'roll': {
      const rr = s.roll * 1.35; let a = 0;
      ac.script = { update(dt) { a += rr * dt; if (a >= Math.PI * 2) return false; return { pitch: 0.35, roll: 1, yaw: 0.15, rollRate: rr }; } };
      battle.missilesTargeting(ac).forEach(m => { if (m.pos.distanceTo(ac.pos) < 1500 && Math.random() < 0.55) battle.breakMissile(m); });
      ac.gunDodge = 1.6;
      break;
    }
    case 'immel': {
      const stunFoe = behindFoe(1600);
      ac.script = loopScript(ac, { preBank: 0, angle: Math.PI, rollOut: true, pitchRate: Math.max(s.pitch * 1.15, 1.25),
        onDone: () => { ac.speed *= 0.85; } });
      if (stunFoe) battle.stun(foe, 1.2);
      break;
    }
    case 'splits':
      ac.script = loopScript(ac, { preBank: Math.PI, angle: Math.PI, rollOut: false, pitchRate: Math.max(s.pitch * 1.2, 1.3),
        onDone: () => { ac.speed *= 1.25; } });
      if (behindFoe(1600)) battle.stun(foe, 0.8);
      break;
    case 'evasive': {
      battle.deployFlares(ac, 3, true);
      battle.missilesTargeting(ac).forEach(m => { if (Math.random() < 0.85) battle.breakMissile(m, true); });
      battle.resetLock(foe);
      let t = 0; const pr = s.pitch * 1.4;
      ac.script = { update(dt) { t += dt; if (t > 1.3) return false; return { pitch: 1, roll: t < 0.3 ? 1 : 0, yaw: 0, pitchRate: pr }; } };
      break;
    }
    case 'cobra': {
      if (behindFoe(1000)) battle.stun(foe, 1.6);
      battle.missilesTargeting(ac).forEach(m => { if ((m.def.seeker === 'radar' || m.def.seeker === 'dual') && Math.random() < 0.7) battle.breakMissile(m); });
      battle.resetLock(foe);
      let t = 0;
      ac.script = {
        update(dt) {
          t += dt;
          if (t < 0.45) ac.cobra = (t / 0.45) * 1.5;
          else if (t < 0.95) ac.cobra = 1.5;
          else if (t < 1.6) ac.cobra = 1.5 * (1 - (t - 0.95) / 0.65);
          else { ac.cobra = 0; return false; }
          return { pitch: 0, roll: 0, yaw: 0 };
        },
      };
      break;
    }
    case 'surge':
      ac.mods.speedMul = 1.45; ac.mods.thrustMul = 2.2; ac.speed *= 1.3;
      addEffect(ac, 4, () => { ac.mods.speedMul = 1; ac.mods.thrustMul = 1; });
      break;
    case 'jink':
      ac.mods.jink = 1;
      addEffect(ac, 5, () => { ac.mods.jink = 0; });
      break;
    default: return false;
  }
  return true;
}
