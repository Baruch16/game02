// Player profile persistence and derived stat computation.
import {
  AIRCRAFT, AIRCRAFT_BY_ID, UPGRADES, UPGRADE_MAX, upgradeCost, PAINTS, PAINT_BY_ID, GUN_BY_ID, MISSILE_BY_ID,
  AVIONICS_BY_ID, MANEUVER_BY_ID, MANEUVER_SLOTS, TALENT_BRANCHES, TALENT_COST, xpForLevel, skillPointsForLevel,
  ACHIEVEMENTS, CONTRACT_TEMPLATES, MAX_LEVEL, BOSSES, CHALLENGES, CAMPAIGN_LENGTH,
} from './data.js';

const KEY = 'skydominance.save.v1';

function freshProfile() {
  return {
    v: 1,
    credits: 2500, xp: 0, level: 1, skillPoints: 0,
    talents: {},
    owned: { sparrow: { up: { speed: 0, accel: 0, agility: 0, armor: 0, radar: 0, weapons: 0 }, paint: 'standard' } },
    current: 'sparrow',
    paints: ['standard'],
    guns: ['g20'], missiles: ['ir9'], avionics: ['av0'],
    loadout: { gun: 'g20', primary: 'ir9', secondary: null, avionics: 'av0' },
    maneuvers: [], slots: [null, null, null, null],
    campaign: { unlocked: 1, cleared: 0, stars: {} },
    challenges: {},
    bosses: {},
    achievements: {},
    contracts: [],
    stats: {
      battles: 0, wins: 0, losses: 0, kills: 0, gunKills: 0, missilesFired: 0, missileHits: 0, evades: 0, flareDecoys: 0,
      maneuversUsed: 0, maneuverTypes: {}, damageDealt: 0, damageTaken: 0, flightTime: 0, bestTime: 0, creditsEarned: 0,
      shotsFired: 0, shotsHit: 0,
    },
    settings: { invert: false, volume: 0.7, quality: 'high', assist: true, camera: 'chase', mouse: false },
  };
}

export let profile = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      const f = freshProfile();
      // shallow-merge to tolerate added fields
      const merged = { ...f, ...p, stats: { ...f.stats, ...(p.stats || {}) }, settings: { ...f.settings, ...(p.settings || {}) },
        loadout: { ...f.loadout, ...(p.loadout || {}) }, campaign: { ...f.campaign, ...(p.campaign || {}) } };
      return merged;
    }
  } catch (e) { /* storage unavailable or corrupt */ }
  const p = freshProfile();
  ensureContracts(p);
  return p;
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch (e) { /* ignore */ }
}

export function resetProfile() {
  profile = freshProfile();
  ensureContracts(profile);
  save();
  return profile;
}

// ---------------------------------------------------------------- shop helpers
export function canAfford(cost) { return profile.credits >= cost; }
function spend(cost) { if (profile.credits < cost) return false; profile.credits -= cost; return true; }

export function buyAircraft(id) {
  const a = AIRCRAFT_BY_ID[id];
  if (!a || profile.owned[id] || profile.level < a.level || !spend(a.price)) return false;
  profile.owned[id] = { up: { speed: 0, accel: 0, agility: 0, armor: 0, radar: 0, weapons: 0 }, paint: 'standard' };
  profile.current = id;
  save();
  return true;
}
export function selectAircraft(id) { if (profile.owned[id]) { profile.current = id; save(); } }

export function buyUpgrade(acId, upId) {
  const own = profile.owned[acId]; if (!own) return false;
  const lvl = own.up[upId] || 0; if (lvl >= UPGRADE_MAX) return false;
  if (!spend(upgradeCost(AIRCRAFT_BY_ID[acId], lvl))) return false;
  own.up[upId] = lvl + 1; save(); return true;
}

export function buyPaint(id) {
  const p = PAINT_BY_ID[id];
  if (!p || profile.paints.includes(id) || profile.level < p.level || !spend(p.price)) return false;
  profile.paints.push(id); save(); return true;
}
export function applyPaint(acId, paintId) {
  if (profile.owned[acId] && profile.paints.includes(paintId)) { profile.owned[acId].paint = paintId; save(); }
}

