// SKY DOMINANCE — static game data: aircraft, weapons, maneuvers, talents, campaign.

export const KMH = 3.6;

// ---------------------------------------------------------------- PLAYER AIRCRAFT
// speed: max military-power speed (m/s); thrust: m/s^2; pitch/roll/yaw: rad/s
// stealth 0..1 multiplies enemy lock time; missiles: missile capacity (slots)
export const AIRCRAFT = [
  {
    id: 'sparrow', name: 'AF-4 Sparrowhawk', role: 'Light Trainer-Fighter', tier: 1, price: 0, level: 1, design: 'sparrow',
    speed: 245, thrust: 40, pitch: 1.25, roll: 2.6, yaw: 0.35, hp: 100, radar: 3500, stealth: 0, missiles: 6, flares: 12, corner: 165,
    traits: ['forgiving'],
    pros: ['Very forgiving, stable handling', 'Cheap to upgrade'], cons: ['Low top speed', 'Small payload'],
    desc: 'A dependable light fighter. Every ace started somewhere.',
  },
  {
    id: 'falcon', name: 'AF-16 Falcon', role: 'Agile Multirole', tier: 2, price: 9000, level: 3, design: 'falcon',
    speed: 290, thrust: 55, pitch: 1.6, roll: 3.5, yaw: 0.4, hp: 105, radar: 4500, stealth: 0.05, missiles: 8, flares: 16, corner: 180,
    traits: [],
    pros: ['Snappy roll rate', 'Excellent sustained turn'], cons: ['Light armor'],
    desc: 'The nimble workhorse. Out-turns anything in its weight class.',
  },
  {
    id: 'hornet', name: 'AF-18 Hornet', role: 'Heavy Carrier Fighter', tier: 3, price: 18000, level: 5, design: 'hornet',
    speed: 275, thrust: 48, pitch: 1.5, roll: 2.8, yaw: 0.5, hp: 170, radar: 5000, stealth: 0.05, missiles: 12, flares: 26, corner: 160,
    traits: ['highAoA'],
    pros: ['Huge payload and armor', 'High-AoA: controllable at low speed'], cons: ['Sluggish acceleration', 'Modest top speed'],
    desc: 'Built to land on a pitching deck and take a beating. A flying fortress.',
  },
  {
    id: 'lancer', name: 'MX-31 Lancer', role: 'Interceptor', tier: 3, price: 30000, level: 8, design: 'lancer',
    speed: 400, thrust: 78, pitch: 1.05, roll: 2.3, yaw: 0.3, hp: 120, radar: 9000, stealth: 0, missiles: 8, flares: 14, corner: 230,
    traits: ['interceptor'],
    pros: ['Blistering top speed', 'Missiles fly 30% further', 'Huge radar'], cons: ['Turns like a freight train'],
    desc: 'A missile with a cockpit. Boom, zoom and never look back.',
  },
  {
    id: 'eagle', name: 'AF-15 Strike Eagle', role: 'Air Superiority', tier: 4, price: 42000, level: 10, design: 'eagle',
    speed: 340, thrust: 66, pitch: 1.55, roll: 3.0, yaw: 0.45, hp: 150, radar: 7500, stealth: 0.05, missiles: 10, flares: 20, corner: 190,
    traits: [],
    pros: ['Best climb rate in class', 'Long radar, big payload'], cons: ['Large radar signature'],
    desc: 'Undefeated in a hundred fictional wars. Power, range and punch.',
  },
  {
    id: 'tempest', name: 'SX-37 Tempest', role: 'Supermaneuverable', tier: 5, price: 65000, level: 12, design: 'tempest',
    speed: 330, thrust: 64, pitch: 2.0, roll: 3.7, yaw: 0.6, hp: 155, radar: 6500, stealth: 0.05, missiles: 10, flares: 20, corner: 175,
    traits: ['tv', 'highAoA'],
    pros: ['Thrust vectoring: maneuvers recharge 35% faster', 'Insane pitch authority'], cons: ['Bleeds energy in hard turns'],
    desc: 'Thrust-vectoring nozzles let it dance where other jets would stall.',
  },
  {
    id: 'wraith', name: 'AF-22 Wraith', role: 'Stealth Air Dominance', tier: 6, price: 110000, level: 16, design: 'wraith',
    speed: 365, thrust: 74, pitch: 1.85, roll: 3.8, yaw: 0.5, hp: 145, radar: 8500, stealth: 0.55, missiles: 8, flares: 18, corner: 190,
    traits: ['tv', 'stealth'],
    pros: ['Stealth: enemy lock takes 2x longer', 'Supercruise speed'], cons: ['Internal bay limits payload', 'Expensive upgrades'],
    desc: 'You will not see it. You will not lock it. You will lose.',
  },
  {
    id: 'phantom', name: 'XF-9 Phantom', role: '6th-Gen Prototype', tier: 7, price: 180000, level: 20, design: 'phantom',
    speed: 405, thrust: 88, pitch: 2.1, roll: 4.3, yaw: 0.6, hp: 175, radar: 11000, stealth: 0.65, missiles: 12, flares: 24, corner: 200,
    traits: ['tv', 'stealth', 'shield'],
    pros: ['Regenerating energy shield', 'Best-in-class everything'], cons: ['Costs a small nation'],
    desc: 'A tailless sixth-generation prototype with an adaptive energy shield.',
  },
];
export const AIRCRAFT_BY_ID = Object.fromEntries(AIRCRAFT.map(a => [a.id, a]));

