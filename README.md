# Bendstorm

A two-player elemental platform fighter for one keyboard. Pick a bender, pile damage onto the other one, and blast them off the stage.

Built with React 19, three.js and react-three-fiber. The graphics and sound effects are generated in code; the music plays recorded instruments from `public/audio` (all CC0, credited in `public/audio/CREDITS.md`).

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5273.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 5273 |
| `npm run build` | Type-check, then production build into `dist/` |
| `npm test` | Simulation tests (no browser needed) |

## How to play

Damage is a percentage that only goes up. The higher it is, the further every hit sends you. Cross the edge of the screen and you lose a stock; run out and the match is over.

| | Player 1 | Player 2 |
| --- | --- | --- |
| Move | `A` `D` | `←` `→` |
| Jump (again in the air, off the stage wall, or off the ledge) | `W` | `↑` |
| Fast-fall, drop through a platform | `S` | `↓` |
| Attack: a shot, or a harder strike at point-blank range | `F` | `,` |
| Rising strike (tap both together) | `W` + `F` | `↑` + `,` |
| Aim the shot upward (hold up, then attack) | `W` then `F` | `↑` then `,` |
| Ground sweep, or dive in the air | `S` + `F` | `↓` + `,` |
| Special | `G` | `.` |
| Side special | direction + `G` | direction + `.` |
| Down special | `S` + `G` | `↓` + `.` |
| Recovery leap | `W` + `G` | `↑` + `.` |
| Guard: hold to shield, raise it just before impact to parry | `H` | `/` |
| Dash (dodges through hits) | direction + `H` | direction + `/` |
| Ultimate, when Spirit is full | `F` + `G` | `,` + `.` |
| Taunt (hold a direction or down for the other two) | `T` | `L` |

`Esc` pauses, `M` mutes. Gamepad support is wired up (pad 1 is Player 1, pad 2 is Player 2) but has not been tested on real hardware.

Things worth knowing:

- **Shots come in bursts.** Each bender has a few shots (the pips on their card) that only refill once they stop firing. Out of shots, the attack is still a point-blank strike.
- **Repeating a move weakens it.** Landing the same move over and over does less each time; mixing moves brings it back.
- **You cannot be locked down.** Take enough hits in a row and you burst free, untouchable for a moment.
- **The three specials share one cooldown.**
- **Ledges.** Fall past the lip of the main stage and you catch it. From there: toward the stage to climb, jump to leap off, attack for a getup attack, guard to roll in, down or away to let go. Only one fighter fits on a ledge.
- **Parry.** A shield raised just before impact costs nothing: shots bounce back, strikes stagger the attacker.
- **Taunts pay.** Finish one uninterrupted and you gain Spirit, more if the opponent is mid-respawn.
- On the select screen, `W`/`S` pick the arena, `1`-`5` set stocks, and `Tab` sets CPU strength.

### The benders

| | Plays like | Special / side / down | Ultimate |
| --- | --- | --- | --- |
| **Ember** (fire) | Fast shots, constant pressure | Dragon Dash / Flame Stream / Ember Mine | Inferno Lance: a beam down the whole lane |
| **Tide** (water) | Shots that curve toward the target | Tidal Wave / Water Whip (pulls them in) / Healing Tide | Leviathan Surge: a tsunami |
| **Terra** (earth) | Slow, heavy, hits hardest | Stone Pillar / Stone Wall / Seismic Stomp | Tectonic Wake: pillars on every platform |
| **Gale** (air) | Three jumps, very light | Cyclone / Gale Force (shove, reflects shots) / Updraft | Tempest: drags them in and throws them up |
| **Volt** (lightning) | Instant hitscan attack | Blink Strike (teleports behind them) / Ball Lightning / Storm Call | Thunderstorm: the sky hunts them |
| **Flux** (metal) | Discs that return, heavy | Magnet Zip / Shrapnel / Iron Skin (cannot be moved) | Magnet Crush. Recovery is a tether to the ledge |
| **Umbra** (shadow) | Shots that pass through walls | Swap (trade places) / Decoy / Sink (untouchable) | Nightmare: their left and right are reversed |
| **Rift** (void) | Shots knock toward him | Portal / Gravity Flip / Singularity | Event Horizon: a black hole |
| **Tyler** (the Tylerbender) | A firehose of wrong notes | Deep Fry (lag cloud) / Piano Toss / Gremlin | Shitstorm |
| **Kash** (the Kashmoneybender) | Stacks, every fourth a gold bar | Midas Touch / Joyride / Loose Change | Bust Down: they dance, then the vault lands |

### The arenas

| Arena | What it does |
| --- | --- |
| **Sunset Temple** | Three platforms that never sit still |
| **Aurora Glacier** | Sheet ice, sliding shelves, falling icicles |
| **Ember Crater** | A small island; lava erupts through the gaps |
| **Storm Carousel** | Four platforms wheel around a tiny floor while lightning takes shots at you |
| **Hollow Rift** | Low gravity, and the sides wrap around: only up and down kill |
| **The Foundry** | A conveyor floor that reverses, crumbling platforms, live vents |

Hazards are telegraphed, hit whoever is standing there, and give nobody credit.

## How it is put together

```
src/game/    The fight itself. Pure TypeScript, fixed 120 Hz steps, no DOM or three.js.
  sim.ts       Fighters, moves, hit detection, knockback, stocks, arena dynamics. Emits events.
  elements.ts  Per-bender stats, colours and move names.
  stage.ts     Each arena's platforms, motion and rules (looks live in scene/themes.ts).
  bot.ts       CPU player. Drives the same input interface a human does.
  input.ts     Keyboard and gamepad → one InputFrame per player per step.
src/fx/      Presentation that is not React: particles, camera shake, sound effects, the score.
  music.ts     Step sequencer, per-bender themes and the adaptive match score (see its header).
src/scene/   react-three-fiber scene. Reads sim state every frame; never writes it.
src/ui/      DOM menus and HUD.
```

The one rule: `src/game` decides what happens, everything else only shows it. The scene and HUD read fighter fields directly each frame and react to the sim's event list, so the same simulation runs in the browser, in the title screen's bot-vs-bot fight, and in `npm test`.

### Adding a bender

1. Add the id to `ElementId` in `game/types.ts` and an entry in `game/elements.ts`.
2. In `game/sim.ts`, add a case to `updateSpecial`, `updateSide`, `updateDown` and `updateUlt`, plus entries in `SPECIAL_CD` and `SPECIAL_DUR`. TypeScript will point at the tables you missed.
3. Give it a look: `HeadGear` and poses in `scene/FighterModel.tsx`, shot colours in `scene/Entities.tsx`, an icon in `ui/bits.tsx`, a `shoot` sound in `fx/audio.ts`.
4. Teach the CPU when to use each special in `Bot.special`.

### Tuning

Move damage and knockback live at the top of `game/sim.ts` (`HitSpec` constants) and in `game/elements.ts`. Knockback speed is `(base + growth × damage / 100) / weight`. The test `kill percents sit in a Smash-like range` prints the damage at which each move kills.

### Testing in a browser

`window.__bendstorm` holds the current session, so from the console you can do things like `__bendstorm.game.fighters[0].meter = 100`.

For automated checks, headless Chromium with `--use-angle=swiftshader` renders the scene, but only at a few frames per second. Wait on game time (`__bendstorm.game.time`) rather than wall-clock time, or step the sim directly with `game.step(...)`. Tests that are not about the arena pass `still: true` to `Game` so platforms and hazards hold still.