export function buyItem(kind, def) {
  const list = profile[kind];
  if (list.includes(def.id) || profile.level < def.level || !spend(def.price)) return false;
  list.push(def.id); save(); return true;
}

export function equip(slot, id) {
  const L = profile.loadout;
  if (slot === 'primary' || slot === 'secondary') {
    const other = slot === 'primary' ? 'secondary' : 'primary';
    if (id && L[other] === id) L[other] = L[slot];
    L[slot] = id;
    if (!L.primary) { L.primary = L.secondary; L.secondary = null; }
  } else L[slot] = id;
  save();
}

export function buyManeuver(id) {
  const m = MANEUVER_BY_ID[id];
  if (!m || profile.maneuvers.includes(id) || profile.level < m.level || !spend(m.price)) return false;
  profile.maneuvers.push(id);
  const free = profile.slots.indexOf(null);
  if (free >= 0) profile.slots[free] = id;
  save(); return true;
}
export function setSlot(i, id) {
  const j = profile.slots.indexOf(id);
  if (j >= 0) profile.slots[j] = profile.slots[i];
  profile.slots[i] = id; save();
}

export function talentCost(branchIdx, nodeIdx) { return TALENT_COST[nodeIdx]; }
export function canLearnTalent(branchIdx, nodeIdx) {
  const b = TALENT_BRANCHES[branchIdx]; const n = b.nodes[nodeIdx];
  if (profile.talents[n.id]) return false;
  if (nodeIdx > 0 && !profile.talents[b.nodes[nodeIdx - 1].id]) return false;
  return profile.skillPoints >= TALENT_COST[nodeIdx];
}
export function learnTalent(branchIdx, nodeIdx) {
  if (!canLearnTalent(branchIdx, nodeIdx)) return false;
  const n = TALENT_BRANCHES[branchIdx].nodes[nodeIdx];
  profile.skillPoints -= TALENT_COST[nodeIdx];
  profile.talents[n.id] = true; save(); return true;
}
export function respecCost() { return 2000 + profile.level * 500; }
export function respecTalents() {
  if (!spend(respecCost())) return false;
  let refund = 0;
  TALENT_BRANCHES.forEach(b => b.nodes.forEach((n, i) => { if (profile.talents[n.id]) refund += TALENT_COST[i]; }));
  profile.talents = {}; profile.skillPoints += refund; save(); return true;
}

export const T = id => !!profile.talents[id];

// ---------------------------------------------------------------- derived stats
export function aircraftStats(acId, prof = profile) {
  const a = AIRCRAFT_BY_ID[acId];
  const up = prof.owned[acId]?.up || { speed: 0, accel: 0, agility: 0, armor: 0, radar: 0, weapons: 0 };
  const t = id => !!prof.talents[id];
  const s = {
    speed: a.speed * (1 + up.speed * 0.045) * (t('t4') ? 1.05 : 1),
    thrust: a.thrust * (1 + up.accel * 0.08) * (t('t4') ? 1.1 : 1),
    pitch: a.pitch * (1 + up.agility * 0.06),
    roll: a.roll * (1 + up.agility * 0.06),
    yaw: a.yaw * (1 + up.agility * 0.04),
    hp: a.hp * (1 + up.armor * 0.12) * (t('s1') ? 1.15 : 1),
    radar: a.radar * (1 + up.radar * 0.12) * (t('t2') ? 1.25 : 1),
    lockMul: (1 - up.radar * 0.06),
    dmgMul: 1 + up.weapons * 0.07,
    reloadMul: 1 - up.weapons * 0.05,
    stealth: a.stealth,
    missiles: a.missiles + (t('m2') ? 2 : 0) + (t('m5') ? 2 : 0),
    flares: Math.round(a.flares * (t('s2') ? 1.5 : 1)),
    corner: a.corner,
    traits: a.traits,
  };
  return s;
}

// Rating used for comparing aircraft at a glance (0..100 scale per stat)
export function statBars(s) {
  return [
    ['Speed', s.speed * 3.6, 1700, 'km/h', 0],
    ['Acceleration', s.thrust, 110, 'm/s²', 0],
    ['Maneuverability', (s.pitch * 0.6 + s.roll * 0.15) * 50, 115, '', 0],
    ['Armor', s.hp, 280, 'HP', 0],
    ['Radar', s.radar / 1000, 16, 'km', 1],
    ['Payload', s.missiles, 16, 'slots', 0],
    ['Stealth', s.stealth * 100, 100, '%', 0],
  ];
}