// ---------------------------------------------------------------- UPGRADES
export const UPGRADES = [
  { id: 'speed', name: 'Engine Tuning', stat: 'Top speed', per: 0.045, desc: '+4.5% top speed per level' },
  { id: 'accel', name: 'Afterburner', stat: 'Acceleration', per: 0.08, desc: '+8% thrust per level' },
  { id: 'agility', name: 'Fly-by-Wire', stat: 'Maneuverability', per: 0.06, desc: '+6% pitch & roll rate per level' },
  { id: 'armor', name: 'Armor Plating', stat: 'Armor', per: 0.12, desc: '+12% hull integrity per level' },
  { id: 'radar', name: 'Radar Array', stat: 'Radar', per: 0.12, desc: '+12% radar range, -6% lock time per level' },
  { id: 'weapons', name: 'Weapon Systems', stat: 'Firepower', per: 0.07, desc: '+7% damage, -5% reload per level' },
];
export const UPGRADE_MAX = 5;
export function upgradeCost(aircraft, lvl) {
  const base = Math.max(1800, aircraft.price * 0.09);
  return Math.round((base * Math.pow(lvl + 1, 1.45)) / 50) * 50;
}

// ---------------------------------------------------------------- PAINT SCHEMES
export const PAINTS = [
  { id: 'standard', name: 'Ghost Grey', price: 0, level: 1, base: '#8b939d', second: '#626a74', accent: '#cfd6de', pattern: 'none' },
  { id: 'navy', name: 'Deep Navy', price: 1500, level: 1, base: '#2f415f', second: '#1d2a40', accent: '#d9e2ee', pattern: 'none' },
  { id: 'aggressor', name: 'Aggressor Blue', price: 3000, level: 2, base: '#5b7ea3', second: '#b8c6d4', accent: '#203040', pattern: 'splinter' },
  { id: 'desert', name: 'Desert Fox', price: 3500, level: 3, base: '#c9a96f', second: '#8d6c3e', accent: '#f0e0c0', pattern: 'camo' },
  { id: 'woodland', name: 'Woodland', price: 3500, level: 4, base: '#5d6d3c', second: '#36421f', accent: '#c7b98a', pattern: 'camo' },
  { id: 'arctic', name: 'Arctic Splinter', price: 4500, level: 5, base: '#e8eef2', second: '#93a7b8', accent: '#304050', pattern: 'splinter' },
  { id: 'crimson', name: 'Crimson Lance', price: 7000, level: 7, base: '#a5161f', second: '#262626', accent: '#f2f2f2', pattern: 'stripe' },
  { id: 'tiger', name: 'Tiger Meet', price: 9000, level: 9, base: '#e48b1d', second: '#151515', accent: '#ffffff', pattern: 'tiger' },
  { id: 'blackops', name: 'Black Ops', price: 12000, level: 12, base: '#1a1c20', second: '#2c3038', accent: '#ff3b30', pattern: 'stripe' },
  { id: 'gold', name: 'Gilded Ace', price: 40000, level: 18, base: '#d4af37', second: '#6b5418', accent: '#fff4c2', pattern: 'stripe' },
];
export const PAINT_BY_ID = Object.fromEntries(PAINTS.map(p => [p.id, p]));

