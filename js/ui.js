// Menu UI: main menu, hangar, shops, maneuvers, talents, missions, results.
import {
  AIRCRAFT, AIRCRAFT_BY_ID, UPGRADES, UPGRADE_MAX, upgradeCost, PAINTS, PAINT_BY_ID, GUNS, MISSILES, AVIONICS, MANEUVERS, MANEUVER_BY_ID,
  MANEUVER_SLOTS, TALENT_BRANCHES, TALENT_COST, xpForLevel, levelDef, THEATERS, CHALLENGES, ACHIEVEMENTS, ENEMY_PAINTS, STYLES, MISSILE_BY_ID,
  GUN_BY_ID, CAMPAIGN_LENGTH, rankFor, KMH, BOSSES,
} from './data.js';
import * as S from './save.js';
import { audio } from './audio.js';
import { fmt } from './hud.js';

const P = () => S.profile;
const cr = n => '¢' + Math.round(n).toLocaleString('en-US');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const stars = (n, max = 5) => '★'.repeat(n) + '<span class="dim">' + '★'.repeat(Math.max(0, max - n)) + '</span>';

export class UI {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById('ui');
    this.screen = 'main'; this.params = {};
    this.root.addEventListener('click', e => this.onClick(e));
    this.root.addEventListener('input', e => this.onInput(e));
    window.addEventListener('keydown', e => {
      if (!this.app.battle) return;
      if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); this.togglePause(); }
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.app.battle && !this.app.battle.paused && !this.app.battle.over) this.togglePause(); });
    this.go('main');
  }

  // ------------------------------------------------------------------ routing
  go(screen, params = {}) {
    this.screen = screen; this.params = params;
    this.render();
  }
  render() {
    const fn = this['scr_' + this.screen];
    this.root.innerHTML = fn ? fn.call(this, this.params) : '';
    this.root.className = 'ui-layer screen-' + this.screen;
    const sel = this.root.querySelector('.selected, .sel');
    if (sel && sel.scrollIntoView && this.screen !== 'main') sel.scrollIntoView({ block: 'nearest' });
  }
  toast(text, kind = 'ok') {
    const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = text;
    document.body.appendChild(t); setTimeout(() => t.classList.add('out'), 1800); setTimeout(() => t.remove(), 2400);
  }

  onInput(e) {
    const el = e.target;
    if (el.dataset.set) {
      const p = P(); const k = el.dataset.set;
      p.settings[k] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? parseFloat(el.value) : el.value;
      if (k === 'volume') audio.setVolume(p.settings.volume);
      S.save();
    }
  }

  onClick(e) {
    const el = e.target.closest('[data-a]'); if (!el) return;
    audio.init(); audio.setVolume(P().settings.volume);
    const d = el.dataset, a = d.a;
    const ok = (r, msg) => { if (r) { audio.buy(); msg && this.toast(msg); } else { audio.deny(); this.toast('Not enough credits or locked', 'bad'); } this.render(); };
    switch (a) {
      case 'go': audio.click(); this.go(d.s, d.p ? JSON.parse(d.p) : {}); break;
      case 'preview': audio.click(); this.params.preview = d.id; this.render(); break;
      case 'buyAc': ok(S.buyAircraft(d.id), 'Aircraft purchased!'); this.params.preview = d.id; this.render(); break;
      case 'selAc': audio.click(); S.selectAircraft(d.id); this.render(); break;
      case 'buyPaint': ok(S.buyPaint(d.id), 'Paint unlocked'); if (P().paints.includes(d.id)) S.applyPaint(this.params.preview || P().current, d.id); this.render(); break;
      case 'paint': audio.click(); S.applyPaint(d.ac, d.id); this.render(); break;
      case 'upgrade': ok(S.buyUpgrade(P().current, d.id), 'Upgrade installed'); break;
      case 'tab': audio.click(); this.params.tab = d.t; this.params.sel = null; this.render(); break;
      case 'buyItem': {
        const list = { guns: GUNS, missiles: MISSILES, avionics: AVIONICS }[d.k];
        const def = list.find(x => x.id === d.id);
        const r = S.buyItem(d.k, def);
        if (r) { if (d.k === 'guns') S.equip('gun', d.id); if (d.k === 'avionics') S.equip('avionics', d.id); if (d.k === 'missiles' && !P().loadout.secondary && P().loadout.primary !== d.id) S.equip('secondary', d.id); }
        ok(r, 'Purchased & equipped'); break;
      }
      case 'equip': audio.click(); S.equip(d.slot, d.id || null); this.render(); break;
      case 'buyMan': ok(S.buyManeuver(d.id), 'Maneuver learned'); break;
      case 'slot': audio.click(); this.params.slot = +d.i; this.render(); break;
      case 'setSlot': audio.click(); S.setSlot(this.params.slot ?? 0, d.id); this.render(); break;
      case 'clearSlot': audio.click(); P().slots[+d.i] = null; S.save(); this.render(); break;
      case 'talent': { const r = S.learnTalent(+d.b, +d.n); if (r) { audio.levelUp(); this.toast('Talent learned'); } else audio.deny(); this.render(); break; }
      case 'respec': ok(S.respecTalents(), 'Talents reset'); break;
      case 'mission': audio.click(); this.params.sel = +d.n; this.params.chal = null; this.render(); break;
      case 'chal': audio.click(); this.params.chal = d.id; this.render(); break;
      case 'launch': this.launch(d.kind, d.kind === 'campaign' ? +d.n : d.id); break;
      case 'quick': this.launch('campaign', P().campaign.unlocked); break;
      case 'reroll': ok(S.rerollContract(+d.i), 'Contract replaced'); break;
      case 'resume': this.togglePause(); break;
      case 'restart': this.app.endBattle(); this.launch(this.lastLaunch.kind, this.lastLaunch.id); break;
      case 'abort': this.app.endBattle(); this.go('missions'); break;
      case 'retry': this.launch(this.lastLaunch.kind, this.lastLaunch.id); break;
      case 'next': this.launch('campaign', P().campaign.unlocked); break;
      case 'reset': if (confirm('Erase ALL progress and start over?')) { S.resetProfile(); this.toast('Progress reset'); this.go('main'); } break;
      case 'cam': audio.click(); P().settings.camera = d.v; S.save(); this.render(); break;
      case 'quality': audio.click(); P().settings.quality = d.v; S.save(); this.render(); break;
    }
  }

  // ------------------------------------------------------------------ common pieces
  topbar(title) {
    const p = P();
    return `<header class="topbar">
      <button class="back" data-a="go" data-s="main">◀ MENU</button>
      <h2>${title}</h2>
      <div class="tb-stats"><span class="lvl">LV ${p.level}</span><span class="sp ${p.skillPoints ? 'hot' : ''}">${p.skillPoints} SP</span><span class="cr">${cr(p.credits)}</span></div>
    </header>`;
  }
  pilotCard() {
    const p = P(); const need = xpForLevel(p.level);
    return `<div class="pilot-card">
      <div class="pc-rank">${rankFor(p.level)}</div>
      <div class="pc-lvl">LEVEL <b>${p.level}</b></div>
      <div class="xpbar"><i style="width:${Math.min(100, p.xp / need * 100)}%"></i></div>
      <div class="pc-xp">${p.xp.toLocaleString()} / ${need.toLocaleString()} XP</div>
      <div class="pc-cr">${cr(p.credits)}</div>
      ${p.skillPoints ? `<div class="pc-sp" data-a="go" data-s="pilot">${p.skillPoints} unspent skill point${p.skillPoints > 1 ? 's' : ''} ▸</div>` : ''}
    </div>`;
  }
  setJetCurrent(offset = -0.35) {
    const p = P(); const ac = AIRCRAFT_BY_ID[p.current];
    this.app.setShowJet(ac.design, PAINT_BY_ID[p.owned[p.current].paint]);
    this.app.showOffset = offset;
  }

  // ------------------------------------------------------------------ MAIN MENU
  scr_main() {
    const p = P(); this.setJetCurrent(-0.42);
    const n = p.campaign.unlocked; const L = levelDef(n);
    const unread = p.skillPoints > 0;
    return `<div class="main-menu">
      <div class="logo"><div class="logo-top">SKY</div><div class="logo-bot">DOMINANCE</div><div class="logo-tag">ONE-ON-ONE AIR COMBAT</div></div>
      ${this.pilotCard()}
      <nav class="main-nav">
        <button class="btn primary big" data-a="quick">▶ LAUNCH: ${esc(L.name)}<small>${L.boss ? 'BOSS — ' + esc(L.enemy.name) : esc(L.enemy.name)} · ${cr(L.credits)}</small></button>
        <button class="btn" data-a="go" data-s="missions">MISSION SELECT</button>
        <button class="btn" data-a="go" data-s="hangar">HANGAR</button>
        <button class="btn" data-a="go" data-s="upgrades">UPGRADES</button>
        <button class="btn" data-a="go" data-s="armory">ARMORY</button>
        <button class="btn" data-a="go" data-s="maneuvers">MANEUVERS</button>
        <button class="btn ${unread ? 'notify' : ''}" data-a="go" data-s="pilot">PILOT &amp; TALENTS</button>
        <button class="btn" data-a="go" data-s="missions" data-p='{"tab":"contracts"}'>CONTRACTS &amp; ACHIEVEMENTS</button>
        <div class="row2"><button class="btn small" data-a="go" data-s="settings">SETTINGS</button><button class="btn small" data-a="go" data-s="help">HOW TO PLAY</button></div>
      </nav>
      <div class="main-side">
        <div class="panel mini">
          <h4>ACTIVE CONTRACTS</h4>
          ${p.contracts.map(c => `<div class="contract-mini"><span>${esc(c.text)}</span><b>${c.progress}/${c.target}</b><div class="pbar"><i style="width:${c.progress / c.target * 100}%"></i></div></div>`).join('')}
        </div>
        <div class="panel mini current-ac">
          <h4>CURRENT AIRCRAFT</h4>
          <div class="cac-name">${esc(AIRCRAFT_BY_ID[p.current].name)}</div>
          <div class="cac-role">${esc(AIRCRAFT_BY_ID[p.current].role)}</div>
          <div class="cac-load">${esc(GUN_BY_ID[p.loadout.gun].name)} · ${esc(MISSILE_BY_ID[p.loadout.primary].name)}${p.loadout.secondary ? ' · ' + esc(MISSILE_BY_ID[p.loadout.secondary].name) : ''}</div>
        </div>
      </div>
    </div>`;
  }

  // ------------------------------------------------------------------ HANGAR
  scr_hangar(pr) {
    const p = P();
    const id = pr.preview || p.current; const ac = AIRCRAFT_BY_ID[id];
    const owned = !!p.owned[id];
    const paint = owned ? PAINT_BY_ID[p.owned[id].paint] : PAINT_BY_ID.standard;
    this.app.setShowJet(ac.design, paint); this.app.showOffset = 0;
    const st = S.aircraftStats(id), cur = S.aircraftStats(p.current);
    const bars = S.statBars(st), cbars = S.statBars(cur);
    const locked = p.level < ac.level;
    let action;
    if (owned) action = p.current === id ? `<button class="btn primary" disabled>✔ IN SERVICE</button>` : `<button class="btn primary" data-a="selAc" data-id="${id}">SELECT AIRCRAFT</button>`;
    else if (locked) action = `<button class="btn" disabled>🔒 REQUIRES LEVEL ${ac.level}</button>`;
    else action = `<button class="btn primary ${p.credits < ac.price ? 'cant' : ''}" data-a="buyAc" data-id="${id}">BUY — ${cr(ac.price)}</button>`;
    return `${this.topbar('HANGAR')}
    <div class="hangar">
      <aside class="ac-list panel">
        ${AIRCRAFT.map(a => {
          const o = !!p.owned[a.id], lk = p.level < a.level;
          return `<div class="ac-card ${a.id === id ? 'selected' : ''} ${o ? 'owned' : ''} ${lk ? 'locked' : ''}" data-a="preview" data-id="${a.id}">
            <div class="acc-tier">T${a.tier}</div>
            <div class="acc-name">${esc(a.name)}</div>
            <div class="acc-role">${esc(a.role)}</div>
            <div class="acc-price">${o ? (p.current === a.id ? '<span class="tag green">ACTIVE</span>' : '<span class="tag">OWNED</span>') : lk ? `🔒 LV ${a.level}` : cr(a.price)}</div>
          </div>`;
        }).join('')}
      </aside>
      <section class="ac-detail panel">
        <div class="acd-head"><h3>${esc(ac.name)}</h3><div class="acd-role">${esc(ac.role)} · Tier ${ac.tier}</div></div>
        <p class="desc">${esc(ac.desc)}</p>
        <div class="stats">
          ${bars.map((b, i) => {
            const [name, val, max, unit, dec] = b; const cv = cbars[i][1];
            const diff = val - cv; const pct = Math.min(100, val / max * 100), cpct = Math.min(100, cv / max * 100);
            return `<div class="stat"><span class="sn">${name}</span>
              <div class="sbar"><i class="cur" style="width:${cpct}%"></i><i class="val ${diff > 0.001 ? 'up' : diff < -0.001 ? 'down' : ''}" style="width:${pct}%"></i></div>
              <span class="sv">${val.toFixed(dec)}<small>${unit}</small>${id !== p.current && Math.abs(diff) > 0.001 ? `<em class="${diff > 0 ? 'up' : 'down'}">${diff > 0 ? '+' : ''}${diff.toFixed(dec)}</em>` : ''}</span></div>`;
          }).join('')}
        </div>
        <div class="proscons"><ul class="pros">${ac.pros.map(x => `<li>${esc(x)}</li>`).join('')}</ul><ul class="cons">${ac.cons.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
        <div class="acd-extra">Flares: <b>${st.flares}</b> · Missile slots: <b>${st.missiles}</b> · Corner speed: <b>${Math.round(ac.corner * KMH)} km/h</b></div>
        <div class="acd-action">${action}</div>
        ${owned ? `<h4>PAINT SCHEMES</h4><div class="paints">${PAINTS.map(pt => {
          const has = p.paints.includes(pt.id), lk = p.level < pt.level, on = p.owned[id].paint === pt.id;
          return `<div class="swatch ${on ? 'on' : ''} ${lk ? 'locked' : ''}" title="${esc(pt.name)}" data-a="${has ? 'paint' : lk ? '' : 'buyPaint'}" data-id="${pt.id}" data-ac="${id}">
            <i style="background:linear-gradient(135deg, ${pt.base} 0 55%, ${pt.second} 55% 85%, ${pt.accent} 85%)"></i>
            <span>${esc(pt.name)}</span><small>${has ? (on ? 'APPLIED' : 'OWNED') : lk ? 'LV ' + pt.level : cr(pt.price)}</small></div>`;
        }).join('')}</div>` : ''}
      </section>
    </div>`;
  }

  // ------------------------------------------------------------------ UPGRADES
  scr_upgrades() {
    const p = P(); const ac = AIRCRAFT_BY_ID[p.current]; this.setJetCurrent(-0.3);
    const own = p.owned[p.current];
    const st = S.aircraftStats(p.current);
    const show = {
      speed: () => `${Math.round(st.speed * KMH)} km/h`, accel: () => `${st.thrust.toFixed(0)} m/s²`, agility: () => `${(st.pitch * 57.3).toFixed(0)}°/s pitch`,
      armor: () => `${Math.round(st.hp)} HP`, radar: () => `${(st.radar / 1000).toFixed(1)} km`, weapons: () => `+${Math.round((st.dmgMul - 1) * 100)}% dmg`,
    };
    return `${this.topbar('UPGRADES — ' + esc(ac.name))}
    <div class="upgrades panel">
      <p class="hint">Upgrades are installed on your <b>current aircraft</b>. Switch aircraft in the Hangar. Costs scale with aircraft tier.</p>
      ${UPGRADES.map(u => {
        const lvl = own.up[u.id] || 0; const max = lvl >= UPGRADE_MAX; const cost = max ? 0 : upgradeCost(ac, lvl);
        return `<div class="up-row">
          <div class="up-name"><b>${u.name}</b><small>${u.desc}</small></div>
          <div class="pips">${Array.from({ length: UPGRADE_MAX }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>
          <div class="up-val">${show[u.id]()}</div>
          ${max ? '<button class="btn" disabled>MAXED</button>' : `<button class="btn primary ${p.credits < cost ? 'cant' : ''}" data-a="upgrade" data-id="${u.id}">UPGRADE ${cr(cost)}</button>`}
        </div>`;
      }).join('')}
    </div>`;
  }

  // ------------------------------------------------------------------ ARMORY
  scr_armory(pr) {
    const p = P(); this.setJetCurrent(-0.42);
    const tab = pr.tab || 'missiles';
    const L = p.loadout;
    const lo = S.battleLoadout();
    let body = '';
    const lock = d => p.level < d.level;
    const card = (d, kind, statsHtml, equipHtml) => {
      const has = p[kind].includes(d.id);
      return `<div class="item ${has ? 'owned' : ''} ${lock(d) ? 'locked' : ''}">
        <div class="it-head"><b>${esc(d.name)}</b>${d.type ? `<span class="it-type">${esc(d.type)}</span>` : ''}</div>
        <p>${esc(d.desc)}</p>
        <div class="it-stats">${statsHtml}</div>
        <div class="it-act">${has ? equipHtml : lock(d) ? `<button class="btn" disabled>🔒 LEVEL ${d.level}</button>` : `<button class="btn primary ${p.credits < d.price ? 'cant' : ''}" data-a="buyItem" data-k="${kind}" data-id="${d.id}">BUY ${cr(d.price)}</button>`}</div>
      </div>`;
    };
    const sb = (label, v, max, txt) => `<div class="mini-stat"><span>${label}</span><div class="sbar"><i class="val" style="width:${Math.min(100, v / max * 100)}%"></i></div><em>${txt}</em></div>`;
    if (tab === 'guns') {
      body = GUNS.map(g => card(g, 'guns',
        sb('Damage/s', g.dmg * g.rof, 180, Math.round(g.dmg * g.rof)) + sb('Range', g.range, 2400, g.range + 'm') + sb('Muzzle vel.', g.speed, 4000, g.speed + 'm/s') + sb('Accuracy', 1 / g.spread, 1300, (100 - g.spread * 5000).toFixed(0) + '%') + sb('Heat/shot', g.heat, 0.025, (g.heat * 100).toFixed(1) + '%'),
        L.gun === g.id ? '<button class="btn" disabled>✔ EQUIPPED</button>' : `<button class="btn primary" data-a="equip" data-slot="gun" data-id="${g.id}">EQUIP</button>`)).join('');
    } else if (tab === 'missiles') {
      body = MISSILES.map(m => card(m, 'missiles',
        sb('Damage', m.dmg * m.count, 100, Math.round(m.dmg) + (m.count > 1 ? '×' + m.count : '')) + sb('Range', m.range, 7000, (m.range / 1000).toFixed(1) + 'km') + sb('Speed', m.speed, 1400, Math.round(m.speed * KMH) + 'km/h') +
        sb('Tracking', m.turn, 3.8, (m.turn * 57.3).toFixed(0) + '°/s') + sb('Lock time', 1 / m.lock, 1 / 1.0, m.lock.toFixed(1) + 's') + sb('Reload', 1 / m.reload, 1 / 1.0, m.reload.toFixed(1) + 's') + sb('Anti-flare', m.cm, 1, Math.round(m.cm * 100) + '%') +
        `<div class="mini-tags"><span>${m.seeker.toUpperCase()} SEEKER</span><span>WEIGHT ${m.weight}</span><span>CONE ${(m.fov * 57.3).toFixed(0)}°</span></div>`,
        `${L.primary === m.id ? '<button class="btn" disabled>✔ PRIMARY</button>' : `<button class="btn primary" data-a="equip" data-slot="primary" data-id="${m.id}">SET PRIMARY</button>`}
         ${L.secondary === m.id ? `<button class="btn" data-a="equip" data-slot="secondary" data-id="">UNEQUIP SECONDARY</button>` : `<button class="btn" data-a="equip" data-slot="secondary" data-id="${m.id}">SET SECONDARY</button>`}`)).join('');
    } else {
      body = AVIONICS.map(a => card(a, 'avionics',
        sb('Lock speed', 1 / a.lockMul, 1 / 0.6, `-${Math.round((1 - a.lockMul) * 100)}%`) + sb('Anti-flare', a.cm, 0.4, `+${Math.round(a.cm * 100)}%`) + sb('Seeker cone', a.fovMul, 1.5, `×${a.fovMul}`) + sb('Missile agility', a.turnMul, 1.22, `×${a.turnMul}`),
        L.avionics === a.id ? '<button class="btn" disabled>✔ INSTALLED</button>' : `<button class="btn primary" data-a="equip" data-slot="avionics" data-id="${a.id}">INSTALL</button>`)).join('');
    }
    return `${this.topbar('ARMORY')}
    <div class="armory">
      <div class="tabs">${[['missiles', 'MISSILES'], ['guns', 'GUNS & CANNONS'], ['avionics', 'TRACKING SYSTEMS']].map(([k, n]) => `<button class="tab ${tab === k ? 'on' : ''}" data-a="tab" data-t="${k}">${n}</button>`).join('')}</div>
      <div class="loadout-bar panel">
        <div><small>GUN</small><b>${esc(lo.gun.name)}</b></div>
        ${lo.missiles.map((m, i) => `<div><small>${i ? 'SECONDARY' : 'PRIMARY'}</small><b>${esc(m.name)} ×${m.ammo}</b></div>`).join('')}
        <div><small>TRACKING</small><b>${esc(lo.avionics.name)}</b></div>
        <div><small>CAPACITY</small><b>${lo.stats.missiles} slots</b></div>
      </div>
      <div class="items">${body}</div>
    </div>`;
  }

  // ------------------------------------------------------------------ MANEUVERS
  scr_maneuvers(pr) {
    const p = P(); this.setJetCurrent(-0.42);
    const slot = pr.slot ?? 0;
    const ac = AIRCRAFT_BY_ID[p.current];
    const cdMul = S.battleLoadout().cdMul;
    return `${this.topbar('MANEUVERS')}
    <div class="maneuvers">
      <div class="slots panel">
        <h4>EQUIPPED (KEYS 1–${MANEUVER_SLOTS})</h4>
        <div class="slot-row">${p.slots.map((id, i) => `<div class="mslot ${i === slot ? 'sel' : ''}" data-a="slot" data-i="${i}">
          <kbd>${i + 1}</kbd>${id ? `<b>${MANEUVER_BY_ID[id].icon}</b><span>${esc(MANEUVER_BY_ID[id].name)}</span><a class="x" data-a="clearSlot" data-i="${i}">✕</a>` : '<span class="empty">EMPTY</span>'}</div>`).join('')}</div>
        <p class="hint">Select a slot, then equip a learned maneuver into it. ${ac.traits.includes('tv') ? '<b class="green">Thrust vectoring: cooldowns -35%.</b>' : ''}</p>
      </div>
      <div class="items">${MANEUVERS.map(m => {
        const has = p.maneuvers.includes(m.id), lk = p.level < m.level, eq = p.slots.includes(m.id);
        return `<div class="item man ${has ? 'owned' : ''} ${lk ? 'locked' : ''}">
          <div class="it-head"><span class="m-icon">${m.icon}</span><b>${esc(m.name)}</b><span class="it-type">CD ${(m.cd * cdMul).toFixed(0)}s</span></div>
          <p>${esc(m.desc)}</p>
          <div class="it-act">${has ? (eq ? `<button class="btn" disabled>✔ SLOT ${p.slots.indexOf(m.id) + 1}</button>` : `<button class="btn primary" data-a="setSlot" data-id="${m.id}">EQUIP TO SLOT ${slot + 1}</button>`)
            : lk ? `<button class="btn" disabled>🔒 LEVEL ${m.level}</button>` : `<button class="btn primary ${p.credits < m.price ? 'cant' : ''}" data-a="buyMan" data-id="${m.id}">LEARN ${cr(m.price)}</button>`}</div>
        </div>`;
      }).join('')}</div>
    </div>`;
  }

  // ------------------------------------------------------------------ PILOT
  scr_pilot() {
    const p = P(); this.setJetCurrent(-0.5); const s = p.stats;
    const acc = s.shotsFired ? (s.shotsHit / s.shotsFired * 100).toFixed(1) + '%' : '—';
    const macc = s.missilesFired ? (s.missileHits / s.missilesFired * 100).toFixed(0) + '%' : '—';
    return `${this.topbar('PILOT PROFILE')}
    <div class="pilot">
      <section class="panel talents">
        <div class="t-head"><h3>TALENT TREE</h3><div><b class="${p.skillPoints ? 'green' : ''}">${p.skillPoints}</b> skill points · earn 1 per level (2 every 5th level)</div>
          <button class="btn small" data-a="respec">RESET (${cr(S.respecCost())})</button></div>
        <div class="branches">${TALENT_BRANCHES.map((b, bi) => `<div class="branch" style="--bc:${b.color}"><h4>${b.name}</h4>
          ${b.nodes.map((n, ni) => {
            const has = !!p.talents[n.id]; const can = S.canLearnTalent(bi, ni);
            const prev = ni === 0 || p.talents[b.nodes[ni - 1].id];
            return `<div class="tnode ${has ? 'on' : can ? 'can' : prev ? 'next' : 'locked'}" data-a="${has ? '' : 'talent'}" data-b="${bi}" data-n="${ni}">
              <div class="tn-name">${esc(n.name)}<span>${has ? '✔' : TALENT_COST[ni] + ' SP'}</span></div><div class="tn-desc">${esc(n.desc)}</div></div>`;
          }).join('<div class="tlink"></div>')}</div>`).join('')}</div>
      </section>
      <section class="panel pstats">
        ${this.pilotCard()}
        <table>
          ${[['Battles', s.battles], ['Victories', s.wins], ['Defeats', s.losses], ['Win rate', s.battles ? Math.round(s.wins / s.battles * 100) + '%' : '—'], ['Kills', s.kills], ['Gun kills', s.gunKills],
            ['Gun accuracy', acc], ['Missiles fired', s.missilesFired], ['Missile hit rate', macc], ['Missiles evaded', s.evades], ['Flare decoys', s.flareDecoys], ['Maneuvers used', s.maneuversUsed],
            ['Damage dealt', Math.round(s.damageDealt)], ['Damage taken', Math.round(s.damageTaken)], ['Flight time', fmt(s.flightTime)], ['Fastest win', s.bestTime ? fmt(s.bestTime) : '—'],
            ['Credits earned', cr(s.creditsEarned)], ['Campaign', `${p.campaign.cleared}/${CAMPAIGN_LENGTH}`], ['Bosses defeated', `${Object.keys(p.bosses).length}/6`], ['Achievements', `${Object.keys(p.achievements).length}/${ACHIEVEMENTS.length}`]]
            .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}
        </table>
      </section>
    </div>`;
  }

  // ------------------------------------------------------------------ MISSIONS
  threat(enemy) {
    const lo = S.battleLoadout();
    const mine = lo.stats.speed / 250 + lo.stats.pitch * 1.2 + lo.stats.hp / 110 + lo.stats.thrust / 50 + (lo.missiles[0]?.dmg || 30) / 45;
    const theirs = enemy.speed / 250 + enemy.pitch * 1.2 + enemy.hp / 110 + enemy.thrust / 50 + 0.8 + enemy.skill * 2.4;
    const r = theirs / mine;
    if (r < 0.95) return ['LOW', 'green'];
    if (r < 1.15) return ['MODERATE', 'amber'];
    if (r < 1.4) return ['HIGH', 'orange'];
    return ['EXTREME', 'red'];
  }

  briefing(L) {
    const e = L.enemy, p = P();
    const replay = L.n < p.campaign.unlocked;
    const [tl, tc] = this.threat(e);
    const skill = Math.max(1, Math.round(e.skill * 5));
    const md = MISSILE_BY_ID[e.missile];
    this.app.setShowJet(e.design, ENEMY_PAINTS[e.paint] || ENEMY_PAINTS.red, Math.min(1.3, e.scale || 1));
    this.app.showOffset = -0.5;
    const stars_ = p.campaign.stars[L.n] || 0;
    return `<div class="briefing panel ${L.boss ? 'boss' : L.elite ? 'elite' : ''}">
      <div class="br-tag">${L.boss ? 'BOSS ENCOUNTER' : L.elite ? 'ELITE PILOT' : 'MISSION BRIEFING'}</div>
      <h3>${esc(L.name)}</h3>
      <div class="br-theater">${esc(L.theater.name)} — ${esc(L.theater.desc)}</div>
      <div class="br-enemy"><div class="br-ename">${esc(e.name)}</div><div class="br-etitle">${esc(e.title || '')}</div></div>
      ${e.intro ? `<p class="br-intro">${esc(e.intro)}</p>` : ''}
      <div class="br-grid">
        <div><small>PILOT SKILL</small><b class="stars">${stars(skill)}</b></div>
        <div><small>TACTICS</small><b>${esc(STYLES[e.style]?.name || e.style)}</b></div>
        <div><small>THREAT</small><b class="${tc}">${tl}</b></div>
        <div><small>HULL</small><b>${e.hp} HP</b></div>
        <div><small>TOP SPEED</small><b>${Math.round(e.speed * KMH)} km/h</b></div>
        <div><small>MISSILES</small><b>${esc(md.name)}${e.salvo > 1 ? ' ×' + e.salvo : ''}</b></div>
        <div><small>COUNTERMEASURES</small><b>${e.flares ? e.flares + ' flares' : 'None'}</b></div>
        <div><small>STEALTH</small><b>${Math.round((e.stealth || 0) * 100)}%</b></div>
      </div>
      <div class="br-rewards"><span>REWARD</span><b>${cr(L.credits * (replay ? 0.6 : 1))}</b><b>${Math.round(L.xp * (replay ? 0.6 : 1))} XP</b>${replay ? '<em>replay ×0.6</em>' : ''}<span class="br-stars">${stars(stars_, 3)}</span></div>
      <button class="btn primary big" data-a="launch" data-kind="campaign" data-n="${L.n}">▶ LAUNCH SORTIE</button>
    </div>`;
  }

  scr_missions(pr) {
    const p = P(); const tab = pr.tab || 'campaign';
    let body = '';
    if (tab === 'campaign') {
      const sel = pr.sel || Math.min(p.campaign.unlocked, Math.max(CAMPAIGN_LENGTH, p.campaign.unlocked));
      const maxN = Math.max(CAMPAIGN_LENGTH, p.campaign.unlocked);
      const nodes = [];
      THEATERS.forEach((t, ti) => {
        nodes.push(`<div class="theater"><div class="th-name">${ti + 1}. ${esc(t.name)}<small>${esc(t.weather)} · ${esc(t.biome)}</small></div><div class="th-nodes">`);
        for (let k = 1; k <= 5; k++) {
          const n = ti * 5 + k; const unlocked = n <= p.campaign.unlocked; const cleared = n < p.campaign.unlocked;
          const boss = !!BOSSES[n], elite = !boss && (k === 3 && n > 6);
          nodes.push(`<div class="node ${unlocked ? '' : 'locked'} ${cleared ? 'cleared' : ''} ${boss ? 'boss' : ''} ${elite ? 'elite' : ''} ${sel === n ? 'selected' : ''}" ${unlocked ? `data-a="mission" data-n="${n}"` : ''}>
            <span>${boss ? '☠' : n}</span>${cleared ? `<i>${'★'.repeat(p.campaign.stars[n] || 1)}</i>` : ''}</div>`);
        }
        nodes.push('</div></div>');
      });
      if (p.campaign.unlocked > CAMPAIGN_LENGTH) {
        nodes.push(`<div class="theater"><div class="th-name">∞ Endless Sorties<small>escalating difficulty</small></div><div class="th-nodes">`);
        for (let n = CAMPAIGN_LENGTH + 1; n <= maxN; n++) if (n > maxN - 5) nodes.push(`<div class="node ${sel === n ? 'selected' : ''} ${n < p.campaign.unlocked ? 'cleared' : ''}" data-a="mission" data-n="${n}"><span>${n - CAMPAIGN_LENGTH}</span></div>`);
        nodes.push('</div></div>');
      }
      body = `<div class="campaign"><div class="map panel">${nodes.join('')}</div>${this.briefing(levelDef(Math.min(sel, p.campaign.unlocked)))}</div>`;
    } else if (tab === 'challenges') {
      const sel = pr.chal ? CHALLENGES.find(c => c.id === pr.chal) : null;
      if (!sel) this.setJetCurrent(-0.4);
      body = `<div class="chal-wrap"><div class="items">${CHALLENGES.map(c => {
        const lk = p.level < c.level, done = !!p.challenges[c.id];
        return `<div class="item chal ${lk ? 'locked' : ''} ${done ? 'owned' : ''} ${pr.chal === c.id ? 'selected' : ''}">
          <div class="it-head"><b>${esc(c.name)}</b><span class="it-type">${done ? '✔ COMPLETE' : lk ? '🔒 LV ' + c.level : 'SPECIAL'}</span></div>
          <p>${esc(c.desc)}</p>
          <div class="it-stats"><div class="mini-tags"><span>${cr(c.credits * (done ? 0.3 : 1))}</span><span>${Math.round(c.xp * (done ? 0.3 : 1))} XP</span><span>${esc(THEATERS[c.theater].name)}</span></div></div>
          <div class="it-act">${lk ? '' : `<button class="btn primary" data-a="launch" data-kind="challenge" data-id="${c.id}">▶ LAUNCH</button>`}</div>
        </div>`;
      }).join('')}</div></div>`;
    } else if (tab === 'contracts') {
      this.setJetCurrent(-0.45);
      body = `<div class="contracts">
        <section class="panel"><h3>ACTIVE CONTRACTS</h3><p class="hint">Contracts progress across any battle. Completing one pays out immediately and a new contract arrives.</p>
          ${p.contracts.map((c, i) => `<div class="contract"><div><b>${esc(c.text)}</b><small>${cr(c.credits)} · ${c.xp} XP</small></div>
            <div class="pbar"><i style="width:${c.progress / c.target * 100}%"></i></div><span>${c.progress}/${c.target}</span>
            <button class="btn small" data-a="reroll" data-i="${i}">REPLACE ${cr(S.rerollCost())}</button></div>`).join('')}
        </section>
        <section class="panel"><h3>ACHIEVEMENTS <small>${Object.keys(p.achievements).length}/${ACHIEVEMENTS.length}</small></h3>
          <div class="achs">${ACHIEVEMENTS.map(a => `<div class="ach ${p.achievements[a.id] ? 'on' : ''}"><b>${p.achievements[a.id] ? '🏆' : '◇'} ${esc(a.name)}</b><span>${esc(a.desc)}</span><small>${cr(a.credits)}</small></div>`).join('')}</div>
        </section></div>`;
    }
    return `${this.topbar('OPERATIONS')}
    <div class="missions">
      <div class="tabs">${[['campaign', 'CAMPAIGN'], ['challenges', 'SPECIAL CHALLENGES'], ['contracts', 'CONTRACTS & ACHIEVEMENTS']].map(([k, n]) => `<button class="tab ${tab === k ? 'on' : ''}" data-a="go" data-s="missions" data-p='{"tab":"${k}"}'>${n}</button>`).join('')}</div>
      ${body}
    </div>`;
  }

  // ------------------------------------------------------------------ SETTINGS / HELP
  scr_settings() {
    const s = P().settings; this.setJetCurrent(-0.45);
    return `${this.topbar('SETTINGS')}
    <div class="settings panel">
      <label class="set"><span>Invert pitch (W = pull up)</span><input type="checkbox" data-set="invert" ${s.invert ? 'checked' : ''}></label>
      <label class="set"><span>Flight assist (auto-level wings when idle)</span><input type="checkbox" data-set="assist" ${s.assist ? 'checked' : ''}></label>
      <label class="set"><span>Master volume</span><input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-set="volume"></label>
      <div class="set"><span>Default camera</span><div class="seg">${['chase', 'cockpit'].map(v => `<button class="${s.camera === v ? 'on' : ''}" data-a="cam" data-v="${v}">${v.toUpperCase()}</button>`).join('')}</div></div>
      <div class="set"><span>Graphics quality (applies next battle)</span><div class="seg">${['low', 'high'].map(v => `<button class="${s.quality === v ? 'on' : ''}" data-a="quality" data-v="${v}">${v.toUpperCase()}</button>`).join('')}</div></div>
      <div class="set danger"><span>Reset all progress</span><button class="btn small" data-a="reset">RESET</button></div>
    </div>`;
  }

  scr_help() {
    this.setJetCurrent(-0.5);
    const k = (keys, what) => `<tr><td>${keys.split(' ').map(x => `<kbd>${x}</kbd>`).join(' ')}</td><td>${what}</td></tr>`;
    return `${this.topbar('HOW TO PLAY')}
    <div class="help">
      <section class="panel"><h3>FLIGHT CONTROLS</h3><table>
        ${k('W S', 'Pitch (S pulls the nose up) — or ↑ ↓')}${k('A D', 'Roll — or ← →')}${k('Q E', 'Rudder / yaw')}
        ${k('Shift', 'Afterburner')}${k('X', 'Air brake')}${k('V', 'Toggle chase / cockpit camera')}${k('C', 'Hold: look at enemy')}${k('Esc', 'Pause')}
      </table>
      <h3>WEAPONS</h3><table>
        ${k('Space', 'Fire gun (or left mouse)')}${k('F', 'Fire missile (or right mouse)')}${k('R', 'Switch missile type')}${k('G', 'Deploy flares / chaff')}${k('1 2 3 4', 'Special maneuvers')}
      </table><p class="hint">Gamepad supported: left stick fly, right stick yaw, RT gun, A missile, LB flares, RB afterburner, LT brake, Y switch, X camera, D-pad maneuvers.</p></section>
      <section class="panel"><h3>COMBAT TIPS</h3><ul class="tips">
        <li><b>Lock on:</b> keep the enemy inside the dashed seeker circle. The lock ring shrinks; when it turns <span class="red">red</span>, fire.</li>
        <li><b>Guns:</b> put the gun cross on the white lead circle (pipper). Bursts — the cannon overheats.</li>
        <li><b>Missile warning:</b> turn hard <i>perpendicular</i> to the missile, then pop flares when it is close (≈1 km). Radar missiles resist flares — use maneuvers.</li>
        <li><b>Energy:</b> hard turns bleed speed. Below corner speed you turn slower; too slow and you stall. Use afterburner to recover.</li>
        <li><b>Maneuvers:</b> Cobra makes chasers overshoot, Split-S trades altitude for speed, Emergency Break defeats almost any missile.</li>
        <li><b>Enemy AI</b> adapts during the battle: spam missiles and it will flare earlier; camp its six and it switches tactics.</li>
        <li><b>Progress:</b> win to earn credits and XP. Buy jets, weapons and upgrades; spend skill points in the talent tree.</li>
      </ul></section>
    </div>`;
  }

  // ------------------------------------------------------------------ BATTLE
  buildCfg(kind, id) {
    const p = P(); const lo = S.battleLoadout();
    const base = { loadout: lo, settings: { ...p.settings }, onEnd: sum => this.onBattleEnd(sum) };
    if (kind === 'campaign') {
      const L = levelDef(id);
      return { ...base, kind, level: id, theater: L.theater, enemy: L.enemy, rules: {}, seed: id * 31 + 7, def: L };
    }
    const c = CHALLENGES.find(x => x.id === id);
    const L = levelDef(c.enemyFrom);
    const enemy = { ...L.enemy, ...(c.enemyOverride || {}), boss: false, elite: true };
    return { ...base, kind, id, level: c.enemyFrom, theater: THEATERS[c.theater], enemy, rules: c.rules, seed: c.enemyFrom * 17 + 3, timeOverride: c.timeOverride, def: { credits: c.credits, xp: c.xp, name: c.name }, chal: c };
  }

  launch(kind, id) {
    const p = P();
    if (kind === 'campaign') id = Math.min(id, p.campaign.unlocked);
    this.lastLaunch = { kind, id };
    const cfg = this.buildCfg(kind, id);
    this.lastCfg = cfg;
    this.root.innerHTML = `<div class="loading-sortie"><div>PREPARING SORTIE</div><small>${esc(cfg.def.name)}</small></div>`;
    this.root.className = 'ui-layer';
    setTimeout(() => {
      this.app.startBattle(cfg);
      this.root.innerHTML = p.stats.battles < 3 ? `<div class="battle-help">
        <b>CONTROLS</b> W/S pitch · A/D roll · Q/E yaw · Shift afterburner<br>Space gun · F missile · R switch · G flares · 1-4 maneuvers · V camera · C look at enemy · Esc pause</div>` : '';
      this.root.className = 'ui-layer battle';
      setTimeout(() => { const h = this.root.querySelector('.battle-help'); if (h) h.classList.add('fade'); }, 14000);
    }, 60);
  }

  togglePause() {
    const b = this.app.battle; if (!b || b.over) return;
    b.paused = !b.paused;
    if (b.paused) {
      audio.stopAllTones();
      this.root.innerHTML = `<div class="pause"><div class="panel"><h2>PAUSED</h2>
        <button class="btn primary" data-a="resume">RESUME</button><button class="btn" data-a="restart">RESTART</button><button class="btn" data-a="abort">ABORT MISSION</button>
        <p class="hint">W/S pitch · A/D roll · Q/E yaw · Shift A/B · Space gun · F missile · R switch · G flares · 1-4 maneuvers · V camera</p></div></div>`;
    } else { this.root.innerHTML = ''; this.app.last = performance.now(); }
  }

  onBattleEnd(sum) {
    const cfg = this.lastCfg;
    const res = this.applyResult(sum, cfg);
    this.app.endBattle();
    this.go('results', { sum, res, cfg });
  }

  applyResult(sum, cfg) {
    const p = P(); const s = p.stats;
    s.battles++; if (sum.won) { s.wins++; s.kills++; } else s.losses++;
    if (sum.gunKill) s.gunKills++;
    s.missilesFired += sum.missilesFired; s.missileHits += sum.missileHits; s.evades += sum.evades; s.flareDecoys += sum.flareDecoys;
    s.maneuversUsed += sum.maneuvers; Object.keys(sum.maneuverTypes).forEach(k => s.maneuverTypes[k] = true);
    s.damageDealt += sum.damageDealt; s.damageTaken += sum.damageTaken; s.flightTime += sum.time; s.shotsFired += sum.shotsFired; s.shotsHit += sum.shotsHit;
    if (sum.won && (!s.bestTime || sum.time < s.bestTime)) s.bestTime = sum.time;
    const lo = cfg.loadout;
    let credits, xp; const lines = [];
    let replayMul = 1;
    if (cfg.kind === 'campaign') { if (cfg.level < p.campaign.unlocked) replayMul = 0.6; }
    else if (p.challenges[cfg.id]) replayMul = 0.3;
    let starsN = 0;
    if (sum.won) {
      lines.push(['Victory reward', cfg.def.credits * replayMul]);
      let mul = 0;
      const hpB = sum.hpFrac * 0.35; mul += hpB; lines.push([`Hull integrity ${Math.round(sum.hpFrac * 100)}%`, cfg.def.credits * replayMul * hpB]);
      if (sum.time < 90) { mul += 0.2; lines.push(['Swift victory (< 1:30)', cfg.def.credits * replayMul * 0.2]); }
      if (sum.damageTaken <= 0) { mul += 0.25; lines.push(['Flawless — no damage', cfg.def.credits * replayMul * 0.25]); }
      if (sum.gunKill) { mul += 0.15; lines.push(['Gun kill bonus', cfg.def.credits * replayMul * 0.15]); }
      const acc = sum.shotsFired > 30 ? sum.shotsHit / sum.shotsFired : 0;
      if (acc > 0.2) { mul += 0.1; lines.push([`Marksman (${Math.round(acc * 100)}% accuracy)`, cfg.def.credits * replayMul * 0.1]); }
      if (lo.creditMul > 1) lines.push(['Bounty Hunter talent', cfg.def.credits * replayMul * (1 + mul) * (lo.creditMul - 1)]);
      credits = cfg.def.credits * replayMul * (1 + mul) * lo.creditMul;
      xp = cfg.def.xp * replayMul * (1 + mul * 0.6) * lo.xpMul;
      starsN = 1 + (sum.hpFrac > 0.5 ? 1 : 0) + (sum.hpFrac > 0.8 && sum.time < 150 ? 1 : 0);
      if (cfg.kind === 'campaign') {
        const n = cfg.level;
        p.campaign.stars[n] = Math.max(p.campaign.stars[n] || 0, starsN);
        if (n === p.campaign.unlocked) p.campaign.unlocked = n + 1;
        p.campaign.cleared = Math.max(p.campaign.cleared, Math.min(n, CAMPAIGN_LENGTH));
        if (BOSSES[n]) p.bosses[n] = true;
      } else p.challenges[cfg.id] = true;
    } else {
      credits = cfg.def.credits * 0.15 * lo.creditMul; xp = cfg.def.xp * 0.25 * lo.xpMul;
      lines.push(['Sortie pay (defeat)', credits]);
    }
    credits = Math.round(credits); xp = Math.round(xp);
    p.credits += credits; s.creditsEarned += credits;
    const ups = S.addXp(xp);
    const contracts = S.progressContracts(sum);
    let cxp = 0; contracts.forEach(c => { cxp += c.xp; s.creditsEarned += c.credits; });
    if (cxp) ups.push(...S.addXp(cxp));
    const ach = []; S.checkAchievements(sum, ach);
    ach.forEach(a => s.creditsEarned += a.credits);
    const unlocks = []; ups.forEach(u => unlocks.push(...S.unlocksAtLevel(u.level)));
    S.save();
    if (ups.length) setTimeout(() => audio.levelUp(), 400);
    return { credits, xp, lines, ups, contracts, ach, unlocks, starsN };
  }

  scr_results({ sum, res, cfg }) {
    const p = P(); this.setJetCurrent(-0.45);
    const need = xpForLevel(p.level);
    const nextL = cfg.kind === 'campaign' && sum.won ? levelDef(p.campaign.unlocked) : null;
    const acc = sum.shotsFired ? Math.round(sum.shotsHit / sum.shotsFired * 100) + '%' : '—';
    return `<div class="results ${sum.won ? 'win' : 'loss'}">
      <div class="res-title">${sum.won ? 'MISSION ACCOMPLISHED' : 'MISSION FAILED'}</div>
      <div class="res-sub">${esc(cfg.def.name)} · vs ${esc(sum.enemyName)}${sum.won ? ` · <span class="stars">${stars(res.starsN, 3)}</span>` : ''}</div>
      <div class="res-actions">
        ${nextL ? `<button class="btn primary big" data-a="next">▶ NEXT: ${esc(nextL.name)}</button>` : ''}
        <button class="btn ${sum.won ? '' : 'primary big'}" data-a="retry">↻ ${sum.won ? 'REPLAY' : 'RETRY'}</button>
        <button class="btn" data-a="go" data-s="hangar">HANGAR</button>
        <button class="btn" data-a="go" data-s="upgrades">UPGRADES</button>
        <button class="btn" data-a="go" data-s="main">MAIN MENU</button>
      </div>
      <div class="res-grid">
        <section class="panel">
          <h4>COMBAT REPORT</h4>
          <table>
            <tr><td>Time</td><td>${fmt(sum.time)}</td></tr><tr><td>Hull remaining</td><td>${Math.round(sum.hpFrac * 100)}%</td></tr>
            <tr><td>Damage dealt</td><td>${Math.round(sum.damageDealt)}</td></tr><tr><td>Gun accuracy</td><td>${acc}</td></tr>
            <tr><td>Missiles fired / hit</td><td>${sum.missilesFired} / ${sum.missileHits}</td></tr><tr><td>Missiles evaded</td><td>${sum.evades}</td></tr>
            <tr><td>Flare decoys</td><td>${sum.flareDecoys}</td></tr><tr><td>Maneuvers</td><td>${sum.maneuvers}</td></tr>
          </table>
        </section>
        <section class="panel">
          <h4>REWARDS</h4>
          <table>${res.lines.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${cr(v)}</td></tr>`).join('')}
            <tr class="total"><td>TOTAL</td><td>${cr(res.credits)}</td></tr><tr class="total"><td>EXPERIENCE</td><td>+${res.xp} XP</td></tr></table>
          <div class="xpbar big"><i style="width:${Math.min(100, p.xp / need * 100)}%"></i></div><div class="pc-xp">LEVEL ${p.level} · ${p.xp}/${need} XP</div>
          ${res.ups.length ? `<div class="levelup">LEVEL UP! → ${p.level} <small>+${res.ups.reduce((a, u) => a + u.sp, 0)} skill point(s)</small></div>` : ''}
          ${res.unlocks.length ? `<div class="unlocks"><b>NEW UNLOCKS</b>${res.unlocks.map(u => `<span>${esc(u)}</span>`).join('')}</div>` : ''}
          ${res.contracts.map(c => `<div class="gain">✔ Contract complete: ${esc(c.text)} <b>${cr(c.credits)} · ${c.xp} XP</b></div>`).join('')}
          ${res.ach.map(a => `<div class="gain trophy">🏆 ${esc(a.name)} <b>${cr(a.credits)}</b></div>`).join('')}
        </section>
      </div>
      ${!sum.won ? `<p class="hint center">Tip: upgrade your aircraft, buy better missiles, learn maneuvers like Emergency Break, or replay earlier missions for credits.</p>` : ''}
    </div>`;
  }
}