export function battleLoadout(prof = profile) {
  const s = aircraftStats(prof.current, prof);
  const t = id => !!prof.talents[id];
  const av = AVIONICS_BY_ID[prof.loadout.avionics] || AVIONICS_BY_ID.av0;
  const ac = AIRCRAFT_BY_ID[prof.current];
  const interceptor = ac.traits.includes('interceptor');
  const lockMul = s.lockMul * av.lockMul * (t('m1') ? 0.85 : 1) * (t('m4') ? 0.8 : 1);
  const mslDmg = s.dmgMul * (t('m3') ? 1.18 : 1);
  const fovMul = av.fovMul * (t('m4') ? 1.2 : 1);
  const mkMissile = id => {
    const m = MISSILE_BY_ID[id];
    return {
      ...m, dmg: m.dmg * mslDmg, lock: m.lock * lockMul, reload: m.reload * s.reloadMul * (t('m5') ? 0.6 : 1),
      range: m.range * (interceptor ? 1.3 : 1) * (1 + (prof.owned[prof.current]?.up.radar || 0) * 0.03),
      fov: m.fov * fovMul, cm: Math.min(0.95, m.cm + av.cm), turn: m.turn * av.turnMul,
    };
  };
  const ids = [prof.loadout.primary, prof.loadout.secondary].filter(Boolean);
  const missiles = ids.map(mkMissile);
  // split capacity by weight
  const cap = s.missiles;
  if (missiles.length === 1) missiles[0].ammo = Math.max(1, Math.floor(cap / missiles[0].weight));
  else if (missiles.length === 2) {
    const half = cap / 2;
    missiles[0].ammo = Math.max(1, Math.ceil(half / missiles[0].weight));
    missiles[1].ammo = Math.max(1, Math.floor(half / missiles[1].weight));
  }
  const g = GUN_BY_ID[prof.loadout.gun];
  const gun = {
    ...g, dmg: g.dmg * s.dmgMul * (t('g3') ? 1.25 : 1), spread: g.spread * (t('g1') ? 0.65 : 1),
    heat: g.heat * (t('g2') ? 0.75 : 1), range: g.range * (t('g4') ? 1.25 : 1),
    assist: 0.022 * (t('g1') ? 1.4 : 1) * (t('g4') ? 1.3 : 1), executioner: t('g5'),
  };
  const cdMul = (ac.traits.includes('tv') ? 0.65 : 1) * (t('s4') ? 0.8 : 1);
  return {
    aircraft: ac, stats: s, gun, missiles, avionics: av,
    maneuvers: prof.slots.filter(Boolean), cdMul,
    paint: PAINT_BY_ID[prof.owned[prof.current]?.paint || 'standard'],
    regen: t('s3') ? 2 : 0, secondWind: t('s5'), predator: t('t5'), flareBonus: t('s2') ? 0.1 : 0,
    shield: ac.traits.includes('shield'),
    creditMul: t('t1') ? 1.15 : 1, xpMul: t('t3') ? 1.2 : 1, earlyWarn: t('t2'),
  };
}

// ---------------------------------------------------------------- progression / rewards
export function addXp(amount) {
  const ups = [];
  profile.xp += amount;
  while (profile.level < MAX_LEVEL && profile.xp >= xpForLevel(profile.level)) {
    profile.xp -= xpForLevel(profile.level);
    profile.level++;
    const sp = skillPointsForLevel(profile.level);
    profile.skillPoints += sp;
    ups.push({ level: profile.level, sp });
  }
  return ups;
}

export function unlocksAtLevel(level) {
  const out = [];
  AIRCRAFT.forEach(a => a.level === level && out.push('Aircraft: ' + a.name));
  Object.values(GUN_BY_ID).forEach(a => a.level === level && a.price > 0 && out.push('Gun: ' + a.name));
  Object.values(MISSILE_BY_ID).forEach(a => a.level === level && a.price > 0 && out.push('Missile: ' + a.name));
  Object.values(AVIONICS_BY_ID).forEach(a => a.level === level && a.price > 0 && out.push('Avionics: ' + a.name));
  Object.values(MANEUVER_BY_ID).forEach(a => a.level === level && out.push('Maneuver: ' + a.name));
  PAINTS.forEach(a => a.level === level && a.price > 0 && out.push('Paint: ' + a.name));
  CHALLENGES.forEach(a => a.level === level && out.push('Challenge: ' + a.name));
  return out;
}