// ---------------------------------------------------------------- WEAPONS
export const GUNS = [
  { id: 'g20', name: 'M20 Vulcan 20mm', price: 0, level: 1, dmg: 1.0, rof: 40, speed: 1050, range: 1200, spread: 0.006, heat: 0.0125, desc: 'Reliable rotary cannon. High rate of fire, modest punch.' },
  { id: 'g25', name: 'GAU-25 Equalizer 25mm', price: 7000, level: 4, dmg: 1.75, rof: 30, speed: 1100, range: 1400, spread: 0.005, heat: 0.013, desc: 'Heavier rounds, flatter trajectory, longer reach.' },
  { id: 'g30', name: 'AK-30 Avenger 30mm', price: 20000, level: 9, dmg: 3.5, rof: 17, speed: 1050, range: 1600, spread: 0.0045, heat: 0.019, desc: 'Each shell is a hammer blow. Slow but devastating.' },
  { id: 'laser', name: 'HEL-1 Pulse Laser', price: 70000, level: 17, dmg: 1.4, rof: 50, speed: 4000, range: 2200, spread: 0.0008, heat: 0.0105, desc: 'Directed-energy weapon. Near-instant beams, pinpoint accuracy.' },
];
export const GUN_BY_ID = Object.fromEntries(GUNS.map(g => [g.id, g]));

// seeker: ir (flare-vulnerable), radar (chaff-vulnerable, ignores aspect), dual
export const MISSILES = [
  { id: 'ir9', name: 'IR-9 Viper', type: 'Heat-Seeking', price: 0, level: 1, dmg: 38, range: 2000, speed: 520, turn: 2.3, lock: 1.5, reload: 1.3, seeker: 'ir', fov: 0.45, cm: 0.0, weight: 1, count: 1,
    desc: 'Basic short-range heat seeker. Easily spoofed by flares.' },
  { id: 'ir9x', name: 'IR-9X Viper II', type: 'Advanced Heat-Seeking', price: 8000, level: 4, dmg: 44, range: 2600, speed: 600, turn: 3.3, lock: 1.1, reload: 1.0, seeker: 'ir', fov: 0.7, cm: 0.45, weight: 1, count: 1,
    desc: 'High off-boresight imaging seeker. Fast lock, very agile, flare-resistant.' },
  { id: 'ar120', name: 'AR-120 Lancet', type: 'Radar-Guided', price: 13000, level: 6, dmg: 54, range: 4000, speed: 700, turn: 2.4, lock: 2.1, reload: 1.6, seeker: 'radar', fov: 0.42, cm: 0.55, weight: 1, count: 1,
    desc: 'Active radar homing. Medium range, hard to decoy.' },
  { id: 'lr54', name: 'LR-54 Longbow', type: 'Long-Range', price: 26000, level: 10, dmg: 72, range: 7000, speed: 820, turn: 1.6, lock: 3.0, reload: 2.6, seeker: 'radar', fov: 0.3, cm: 0.5, weight: 2, count: 1,
    desc: 'Strike from beyond visual range. Slow to lock, sluggish terminal turn.' },
  { id: 'hs7', name: 'HS-7 Bolt', type: 'Hypersonic', price: 38000, level: 13, dmg: 62, range: 4800, speed: 1350, turn: 2.0, lock: 1.8, reload: 2.0, seeker: 'radar', fov: 0.38, cm: 0.6, weight: 1, count: 1,
    desc: 'Mach 4 scramjet missile. Almost no time to react.' },
  { id: 'mt4', name: 'MT-4 Hydra', type: 'Multi-Target Swarm', price: 46000, level: 14, dmg: 19, range: 2600, speed: 620, turn: 3.2, lock: 1.6, reload: 2.6, seeker: 'ir', fov: 0.6, cm: 0.35, weight: 2, count: 4,
    desc: 'Releases 4 micro-missiles. Spares divert to shoot down incoming enemy missiles.' },
  { id: 'sm9', name: 'SM-9 Phoenix', type: 'Smart Dual-Seeker', price: 95000, level: 18, dmg: 88, range: 6000, speed: 980, turn: 3.6, lock: 1.5, reload: 2.0, seeker: 'dual', fov: 0.6, cm: 0.85, weight: 2, count: 1,
    desc: 'AI-guided dual-mode seeker. Practically immune to countermeasures.' },
];
export const MISSILE_BY_ID = Object.fromEntries(MISSILES.map(m => [m.id, m]));

export const AVIONICS = [
  { id: 'av0', name: 'Standard Seeker Suite', price: 0, level: 1, lockMul: 1, cm: 0, fovMul: 1, turnMul: 1, desc: 'Factory tracking computer.' },
  { id: 'av1', name: 'IRCCM Module', price: 6000, level: 3, lockMul: 0.9, cm: 0.15, fovMul: 1.1, turnMul: 1.05, desc: 'Counter-countermeasure logic: missiles ignore more flares.' },
  { id: 'av2', name: 'AESA Datalink', price: 22000, level: 8, lockMul: 0.75, cm: 0.25, fovMul: 1.25, turnMul: 1.12, desc: 'Mid-course datalink updates. Faster locks, wider cone, sharper tracking.' },
  { id: 'av3', name: 'Quantum Track Suite', price: 65000, level: 16, lockMul: 0.6, cm: 0.4, fovMul: 1.5, turnMul: 1.22, desc: 'Predictive AI fire control. The ultimate tracking system.' },
];
export const AVIONICS_BY_ID = Object.fromEntries(AVIONICS.map(a => [a.id, a]));

