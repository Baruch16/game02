// Combat HUD drawn on a 2D canvas overlay.
import * as THREE from './vendor/three.module.min.js';
import { MANEUVER_BY_ID } from './data.js';

const C = '#7dffb0', CD = 'rgba(125,255,176,0.35)', RED = '#ff4a3d', AMB = '#ffb43c';
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export class HUD {
  constructor(canvas) { this.cv = canvas; this.g = canvas.getContext('2d'); this.resize(); }
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cv.width = innerWidth * dpr; this.cv.height = innerHeight * dpr;
    this.cv.style.width = innerWidth + 'px'; this.cv.style.height = innerHeight + 'px';
    this.dpr = dpr; this.W = innerWidth; this.H = innerHeight;
  }
  clear() { this.g.setTransform(1, 0, 0, 1, 0, 0); this.g.clearRect(0, 0, this.cv.width, this.cv.height); }

  // world → screen; returns {x,y,behind}
  proj(p, cam) {
    _v.copy(p).applyMatrix4(cam.matrixWorldInverse);
    const behind = _v.z > 0;
    _v.applyMatrix4(cam.projectionMatrix);
    return { x: (_v.x * 0.5 + 0.5) * this.W, y: (-_v.y * 0.5 + 0.5) * this.H, behind, ndcx: _v.x, ndcy: _v.y };
  }

  draw(b, cam) {
    const g = this.g; this.clear();
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const W = this.W, H = this.H, P = b.player, E = b.enemy;
    g.lineWidth = 1.5; g.font = '600 13px "Rajdhani", "Segoe UI", sans-serif'; g.textBaseline = 'middle';

    // environmental overlays
    if (b.cloudDensity > 0) { g.fillStyle = `rgba(235,240,245,${Math.min(0.85, b.cloudDensity * 1.4)})`; g.fillRect(0, 0, W, H); }
    if (b.world.flash > 0.3) { g.fillStyle = `rgba(230,235,255,${(b.world.flash - 0.3) * 0.35})`; g.fillRect(0, 0, W, H); }
    if (b.damageFlash > 0 || (P.alive && P.hp / P.maxHp < 0.3)) {
      const a = Math.max(b.damageFlash * 0.6, P.hp / P.maxHp < 0.3 ? 0.25 + Math.sin(b.time * 6) * 0.1 : 0);
      const rg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
      rg.addColorStop(0, 'rgba(255,0,0,0)'); rg.addColorStop(1, `rgba(200,0,0,${a})`);
      g.fillStyle = rg; g.fillRect(0, 0, W, H);
    }
    if (b.killcam) { this.drawMessages(g, b, W, H); this.letterbox(g, W, H, Math.min(1, b.killcam.t * 2)); return; }
    if (!P.alive) return;

    if (b.camMode === 'cockpit') this.cockpit(g, b, cam, W, H);

    // boresight & flight path
    const fwd = P.fwd(_v2);
    const bore = this.proj(_v2.clone().multiplyScalar(1000).add(P.pos), cam);
    g.strokeStyle = C; g.fillStyle = C;
    if (!bore.behind) {
      g.beginPath(); g.moveTo(bore.x - 14, bore.y); g.lineTo(bore.x - 5, bore.y); g.moveTo(bore.x + 5, bore.y); g.lineTo(bore.x + 14, bore.y);
      g.moveTo(bore.x, bore.y - 14); g.lineTo(bore.x, bore.y - 5); g.moveTo(bore.x, bore.y + 5); g.lineTo(bore.x, bore.y + 9); g.stroke();
      // seeker cone circle
      const m = b.pw.missiles[b.pw.sel];
      if (m && !b.rules.noMissiles) {
        const r = Math.tan(m.fov) / Math.tan(cam.fov * Math.PI / 360) * H / 2;
        g.setLineDash([4, 6]); g.strokeStyle = CD; g.beginPath(); g.arc(bore.x, bore.y, Math.min(r, H * 0.6), 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
      }
      if (b.hitFlash > 0) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(bore.x - 18, bore.y - 18); g.lineTo(bore.x - 10, bore.y - 10); g.moveTo(bore.x + 18, bore.y - 18); g.lineTo(bore.x + 10, bore.y - 10); g.moveTo(bore.x - 18, bore.y + 18); g.lineTo(bore.x - 10, bore.y + 10); g.moveTo(bore.x + 18, bore.y + 18); g.lineTo(bore.x + 10, bore.y + 10); g.stroke(); g.lineWidth = 1.5; }
    }

    // enemy target box / lead
    if (E.alive) this.target(g, b, cam, W, H);
    // incoming missiles markers
    for (const m of b.missiles) {
      if (!m.alive || m.owner === P) continue;
      const s = this.proj(m.pos, cam);
      const tracking = m.tracking && m.target === P;
      if (!s.behind && s.x > 0 && s.x < W && s.y > 0 && s.y < H) {
        g.strokeStyle = tracking ? RED : AMB; g.beginPath(); g.moveTo(s.x, s.y - 9); g.lineTo(s.x + 8, s.y + 6); g.lineTo(s.x - 8, s.y + 6); g.closePath(); g.stroke();
        g.fillStyle = tracking ? RED : AMB; g.font = '600 11px Rajdhani, sans-serif'; g.fillText((m.pos.distanceTo(P.pos) / 1000).toFixed(1), s.x + 11, s.y);
      } else if (tracking) this.edgeArrow(g, s, W, H, RED, 10);
    }

    this.leftPanel(g, b, W, H);
    this.tapes(g, b, W, H);
    this.compass(g, b, W, H);
    if (!b.rules.noRadar) this.radar(g, b, W, H); else this.jammed(g, W, H);
    this.weapons(g, b, W, H);
    this.maneuvers(g, b, W, H);
    this.warnings(g, b, W, H);
    this.drawMessages(g, b, W, H);
  }

  letterbox(g, W, H, k) {
    g.fillStyle = '#000'; const h = H * 0.1 * k; g.fillRect(0, 0, W, h); g.fillRect(0, H - h, W, h);
  }

  edgeArrow(g, s, W, H, color, size = 14) {
    let x = s.ndcx, y = s.ndcy;
    if (s.behind) { x = -x; y = -y; }
    const ang = Math.atan2(-y, x);
    const cx = W / 2, cy = H / 2;
    const rx = W / 2 - 40, ry = H / 2 - 40;
    const t = Math.min(rx / Math.abs(Math.cos(ang) || 1e-6), ry / Math.abs(Math.sin(ang) || 1e-6));
    const px = cx + Math.cos(ang) * t, py = cy + Math.sin(ang) * t;
    g.save(); g.translate(px, py); g.rotate(ang);
    g.fillStyle = color; g.beginPath(); g.moveTo(size, 0); g.lineTo(-size * 0.7, size * 0.7); g.lineTo(-size * 0.3, 0); g.lineTo(-size * 0.7, -size * 0.7); g.closePath(); g.fill();
    g.restore();
    return { x: px, y: py };
  }

  target(g, b, cam, W, H) {
    const P = b.player, E = b.enemy;
    const lk = b.locks.get(P);
    const dist = E.pos.distanceTo(P.pos);
    const s = this.proj(E.pos, cam);
    const onScreen = !s.behind && s.x > 20 && s.x < W - 20 && s.y > 20 && s.y < H - 20;
    const radar = P.stats.radar * (1 - E.stats.stealth * 0.45);
    const visible = dist < radar || dist < 2500;
    if (!visible && !onScreen) return;
    const col = lk.locked ? RED : lk.progress > 0 ? AMB : C;
    if (onScreen) {
      const sz = clamp(4000 / dist * 6, 14, 40);
      g.strokeStyle = col; g.lineWidth = 2;
      g.beginPath(); g.moveTo(s.x, s.y - sz); g.lineTo(s.x + sz, s.y); g.lineTo(s.x, s.y + sz); g.lineTo(s.x - sz, s.y); g.closePath(); g.stroke();
      if (lk.progress > 0 && !lk.locked) {
        const r = sz + 60 * (1 - lk.progress);
        g.beginPath(); g.arc(s.x, s.y, r, 0, Math.PI * 2); g.stroke();
      }
      if (lk.locked) {
        g.beginPath(); g.arc(s.x, s.y, sz + 6, 0, Math.PI * 2); g.stroke();
        g.fillStyle = RED; g.font = '700 14px Rajdhani, sans-serif'; g.textAlign = 'center'; g.fillText('LOCK', s.x, s.y + sz + 18); g.textAlign = 'left';
      }
      g.lineWidth = 1.5;
      // labels
      g.fillStyle = col; g.font = '600 12px Rajdhani, sans-serif'; g.textAlign = 'center';
      g.fillText(`${b.enemyDef.name.toUpperCase()}  ${(dist / 1000).toFixed(2)} km`, s.x, s.y - sz - 26);
      // hp bar
      const bw = 70, f = E.hp / E.maxHp;
      g.strokeStyle = col; g.strokeRect(s.x - bw / 2, s.y - sz - 16, bw, 5);
      g.fillStyle = f > 0.5 ? C : f > 0.25 ? AMB : RED; g.fillRect(s.x - bw / 2, s.y - sz - 16, bw * f, 5);
      const stTxt = { evade: 'EVADING', defend: 'DEFENSIVE', pursue: 'ATTACKING', extend: 'EXTENDING', climb: 'CLIMBING', avoid: 'TERRAIN', return: 'REPOSITION' }[b.ai.state] || '';
      g.fillStyle = 'rgba(200,255,220,0.7)'; g.font = '500 11px Rajdhani, sans-serif';
      g.fillText(b.ai.stunT > 0 ? 'DISORIENTED' : stTxt, s.x, s.y + sz + (lk.locked ? 32 : 16));
      g.textAlign = 'left';
      // gun lead pipper
      if (dist < b.pw.gun.range * 1.3) {
        const tof = dist / b.pw.gun.speed;
        _v2.copy(E.vel).sub(P.vel).multiplyScalar(tof).add(E.pos);
        const ls = this.proj(_v2, cam);
        if (!ls.behind) {
          g.strokeStyle = dist < b.pw.gun.range ? '#fff' : CD;
          g.beginPath(); g.arc(ls.x, ls.y, 9, 0, Math.PI * 2); g.stroke();
          g.beginPath(); g.arc(ls.x, ls.y, 2, 0, Math.PI * 2); g.fillStyle = g.strokeStyle; g.fill();
          g.setLineDash([2, 4]); g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(ls.x, ls.y); g.stroke(); g.setLineDash([]);
        }
      }
    } else {
      const p = this.edgeArrow(g, s, W, H, col, 16);
      g.fillStyle = col; g.font = '600 12px Rajdhani, sans-serif'; g.textAlign = 'center';
      g.fillText(`${(dist / 1000).toFixed(1)} km`, p.x - Math.sign(p.x - W / 2) * 30, p.y - Math.sign(p.y - H / 2) * 22);
      g.textAlign = 'left';
    }
  }

  leftPanel(g, b, W, H) {
    const P = b.player, x = 24, y = 24;
    g.fillStyle = 'rgba(5,15,12,0.45)'; g.fillRect(x - 8, y - 8, 236, b.pw.shieldMax ? 76 : 58);
    g.fillStyle = C; g.font = '700 13px Rajdhani, sans-serif'; g.fillText(P.name.toUpperCase(), x, y + 4);
    const f = Math.max(0, P.hp / P.maxHp);
    g.fillStyle = 'rgba(125,255,176,0.15)'; g.fillRect(x, y + 16, 220, 12);
    g.fillStyle = f > 0.5 ? C : f > 0.25 ? AMB : RED; g.fillRect(x, y + 16, 220 * f, 12);
    g.fillStyle = '#04110b'; g.font = '700 11px Rajdhani, sans-serif'; g.fillText(`HULL ${Math.ceil(f * 100)}%`, x + 4, y + 22);
    let yy = y + 36;
    if (b.pw.shieldMax) {
      const s = b.pw.shield / b.pw.shieldMax;
      g.fillStyle = 'rgba(80,180,255,0.15)'; g.fillRect(x, yy, 220, 8); g.fillStyle = '#5ab8ff'; g.fillRect(x, yy, 220 * s, 8);
      g.fillStyle = '#5ab8ff'; g.font = '600 10px Rajdhani'; g.fillText('SHIELD', x + 224 - 40, yy + 4); yy += 16;
    }
    g.fillStyle = C; g.font = '600 12px Rajdhani, sans-serif';
    g.fillText(`G ${P.g.toFixed(1)}   THR ${P.boost ? 'A/B' : Math.round(P.throttle * 100) + '%'}   T+${fmt(b.time)}`, x, yy + 4);
  }

  tapes(g, b, W, H) {
    const P = b.player, cy = H / 2;
    const spd = P.speed * 3.6, alt = P.pos.y;
    const agl = P.pos.y - b.world.groundAt(P.pos.x, P.pos.z);
    // speed tape
    const lx = W / 2 - Math.min(380, W * 0.3);
    g.strokeStyle = C; g.fillStyle = C; g.font = '600 12px Rajdhani, sans-serif'; g.textAlign = 'right';
    for (let k = -5; k <= 5; k++) {
      const v = Math.round(spd / 50) * 50 + k * 50, y = cy - (v - spd) * 1.6;
      if (y < cy - 110 || y > cy + 110 || v < 0) continue;
      g.globalAlpha = 1 - Math.abs(y - cy) / 120;
      g.beginPath(); g.moveTo(lx, y); g.lineTo(lx + 10, y); g.stroke(); g.fillText(v, lx - 4, y);
    }
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(5,15,12,0.75)'; g.fillRect(lx - 64, cy - 13, 70, 26); g.strokeRect(lx - 64, cy - 13, 70, 26);
    g.fillStyle = P.speed < 85 ? RED : C; g.font = '700 16px Rajdhani, sans-serif'; g.fillText(Math.round(spd), lx, cy);
    g.font = '600 10px Rajdhani'; g.fillStyle = CD; g.fillText('KM/H', lx, cy + 22);
    // altitude tape
    const rx = W / 2 + Math.min(380, W * 0.3);
    g.textAlign = 'left'; g.fillStyle = C; g.font = '600 12px Rajdhani, sans-serif';
    for (let k = -5; k <= 5; k++) {
      const v = Math.round(alt / 100) * 100 + k * 100, y = cy - (v - alt) * 0.8;
      if (y < cy - 110 || y > cy + 110) continue;
      g.globalAlpha = 1 - Math.abs(y - cy) / 120;
      g.beginPath(); g.moveTo(rx - 10, y); g.lineTo(rx, y); g.stroke(); g.fillText(v, rx + 4, y);
    }
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(5,15,12,0.75)'; g.fillRect(rx - 6, cy - 13, 76, 26); g.strokeRect(rx - 6, cy - 13, 76, 26);
    g.fillStyle = agl < 200 ? RED : C; g.font = '700 16px Rajdhani, sans-serif'; g.fillText(Math.round(alt), rx, cy);
    g.font = '600 10px Rajdhani'; g.fillStyle = CD; g.fillText(`AGL ${Math.round(agl)}`, rx, cy + 22);
  }

  compass(g, b, W, H) {
    const hd = ((b.player.heading() * 180 / Math.PI) + 360) % 360;
    const cx = W / 2, y = 26;
    g.strokeStyle = C; g.fillStyle = C; g.textAlign = 'center'; g.font = '600 11px Rajdhani, sans-serif';
    for (let d = -60; d <= 60; d += 5) {
      const v = Math.round(hd / 5) * 5 + d, x = cx + (v - hd) * 3.2;
      if (Math.abs(x - cx) > 190) continue;
      const vv = ((v % 360) + 360) % 360;
      g.globalAlpha = 1 - Math.abs(x - cx) / 200;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + (vv % 15 === 0 ? 8 : 4)); g.stroke();
      if (vv % 15 === 0) g.fillText({ 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[vv] || vv, x, y + 18);
    }
    g.globalAlpha = 1;
    g.beginPath(); g.moveTo(cx, y - 2); g.lineTo(cx - 5, y - 9); g.lineTo(cx + 5, y - 9); g.closePath(); g.fill();
    g.textAlign = 'left';
  }

  radar(g, b, W, H) {
    const P = b.player, R = 88, cx = 24 + R, cy = H - 24 - R;
    const range = Math.min(P.stats.radar, 8000);
    g.fillStyle = 'rgba(5,20,14,0.6)'; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
    g.strokeStyle = CD; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(cx, cy, R / 2, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(cx - R, cy); g.lineTo(cx + R, cy); g.moveTo(cx, cy - R); g.lineTo(cx, cy + R); g.stroke();
    // sweep
    const sw = (b.time * 2.2) % (Math.PI * 2);
    const grd = g.createConicGradient ? g.createConicGradient(sw - Math.PI / 2 - 0.6, cx, cy) : null;
    if (grd) { grd.addColorStop(0, 'rgba(125,255,176,0)'); grd.addColorStop(0.095, 'rgba(125,255,176,0.22)'); grd.addColorStop(0.1, 'rgba(125,255,176,0)'); g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill(); }
    const h = P.heading();
    // fix orientation: right of heading should be right on screen
    const blip = (p) => {
      const dx = p.x - P.pos.x, dz = p.z - P.pos.z;
      const f = { x: Math.sin(h), z: Math.cos(h) }, r = { x: -Math.cos(h), z: Math.sin(h) };
      const along = dx * f.x + dz * f.z, side = dx * r.x + dz * r.z;
      return { x: cx + side / range * R, y: cy - along / range * R, d: Math.hypot(dx, dz) };
    };
    const E = b.enemy;
    if (E.alive) {
      const det = P.stats.radar * (1 - E.stats.stealth * 0.45);
      const d = E.pos.distanceTo(P.pos);
      if (d < det || d < 2500) {
        let q = blip(E.pos);
        const k = Math.hypot(q.x - cx, q.y - cy);
        if (k > R - 4) { q.x = cx + (q.x - cx) / k * (R - 4); q.y = cy + (q.y - cy) / k * (R - 4); }
        const lk = b.locks.get(P);
        g.fillStyle = lk.locked ? RED : AMB;
        g.beginPath(); g.arc(q.x, q.y, 4.5, 0, Math.PI * 2); g.fill();
        // enemy heading tick
        const ef = E.fwd(_v);
        const along = ef.x * Math.sin(h) + ef.z * Math.cos(h), side = -ef.x * Math.cos(h) + ef.z * Math.sin(h);
        g.strokeStyle = g.fillStyle; g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x + side * 12, q.y - along * 12); g.stroke();
        const dy = E.pos.y - P.pos.y;
        g.font = '600 10px Rajdhani'; g.fillText(dy > 150 ? '▲' : dy < -150 ? '▼' : '', q.x + 7, q.y);
      } else {
        g.fillStyle = CD; g.font = '600 10px Rajdhani'; g.textAlign = 'center'; g.fillText('NO CONTACT', cx, cy + R - 14); g.textAlign = 'left';
      }
    }
    for (const m of b.missiles) {
      if (!m.alive) continue;
      const q = blip(m.pos); if (Math.hypot(q.x - cx, q.y - cy) > R) continue;
      g.fillStyle = m.owner === P ? '#ffffff' : RED; g.fillRect(q.x - 2, q.y - 2, 4, 4);
    }
    g.fillStyle = C; g.beginPath(); g.moveTo(cx, cy - 6); g.lineTo(cx + 5, cy + 5); g.lineTo(cx - 5, cy + 5); g.closePath(); g.fill();
    g.font = '600 10px Rajdhani'; g.fillStyle = CD; g.fillText(`${(range / 1000).toFixed(0)} KM`, cx + R - 30, cy - R + 8);
    // arena boundary hint
    const r = Math.hypot(P.pos.x, P.pos.z);
    if (r > b.arena - 2500) {
      const q = blip(new THREE.Vector3(0, 0, 0));
      g.strokeStyle = 'rgba(255,180,60,0.6)'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(cx, cy); g.lineTo(q.x, q.y); g.stroke(); g.setLineDash([]);
    }
  }

  jammed(g, W, H) {
    const R = 88, cx = 24 + R, cy = H - 24 - R;
    g.fillStyle = 'rgba(5,20,14,0.6)'; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(125,255,176,${Math.random() * 0.4})`; const a = Math.random() * 6.28, r = Math.random() * R; g.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2, 2); }
    g.fillStyle = AMB; g.font = '700 13px Rajdhani'; g.textAlign = 'center'; g.fillText('RADAR JAMMED', cx, cy); g.textAlign = 'left';
  }

  weapons(g, b, W, H) {
    const pw = b.pw, x = W - 250, y = H - 150;
    g.fillStyle = 'rgba(5,15,12,0.5)'; g.fillRect(x - 10, y - 12, 236, 138);
    g.font = '700 13px Rajdhani, sans-serif'; g.fillStyle = C;
    g.fillText('GUN  ' + pw.gun.name.toUpperCase(), x, y);
    g.fillStyle = 'rgba(125,255,176,0.15)'; g.fillRect(x, y + 10, 216, 6);
    g.fillStyle = pw.overheat ? RED : pw.heat > 0.7 ? AMB : C; g.fillRect(x, y + 10, 216 * Math.min(1, pw.heat), 6);
    g.font = '600 10px Rajdhani'; g.fillStyle = pw.overheat ? RED : CD; g.fillText(pw.overheat ? 'OVERHEAT' : 'HEAT', x + 178, y + 24);
    let yy = y + 40;
    if (b.rules.noMissiles) { g.fillStyle = AMB; g.font = '700 12px Rajdhani'; g.fillText('MISSILES DISABLED', x, yy); yy += 22; }
    else pw.missiles.forEach((m, i) => {
      const sel = i === pw.sel;
      g.fillStyle = sel ? C : CD; g.font = (sel ? '700 ' : '600 ') + '13px Rajdhani, sans-serif';
      g.fillText((sel ? '▶ ' : '   ') + m.name.toUpperCase(), x, yy);
      g.textAlign = 'right'; g.fillText(`x${m.ammo}`, x + 216, yy); g.textAlign = 'left';
      if (sel && m.cd > 0) { g.fillStyle = 'rgba(125,255,176,0.2)'; g.fillRect(x, yy + 9, 216, 3); g.fillStyle = C; g.fillRect(x, yy + 9, 216 * (1 - m.cd / m.reload), 3); }
      yy += 22;
    });
    g.fillStyle = b.player.flares > 0 ? C : RED; g.font = '600 13px Rajdhani, sans-serif';
    g.fillText(`FLARES  x${b.player.flares}`, x, yy + 4);
    const lk = b.locks.get(b.player);
    g.textAlign = 'right'; g.fillStyle = lk.locked ? RED : lk.progress > 0 ? AMB : CD;
    g.fillText(lk.locked ? 'LOCKED' : lk.progress > 0 ? `LOCKING ${Math.round(lk.progress * 100)}%` : lk.inCone ? 'SEEKING' : 'NO LOCK', x + 216, yy + 4);
    g.textAlign = 'left';
  }

  maneuvers(g, b, W, H) {
    const slots = b.pw.slots; if (!slots.length) return;
    const sz = 52, gap = 10, total = slots.length * (sz + gap) - gap;
    let x = W / 2 - total / 2; const y = H - sz - 22;
    slots.forEach((id, i) => {
      const m = MANEUVER_BY_ID[id], cd = b.pw.mcd[id], max = m.cd * b.cfg.loadout.cdMul;
      g.fillStyle = 'rgba(5,15,12,0.6)'; g.fillRect(x, y, sz, sz);
      g.strokeStyle = cd > 0 ? CD : C; g.strokeRect(x, y, sz, sz);
      if (cd > 0) { g.fillStyle = 'rgba(125,255,176,0.18)'; g.fillRect(x, y + sz * (1 - cd / max), sz, sz * cd / max); }
      g.fillStyle = cd > 0 ? CD : C; g.textAlign = 'center';
      g.font = '700 20px Rajdhani, sans-serif'; g.fillText(m.icon, x + sz / 2, y + sz / 2 - 4);
      g.font = '600 9px Rajdhani'; g.fillText(m.name.split(' ')[0].toUpperCase(), x + sz / 2, y + sz - 8);
      g.font = '700 11px Rajdhani'; g.fillText(String(i + 1), x + 8, y + 9);
      if (cd > 0) { g.font = '700 12px Rajdhani'; g.fillStyle = '#fff'; g.fillText(Math.ceil(cd), x + sz / 2, y + sz / 2 + 12); }
      g.textAlign = 'left';
      x += sz + gap;
    });
  }

  warnings(g, b, W, H) {
    const P = b.player, t = b.time;
    const list = [];
    const incoming = b.missilesTargeting(P);
    if (incoming.length) {
      const d = Math.min(...incoming.map(m => m.pos.distanceTo(P.pos)));
      list.push(['MISSILE  ' + (d / 1000).toFixed(1) + ' km', RED, (t * 6) % 1 < 0.6]);
    } else {
      const elk = b.locks.get(b.enemy);
      if (elk.progress > (b.cfg.loadout.earlyWarn ? 0.15 : 0.4)) list.push([elk.locked ? 'ENEMY LOCK' : 'LOCK WARNING', AMB, (t * 3) % 1 < 0.6]);
    }
    const ahead = P.pos.clone().addScaledVector(P.vel, 3);
    const gA = b.world.groundAt(ahead.x, ahead.z);
    if (ahead.y < gA + 60 || P.pos.y - b.world.groundAt(P.pos.x, P.pos.z) < 80) list.push(['PULL UP', RED, (t * 5) % 1 < 0.6]);
    if (P.stalled) list.push(['STALL', AMB, (t * 4) % 1 < 0.6]);
    const r = Math.hypot(P.pos.x, P.pos.z);
    if (r > b.arena - 800) list.push([r > b.arena ? `RETURN TO COMBAT AREA  ${b.oobT < 5 ? 'AUTOPILOT IN ' + Math.ceil(5 - b.oobT) : 'AUTOPILOT'}` : 'APPROACHING AREA LIMIT', AMB, true]);
    let y = H * 0.22;
    g.textAlign = 'center';
    for (const [txt, col, on] of list) {
      if (on) {
        g.font = '700 22px Rajdhani, sans-serif';
        const w = g.measureText(txt).width + 30;
        g.fillStyle = 'rgba(30,0,0,0.45)'; g.fillRect(W / 2 - w / 2, y - 16, w, 32);
        g.strokeStyle = col; g.lineWidth = 2; g.strokeRect(W / 2 - w / 2, y - 16, w, 32); g.lineWidth = 1.5;
        g.fillStyle = col; g.fillText(txt, W / 2, y + 1);
      }
      y += 40;
    }
    g.textAlign = 'left';
  }

  drawMessages(g, b, W, H) {
    let y = H - 175 - b.messages.length * 22;
    g.textAlign = 'center';
    for (const m of b.messages) {
      const a = Math.min(1, m.t / 0.4, (m.max - m.t) / 0.15 + 0.2);
      g.globalAlpha = clamp(a, 0, 1);
      g.font = m.big ? '700 30px Rajdhani, sans-serif' : '700 17px Rajdhani, sans-serif';
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillText(m.text, W / 2 + 2, y + 2);
      g.fillStyle = m.color; g.fillText(m.text, W / 2, y);
      y += m.big ? 38 : 24;
    }
    g.globalAlpha = 1; g.textAlign = 'left';
  }

  cockpit(g, b, cam, W, H) {
    const P = b.player;
    // pitch ladder
    const bank = P.bank(), pitch = P.pitchAngle();
    const pxPerRad = H / 2 / Math.tan(cam.fov * Math.PI / 360);
    g.save(); g.translate(W / 2, H / 2); g.rotate(-bank);
    g.strokeStyle = 'rgba(125,255,176,0.55)'; g.fillStyle = 'rgba(125,255,176,0.7)'; g.font = '600 11px Rajdhani';
    for (let d = -90; d <= 90; d += 10) {
      const y = (pitch - d * Math.PI / 180) * pxPerRad;
      if (Math.abs(y) > H * 0.4) continue;
      const w = d === 0 ? 260 : 90;
      if (d < 0) g.setLineDash([6, 5]);
      g.beginPath(); g.moveTo(-w, y); g.lineTo(-30, y); g.moveTo(30, y); g.lineTo(w, y); g.stroke(); g.setLineDash([]);
      if (d !== 0) { g.fillText(d, w + 6, y); g.fillText(d, -w - 22, y); }
    }
    g.restore();
    // canopy frame
    g.strokeStyle = 'rgba(20,24,28,0.95)'; g.lineWidth = 18;
    g.beginPath(); g.moveTo(W * 0.08, H); g.quadraticCurveTo(W * 0.18, H * 0.2, W * 0.5, -20); g.stroke();
    g.beginPath(); g.moveTo(W * 0.92, H); g.quadraticCurveTo(W * 0.82, H * 0.2, W * 0.5, -20); g.stroke();
    g.fillStyle = 'rgba(16,20,24,0.97)';
    g.beginPath(); g.moveTo(0, H); g.lineTo(0, H * 0.86); g.quadraticCurveTo(W / 2, H * 0.74, W, H * 0.86); g.lineTo(W, H); g.fill();
    g.lineWidth = 1.5;
  }
}

export function fmt(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m}:${String(s).padStart(2, '0')}`; }