export function unlockAchievement(id, list) {
  if (profile.achievements[id]) return;
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (!a) return;
  profile.achievements[id] = Date.now();
  profile.credits += a.credits;
  list && list.push(a);
}

export function checkAchievements(battle, list) {
  const S = profile.stats;
  if (S.wins >= 1) unlockAchievement('first', list);
  if (S.kills >= 5) unlockAchievement('ace5', list);
  if (S.kills >= 25) unlockAchievement('ace25', list);
  if (Object.keys(profile.bosses).length >= 1) unlockAchievement('boss1', list);
  if (Object.keys(BOSSES).every(n => profile.bosses[n])) unlockAchievement('bossall', list);
  if (S.gunKills >= 1) unlockAchievement('gunkill', list);
  if (S.gunKills >= 10) unlockAchievement('gun10', list);
  if (S.evades >= 10) unlockAchievement('evade10', list);
  if (S.evades >= 50) unlockAchievement('evade50', list);
  if (Object.keys(profile.owned).length >= 3) unlockAchievement('hangar3', list);
  if (AIRCRAFT.every(a => profile.owned[a.id])) unlockAchievement('hangarall', list);
  if (Object.values(profile.owned).some(o => Object.values(o.up).some(v => v >= UPGRADE_MAX))) unlockAchievement('maxup', list);
  if (Object.keys(MANEUVER_BY_ID).every(id => S.maneuverTypes[id])) unlockAchievement('maneuver', list);
  if (Object.keys(profile.challenges).length >= 1) unlockAchievement('challenge', list);
  if (CHALLENGES.every(c => profile.challenges[c.id])) unlockAchievement('challengeall', list);
  if (profile.campaign.cleared >= CAMPAIGN_LENGTH) unlockAchievement('campaign', list);
  if (profile.level >= 10) unlockAchievement('level10', list);
  if (profile.level >= 20) unlockAchievement('level20', list);
  if (battle && battle.won) {
    if (battle.damageTaken <= 0) unlockAchievement('nodmg', list);
    if (battle.time < 60) unlockAchievement('fast', list);
    if (battle.lowAltTime >= 10) unlockAchievement('lowalt', list);
  }
}

function rnd(a) { return a[Math.floor(Math.random() * a.length)]; }
export function ensureContracts(p = profile) {
  while (p.contracts.length < 3) {
    const used = new Set(p.contracts.map(c => c.kind));
    const pool = CONTRACT_TEMPLATES.filter(t => !used.has(t.kind));
    const t = rnd(pool);
    const n = rnd(t.amounts);
    const lvl = p.level;
    p.contracts.push({ kind: t.kind, text: t.text(n), target: n, progress: 0,
      credits: Math.round((1500 + lvl * 450) * (0.6 + n * 0.2) / 50) * 50, xp: Math.round((200 + lvl * 80) * (0.6 + n * 0.15)) });
  }
}

// battle summary → contract progress; returns completed contracts
export function progressContracts(r) {
  const done = [];
  const inc = { wins: r.won ? 1 : 0, gunkills: r.gunKill ? 1 : 0, missilehits: r.missileHits, evades: r.evades,
    maneuvers: r.maneuvers, cleanwin: r.won && r.hpFrac > 0.7 ? 1 : 0, fastwin: r.won && r.time < 120 ? 1 : 0, flares: r.flareDecoys };
  profile.contracts.forEach(c => { c.progress = Math.min(c.target, c.progress + (inc[c.kind] || 0)); });
  profile.contracts = profile.contracts.filter(c => {
    if (c.progress >= c.target) { done.push(c); profile.credits += c.credits; return false; }
    return true;
  });
  ensureContracts();
  return done;
}

export function rerollContract(i) {
  const cost = 500 + profile.level * 100;
  if (!spend(cost)) return false;
  profile.contracts.splice(i, 1); ensureContracts(); save(); return true;
}
export function rerollCost() { return 500 + profile.level * 100; }