// ---------------------------------------------------------------- MANEUVERS
export const MANEUVERS = [
  { id: 'highg', name: 'High-G Turn', price: 2000, level: 2, cd: 10, icon: 'G',
    desc: 'For 3s pitch authority x1.8. Bleeds speed fast. Win turning fights and pull lead for guns.' },
  { id: 'roll', name: 'Barrel Roll', price: 3500, level: 3, cd: 7, icon: '⟲',
    desc: 'Corkscrew displacement. Close-in missiles (under 1.5km) may overshoot; enemy gun aim degraded.' },
  { id: 'immel', name: 'Immelmann Turn', price: 5000, level: 5, cd: 12, icon: '∩',
    desc: 'Half-loop and roll-out: reverse heading while gaining altitude. Pursuers lose track for a moment.' },
  { id: 'splits', name: 'Split-S', price: 5000, level: 6, cd: 12, icon: '∪',
    desc: 'Half-roll and pull through: reverse heading diving, gaining 25% speed.' },
  { id: 'evasive', name: 'Emergency Break', price: 8000, level: 7, cd: 25, icon: '!',
    desc: 'Auto flare/chaff salvo + max-G break. Incoming missiles very likely lose lock; enemy lock reset.' },
  { id: 'cobra', name: 'Cobra Maneuver', price: 12000, level: 9, cd: 16, icon: 'C',
    desc: 'Pitch to 90° and brake hard. A chasing enemy overshoots and is stunned; radar locks break (doppler notch).' },
  { id: 'surge', name: 'Afterburner Surge', price: 15000, level: 10, cd: 18, icon: '»',
    desc: 'Overboost engines for 4s: +45% speed instantly. Outrun missiles or close distance.' },
  { id: 'jink', name: 'Ghost Jink', price: 22000, level: 12, cd: 22, icon: '≈',
    desc: 'Advanced missile avoidance: 5s of unpredictable jinking. Incoming missile tracking -75%.' },
];
export const MANEUVER_BY_ID = Object.fromEntries(MANEUVERS.map(m => [m.id, m]));
export const MANEUVER_SLOTS = 4;

// ---------------------------------------------------------------- TALENT TREE
export const TALENT_BRANCHES = [
  { id: 'gun', name: 'Gunner', color: '#ffb020', nodes: [
    { id: 'g1', name: 'Steady Hands', desc: 'Gun spread -35%, gun aim assist cone +40%.' },
    { id: 'g2', name: 'Cold Barrels', desc: 'Gun heat buildup -25%.' },
    { id: 'g3', name: 'AP Rounds', desc: 'Gun damage +25%.' },
    { id: 'g4', name: 'Lead Computer', desc: 'Gun range +25%, stronger aim assist.' },
    { id: 'g5', name: 'Executioner', desc: 'Gun damage +60% against targets under 35% hull.' },
  ]},
  { id: 'msl', name: 'Missileer', color: '#ff5050', nodes: [
    { id: 'm1', name: 'Quick Lock', desc: 'Lock-on time -15%.' },
    { id: 'm2', name: 'Extra Rails', desc: '+2 missile capacity.' },
    { id: 'm3', name: 'Warhead Tuning', desc: 'Missile damage +18%.' },
    { id: 'm4', name: 'Snap Shot', desc: 'Lock-on time -20%, seeker cone +20%.' },
    { id: 'm5', name: 'Ripple Fire', desc: 'Missile reload -40%, +2 capacity.' },
  ]},
  { id: 'surv', name: 'Survivor', color: '#40d080', nodes: [
    { id: 's1', name: 'Thick Skin', desc: 'Hull +15%.' },
    { id: 's2', name: 'Flare Pack', desc: 'Countermeasures +50%, flares 10% more effective.' },
    { id: 's3', name: 'Damage Control', desc: 'Repair 2 hull/s after 4s without taking damage.' },
    { id: 's4', name: 'Sixth Sense', desc: 'Maneuver cooldowns -20%.' },
    { id: 's5', name: 'Second Wind', desc: 'Once per battle, survive a lethal hit with 30% hull.' },
  ]},
  { id: 'tac', name: 'Tactician', color: '#40a8ff', nodes: [
    { id: 't1', name: 'Bounty Hunter', desc: 'Credits earned +15%.' },
    { id: 't2', name: 'Radar Officer', desc: 'Radar range +25%, enemy lock warning earlier.' },
    { id: 't3', name: 'Quick Study', desc: 'XP earned +20%.' },
    { id: 't4', name: 'Energy Fighter', desc: 'Thrust +10%, top speed +5%.' },
    { id: 't5', name: 'Predator', desc: '+20% damage when attacking from the enemy\'s rear hemisphere.' },
  ]},
];
export const TALENT_COST = [1, 1, 2, 2, 3];

