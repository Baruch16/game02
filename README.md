# SKY DOMINANCE

A 3D one-on-one fighter jet combat game for the browser, built with [three.js](https://threejs.org/) and plain ES modules. It has no build step and no asset files: models, terrain, clouds, textures and sound are all generated in code.

## Play

Serve the folder over HTTP (ES modules don't load from `file://`) and open `index.html`:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Progress saves automatically to `localStorage`.

## Controls

| Key | Action |
| --- | --- |
| W / S (or ↑ / ↓) | Pitch (S pulls the nose up; can be inverted in Settings) |
| A / D (or ← / →) | Roll |
| Q / E | Rudder (yaw) |
| Shift | Afterburner |
| X | Air brake |
| Space / left mouse | Gun |
| F / right mouse | Fire missile |
| R / Tab | Switch missile type |
| G | Flares / chaff |
| 1–4 | Special maneuvers |
| V | Chase / cockpit camera |
| C (hold) | Look at the enemy |
| Esc / P | Pause |

Gamepads work too: left stick to fly, RT gun, A missile, LB flares, RB afterburner, LT brake, D-pad for maneuvers.

## Features

- **Dogfights:** arcade flight with energy management (corner speed, stalls, bleeding speed in hard turns), lock-on missiles with proportional guidance, proximity fuses, flares and chaff, gun lead pipper with light aim assist, cannon overheat, mid-air collisions, wrecks that fall and burn, and a slow-motion kill cam.
- **Enemy AI:** a state machine (pursue, evade, defend, extend, climb, terrain avoidance) with five tactical styles: Rookie, Brawler, Sniper, Boom & Zoom, and Ace. Pilot skill sets reaction time, aim, flare discipline, missile timing and access to maneuvers. Enemies adapt during a battle: they flare earlier after seeing your launches, switch to vertical defense if you camp their six, jink against your guns, and attempt reversals.
- **Campaign:** 30 levels across 6 theaters (Coastal Patrol, Mountain Pass, Desert Storm, Arctic Front, Thunderhead, Black Sky). Each theater has its own terrain, weather and lighting: clear, cloudy, sandstorm, snow, a thunderstorm with lightning and turbulence, and night. There are elite pilots, a boss every 5 levels (LEVIATHAN, RED VIPER, SPECTRE, VALKYRIE, BLACK WYVERN, OVERLORD), and endless sorties after level 30.
- **Hangar:** 8 aircraft with distinct traits: forgiving trainer, agile multirole, armored high-AoA carrier jet, interceptor, air-superiority fighter, thrust-vectoring supermaneuverable jet, stealth fighter, and a 6th-gen prototype with a regenerating shield. It also has stat comparison bars and 10 paint schemes.
- **Upgrades:** engine, afterburner, fly-by-wire, armor, radar and weapon systems, 5 levels each, bought per aircraft.
- **Armory:** 4 guns, 7 missiles (heat-seeking, advanced IR, radar, long-range, hypersonic, multi-target swarm that also intercepts incoming missiles, and a smart dual-seeker), plus 4 tracking-system upgrades. Equip a primary and a secondary missile, which share the airframe's payload capacity.
- **Maneuvers:** High-G Turn, Barrel Roll, Immelmann, Split-S, Emergency Break, Cobra, Afterburner Surge and Ghost Jink. Each one has a real tactical effect, such as making a chaser overshoot, breaking missile locks, or trading altitude for speed. You choose 4 for your slots.
- **Pilot progression:** XP and levels unlock gear. Skill points go into a 20-node talent tree with four branches (Gunner, Missileer, Survivor, Tactician), and you can reset it for a fee.
- **Meta:** rotating contracts, 21 achievements, 6 special challenges (guns-only, glass cannon, missile storm, radar jammed, hypersonic target, mirror match), per-mission star ratings and a pilot statistics page.

## Code layout

```
index.html          entry point
css/style.css       military-style UI
js/main.js          renderer, render loop, menu showroom
js/data.js          all game data: aircraft, weapons, maneuvers, talents, campaign, bosses
js/save.js          profile persistence, shop logic, derived stats, rewards
js/battle.js        dogfight simulation: weapons, missiles, flares, damage, camera, scoring
js/aircraft.js      flight model + steering helper
js/ai.js            enemy pilot AI
js/maneuvers.js     scripted special maneuvers
js/world.js         sky, terrain, ocean, clouds, weather, lighting
js/models.js        procedural jet models and paint textures
js/fx.js            instanced particle systems, tracers
js/hud.js           combat HUD (radar, tapes, lock, warnings)
js/ui.js            menus, shops, mission select, results
js/audio.js         procedural WebAudio sound
js/input.js         keyboard / mouse / gamepad
js/vendor/          three.js r170 (MIT)
```