// ---------------------------------------------------------------- PROGRESSION
export function xpForLevel(l) { return Math.round(160 * Math.pow(l, 1.22) / 10) * 10; }
export function skillPointsForLevel(l) { return l % 5 === 0 ? 2 : 1; }
export const MAX_LEVEL = 50;

// ---------------------------------------------------------------- ENEMIES
export const ENEMY_TYPES = {
  gnat:    { name: 'Gnat',      design: 'gnat',    speed: 225, thrust: 36, pitch: 1.0, roll: 2.2, yaw: 0.3, hp: 110, stealth: 0,    corner: 160 },
  fishbed: { name: 'Fishbed',   design: 'fishbed', speed: 265, thrust: 46, pitch: 1.2, roll: 2.6, yaw: 0.35, hp: 150, stealth: 0,    corner: 175 },
  fulcrum: { name: 'Fulcrum',   design: 'fulcrum', speed: 295, thrust: 55, pitch: 1.45, roll: 3.1, yaw: 0.4, hp: 200, stealth: 0.05, corner: 180 },
  flanker: { name: 'Flanker',   design: 'tempest', speed: 320, thrust: 62, pitch: 1.75, roll: 3.4, yaw: 0.5, hp: 260, stealth: 0.05, corner: 180 },
  felon:   { name: 'Felon',     design: 'felon',   speed: 350, thrust: 70, pitch: 1.85, roll: 3.6, yaw: 0.5, hp: 300, stealth: 0.45, corner: 190 },
  phantomE:{ name: 'Nightshade',design: 'phantom', speed: 380, thrust: 80, pitch: 2.0, roll: 4.0, yaw: 0.55, hp: 340, stealth: 0.6, corner: 200 },
};

export const BOSSES = {
  5:  { name: 'LEVIATHAN', title: 'Heavy Gunship', design: 'leviathan', speed: 255, thrust: 45, pitch: 1.0, roll: 1.8, yaw: 0.3, hp: 600, stealth: 0, corner: 170,
        missile: 'ir9', salvo: 3, style: 'brawler', skill: 0.35, flares: 10, gun: 'g25', scale: 1.7, paint: 'boss1',
        intro: 'A flying fortress bristling with missile racks. It fires in salvos — keep moving.' },
  10: { name: 'RED VIPER', title: 'Enemy Ace', design: 'tempest', speed: 330, thrust: 66, pitch: 1.95, roll: 3.8, yaw: 0.55, hp: 420, stealth: 0.05, corner: 175,
        missile: 'ir9x', salvo: 1, style: 'ace', skill: 0.6, flares: 20, gun: 'g25', scale: 1.0, paint: 'boss2',
        intro: 'Their top ace in a thrust-vectoring fighter. Expect cobras and relentless pressure.' },
  15: { name: 'SPECTRE', title: 'Stealth Hunter', design: 'spectre', speed: 360, thrust: 72, pitch: 1.9, roll: 3.8, yaw: 0.5, hp: 460, stealth: 0.75, corner: 190,
        missile: 'ar120', salvo: 2, style: 'sniper', skill: 0.72, flares: 24, gun: 'g25', scale: 1.15, paint: 'boss3',
        intro: 'Nearly invisible to radar. It strikes from long range and vanishes. Get close.' },
  20: { name: 'VALKYRIE', title: 'Hypersonic Raider', design: 'lancer', speed: 450, thrust: 95, pitch: 1.5, roll: 3.0, yaw: 0.4, hp: 560, stealth: 0.2, corner: 240,
        missile: 'hs7', salvo: 1, style: 'energy', skill: 0.8, flares: 28, gun: 'g30', scale: 1.1, paint: 'boss4',
        intro: 'Faster than anything you have faced. Hypersonic missiles. Don\'t let it build speed.' },
  25: { name: 'BLACK WYVERN', title: 'Prototype Superfighter', design: 'phantom', speed: 400, thrust: 88, pitch: 2.2, roll: 4.3, yaw: 0.6, hp: 650, stealth: 0.55, corner: 200,
        missile: 'sm9', salvo: 1, style: 'ace', skill: 0.9, flares: 32, gun: 'laser', scale: 1.15, paint: 'boss5',
        intro: 'A stolen sixth-gen prototype with an adaptive AI co-pilot. It learns as you fight.' },
  30: { name: 'OVERLORD', title: 'Sky Fortress Commander', design: 'leviathan', speed: 360, thrust: 75, pitch: 1.6, roll: 2.8, yaw: 0.5, hp: 1000, stealth: 0.3, corner: 190,
        missile: 'mt4', salvo: 2, style: 'ace', skill: 1.0, flares: 40, gun: 'g30', scale: 1.9, paint: 'boss6',
        intro: 'The final commander. Massive armor, swarm missiles, elite AI. End this war.' },
};

export const ENEMY_PAINTS = {
  red:   { base: '#6b3a32', second: '#3b2420', accent: '#d63a2a', pattern: 'camo' },
  sand:  { base: '#9c8a68', second: '#6b5c40', accent: '#c0392b', pattern: 'camo' },
  dark:  { base: '#3d4248', second: '#25292e', accent: '#e74c3c', pattern: 'splinter' },
  snow:  { base: '#c9d1d8', second: '#7b8794', accent: '#c0392b', pattern: 'splinter' },
  elite: { base: '#2a2a2a', second: '#c8a33a', accent: '#ffd25a', pattern: 'stripe' },
  boss1: { base: '#4a4f3a', second: '#2a2d20', accent: '#ff6a00', pattern: 'camo' },
  boss2: { base: '#8c1010', second: '#1a1a1a', accent: '#ff3030', pattern: 'tiger' },
  boss3: { base: '#14161a', second: '#22262c', accent: '#7f5cff', pattern: 'none' },
  boss4: { base: '#dcdcdc', second: '#3a6fd8', accent: '#00e0ff', pattern: 'stripe' },
  boss5: { base: '#0b0b0d', second: '#3a0b0b', accent: '#ff1e1e', pattern: 'splinter' },
  boss6: { base: '#3c2c14', second: '#c8a33a', accent: '#ffcc00', pattern: 'stripe' },
};

export const STYLES = {
  rookie:  { name: 'Rookie',   desc: 'Predictable pursuit, rarely evades.' },
  brawler: { name: 'Brawler',  desc: 'Loves close turning fights and guns.' },
  sniper:  { name: 'Sniper',   desc: 'Keeps distance, fires long-range missiles.' },
  energy:  { name: 'Boom & Zoom', desc: 'Dives from altitude, extends, repeats.' },
  ace:     { name: 'Ace',      desc: 'Adapts to your tactics. Mixes everything.' },
};

// ---------------------------------------------------------------- THEATERS / WEATHER
export const THEATERS = [
  { id: 'coast',   name: 'Coastal Patrol',  biome: 'islands',  weather: 'clear',    time: 'day',    desc: 'Clear skies over turquoise waters and scattered islands.' },
  { id: 'peaks',   name: 'Mountain Pass',   biome: 'mountains',weather: 'cloudy',   time: 'afternoon', desc: 'Jagged ridges and towering cumulus. Watch your altitude.' },
  { id: 'desert',  name: 'Desert Storm',    biome: 'desert',   weather: 'sandstorm',time: 'day',    desc: 'Canyon country. Dust storms cut visibility, crosswinds buffet your jet.' },
  { id: 'arctic',  name: 'Arctic Front',    biome: 'arctic',   weather: 'snow',     time: 'dusk',   desc: 'Frozen peaks under a low, snowing overcast.' },
  { id: 'storm',   name: 'Thunderhead',     biome: 'ocean',    weather: 'storm',    time: 'storm',  desc: 'A violent supercell. Rain, lightning and heavy turbulence.' },
  { id: 'night',   name: 'Black Sky',       biome: 'mountains',weather: 'night',    time: 'night',  desc: 'Moonlit night operations. Trust your radar.' },
];

function enemyTypeForLevel(n) {
  if (n <= 3) return 'gnat';
  if (n <= 8) return 'fishbed';
  if (n <= 13) return 'fulcrum';
  if (n <= 19) return 'flanker';
  if (n <= 25) return 'felon';
  return 'phantomE';
}
function missileForLevel(n) {
  if (n <= 5) return 'ir9';
  if (n <= 10) return n % 2 ? 'ir9' : 'ir9x';
  if (n <= 15) return n % 2 ? 'ir9x' : 'ar120';
  if (n <= 20) return n % 3 === 0 ? 'lr54' : 'ar120';
  if (n <= 25) return n % 2 ? 'hs7' : 'ar120';
  return n % 2 ? 'sm9' : 'hs7';
}
const STYLE_CYCLE = ['brawler', 'sniper', 'energy', 'brawler', 'ace'];
const THEATER_PAINT = ['red', 'dark', 'sand', 'snow', 'dark', 'dark'];

export const CAMPAIGN_LENGTH = 30;

export function levelDef(n) {
  const theaterIdx = Math.min(5, Math.floor((n - 1) / 5));
  const theater = n > CAMPAIGN_LENGTH ? THEATERS[(n * 7) % THEATERS.length] : THEATERS[theaterIdx];
  const k = (n - 1) % 5;
  const skill = Math.min(1, 0.12 + (n - 1) * 0.03);
  const over = Math.max(0, n - CAMPAIGN_LENGTH);
  const scale = 1 + over * 0.04;
  let enemy;
  if (BOSSES[n]) {
    const b = BOSSES[n];
    enemy = { ...b, boss: true, elite: false, flares: b.flares, missileCd: Math.max(2.5, 8 - b.skill * 5), gunDmgMul: 1.0 };
  } else {
    const typeId = enemyTypeForLevel(Math.min(n, 30));
    const t = ENEMY_TYPES[typeId];
    const elite = k === 2 && n > 6;
    const style = n <= 2 ? 'rookie' : STYLE_CYCLE[(n + theaterIdx) % STYLE_CYCLE.length];
    const sk = Math.min(1, skill + (elite ? 0.12 : 0)) ;
    enemy = {
      ...t,
      name: (elite ? 'Elite ' : '') + t.name,
      title: STYLES[style].name + ' pilot',
      hp: Math.round(t.hp * (elite ? 1.35 : 1) * scale),
      speed: t.speed * (1 + (k * 0.01)) * Math.min(1.25, scale),
      missile: missileForLevel(Math.min(n, 30)),
      salvo: 1,
      style, skill: Math.min(1, sk + over * 0.01),
      flares: n < 3 ? 0 : Math.round(4 + n * 0.8),
      gun: n < 9 ? 'g20' : n < 18 ? 'g25' : 'g30',
      missileCd: Math.max(3, 11 - sk * 7),
      gunDmgMul: 0.75 + n * 0.012,
      scale: 1, boss: false, elite,
      paint: elite ? 'elite' : THEATER_PAINT[theaterIdx],
    };
  }
  // late-game enemies scale up to match a fully upgraded player
  if (n >= 16) {
    const k = 1 + (Math.min(n, 40) - 15) * 0.018;
    enemy.pitch *= k; enemy.roll *= k; enemy.thrust *= k; enemy.speed *= 1 + (k - 1) * 0.5;
  }
  const baseCredits = 1500 + 800 * n;
  const baseXp = 250 + 140 * n;
  return {
    n, theater, enemy, boss: !!BOSSES[n], elite: enemy.elite,
    name: n > CAMPAIGN_LENGTH ? `Endless Sortie ${n - CAMPAIGN_LENGTH}` : `${theater.name} ${theaterIdx + 1}-${k + 1}`,
    credits: Math.round(baseCredits * (BOSSES[n] ? 2 : enemy.elite ? 1.4 : 1)),
    xp: Math.round(baseXp * (BOSSES[n] ? 1.8 : enemy.elite ? 1.3 : 1)),
  };
}

// ---------------------------------------------------------------- SPECIAL CHALLENGES
export const CHALLENGES = [
  { id: 'guns', name: 'Gunfight at Dawn', level: 4, credits: 9000, xp: 1400,
    desc: 'Guns only — no missiles for either side. Pure dogfighting.', rules: { noMissiles: true, enemyNoMissiles: true },
    enemyFrom: 7, enemyOverride: { style: 'brawler', name: 'Gunslinger', title: 'Gun-only duelist' }, theater: 0, timeOverride: 'dawn' },
  { id: 'glass', name: 'Glass Cannon', level: 7, credits: 13000, xp: 2000,
    desc: 'You start with 35% hull. One mistake and it is over.', rules: { playerHp: 0.35 },
    enemyFrom: 9, theater: 1 },
  { id: 'storm', name: 'Missile Storm', level: 9, credits: 16000, xp: 2400,
    desc: 'The enemy carries unlimited missiles and fires constantly. Survive and kill.', rules: { enemyMissileCd: 2.6 },
    enemyFrom: 11, theater: 4 },
  { id: 'blind', name: 'Blind Fury', level: 11, credits: 20000, xp: 2900,
    desc: 'Radar jammed. Find the enemy with your eyes in a night storm.', rules: { noRadar: true },
    enemyFrom: 13, theater: 5 },
  { id: 'speed', name: 'Speed Trap', level: 14, credits: 26000, xp: 3600,
    desc: 'Catch a hypersonic interceptor flown by an energy fighter.', rules: {},
    enemyFrom: 16, enemyOverride: { design: 'lancer', speed: 470, thrust: 100, pitch: 1.3, style: 'energy', missile: 'hs7', name: 'Mach Demon', title: 'Hypersonic interceptor' }, theater: 2 },
  { id: 'mirror', name: 'Mirror Match', level: 18, credits: 38000, xp: 5000,
    desc: 'Face an ace flying an exact copy of your jet and loadout.', rules: { mirror: true },
    enemyFrom: 24, enemyOverride: { style: 'ace', name: 'Doppelganger', title: 'Mirror ace' }, theater: 3 },
];

// ---------------------------------------------------------------- ACHIEVEMENTS
export const ACHIEVEMENTS = [
  { id: 'first', name: 'First Blood', desc: 'Win your first dogfight.', credits: 1000 },
  { id: 'ace5', name: 'Ace', desc: 'Score 5 kills.', credits: 3000 },
  { id: 'ace25', name: 'Ace of Aces', desc: 'Score 25 kills.', credits: 15000 },
  { id: 'boss1', name: 'Giant Slayer', desc: 'Defeat a boss aircraft.', credits: 5000 },
  { id: 'bossall', name: 'Sky Dominance', desc: 'Defeat all six bosses.', credits: 50000 },
  { id: 'nodmg', name: 'Untouchable', desc: 'Win a battle without taking damage.', credits: 6000 },
  { id: 'gunkill', name: 'Knife Fight', desc: 'Finish an enemy with guns.', credits: 2000 },
  { id: 'gun10', name: 'Gun Ace', desc: 'Score 10 gun kills.', credits: 10000 },
  { id: 'evade10', name: 'Slippery', desc: 'Evade 10 enemy missiles.', credits: 4000 },
  { id: 'evade50', name: 'Ghost', desc: 'Evade 50 enemy missiles.', credits: 15000 },
  { id: 'fast', name: 'Lightning Strike', desc: 'Win a battle in under 60 seconds.', credits: 5000 },
  { id: 'hangar3', name: 'Collector', desc: 'Own 3 aircraft.', credits: 5000 },
  { id: 'hangarall', name: 'Air Force', desc: 'Own every aircraft.', credits: 60000 },
  { id: 'maxup', name: 'Fully Loaded', desc: 'Max any upgrade on any aircraft.', credits: 4000 },
  { id: 'maneuver', name: 'Aerobat', desc: 'Use every maneuver type at least once.', credits: 8000 },
  { id: 'challenge', name: 'Challenger', desc: 'Complete a special challenge.', credits: 5000 },
  { id: 'challengeall', name: 'Legend', desc: 'Complete all special challenges.', credits: 40000 },
  { id: 'campaign', name: 'Campaign Victor', desc: 'Complete the 30-level campaign.', credits: 75000 },
  { id: 'lowalt', name: 'Nap of the Earth', desc: 'Win while flying under 150m for 10s in that battle.', credits: 4000 },
  { id: 'level10', name: 'Squadron Leader', desc: 'Reach pilot level 10.', credits: 8000 },
  { id: 'level20', name: 'Wing Commander', desc: 'Reach pilot level 20.', credits: 20000 },
];

// ---------------------------------------------------------------- CONTRACTS (rotating missions)
export const CONTRACT_TEMPLATES = [
  { kind: 'wins', text: n => `Win ${n} battle${n > 1 ? 's' : ''}`, amounts: [2, 3, 4] },
  { kind: 'gunkills', text: n => n > 1 ? `Destroy ${n} enemies with guns` : 'Destroy an enemy with guns', amounts: [1, 2] },
  { kind: 'missilehits', text: n => `Land ${n} missile hits`, amounts: [5, 8, 12] },
  { kind: 'evades', text: n => `Evade ${n} enemy missiles`, amounts: [3, 5, 8] },
  { kind: 'maneuvers', text: n => `Perform ${n} special maneuvers`, amounts: [5, 10, 15] },
  { kind: 'cleanwin', text: n => `Win ${n} battle${n > 1 ? 's' : ''} with over 70% hull`, amounts: [1, 2] },
  { kind: 'fastwin', text: n => `Win ${n} battle${n > 1 ? 's' : ''} in under 2 minutes`, amounts: [1, 2] },
  { kind: 'flares', text: n => `Decoy ${n} missiles with flares`, amounts: [2, 4, 6] },
];

export const RANKS = ['Cadet', 'Pilot Officer', 'Flying Officer', 'Flight Lieutenant', 'Squadron Leader', 'Wing Commander', 'Group Captain', 'Air Commodore', 'Air Vice-Marshal', 'Air Marshal'];
export function rankFor(level) { return RANKS[Math.min(RANKS.length - 1, Math.floor((level - 1) / 4))]; }
