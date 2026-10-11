/**
 * Keyboard + gamepad → InputFrame, one per player per sim step.
 *
 * Presses are latched on keydown and held until the next sim step consumes
 * them, so a tap shorter than a frame is never lost and a press is only ever
 * delivered once even when several sim steps run in one render frame.
 */
import { emptyPad, type InputFrame, type Pad } from './types';

type Key = keyof Pad;
const KEYS: Key[] = ['left', 'right', 'up', 'down', 'atk', 'spc', 'grd', 'taunt'];

/** KeyboardEvent.code per button, so layouts other than QWERTY keep the same physical keys. */
export const KEYMAP: [Record<Key, string>, Record<Key, string>] = [
  { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS', atk: 'KeyF', spc: 'KeyG', grd: 'KeyH', taunt: 'KeyT' },
  {
    left: 'ArrowLeft',
    right: 'ArrowRight',
    up: 'ArrowUp',
    down: 'ArrowDown',
    atk: 'Comma',
    spc: 'Period',
    grd: 'Slash',
    taunt: 'KeyL',
  },
];

/** What to print on a keycap for each button. */
export const KEY_LABELS: [Record<Key, string>, Record<Key, string>] = [
  { left: 'A', right: 'D', up: 'W', down: 'S', atk: 'F', spc: 'G', grd: 'H', taunt: 'T' },
  { left: '←', right: '→', up: '↑', down: '↓', atk: ',', spc: '.', grd: '/', taunt: 'L' },
];

const GAME_CODES = new Set<string>([...Object.values(KEYMAP[0]), ...Object.values(KEYMAP[1]), 'Space']);

const held = new Set<string>();
const pressed = new Set<string>();
const padHeld: [Pad, Pad] = [emptyPad(), emptyPad()];
const padPressed: [Pad, Pad] = [emptyPad(), emptyPad()];

function onKeyDown(e: KeyboardEvent): void {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (GAME_CODES.has(e.code)) e.preventDefault();
  if (e.repeat) return;
  held.add(e.code);
  pressed.add(e.code);
}

function onKeyUp(e: KeyboardEvent): void {
  held.delete(e.code);
}

function onBlur(): void {
  held.clear();
  pressed.clear();
}

/** Starts listening. Returns the cleanup function. */
export function attachInput(): () => void {
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    onBlur();
  };
}

/** Reads connected gamepads (pad 0 → P1, pad 1 → P2). Call once per render frame. */
export function pollGamepads(): void {
  const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
  for (let i = 0; i < 2; i++) {
    const gp = pads[i];
    const prev = padHeld[i];
    const now = emptyPad();
    if (gp && gp.connected) {
      const b = (n: number) => !!gp.buttons[n]?.pressed;
      const ax = gp.axes[0] ?? 0;
      const ay = gp.axes[1] ?? 0;
      now.left = ax < -0.4 || b(14);
      now.right = ax > 0.4 || b(15);
      now.up = ay < -0.6 || b(12) || b(0);
      now.down = ay > 0.6 || b(13);
      now.atk = b(2);
      now.spc = b(3) || b(1);
      now.grd = b(4) || b(5) || b(6) || b(7);
      now.taunt = b(8) || b(9);
    }
    for (const k of KEYS) if (now[k] && !prev[k]) padPressed[i][k] = true;
    padHeld[i] = now;
  }
}

export function sampleInput(player: 0 | 1): InputFrame {
  const map = KEYMAP[player];
  const gh = padHeld[player];
  const gp = padPressed[player];
  const p = (k: Key) => pressed.has(map[k]) || gp[k];
  // A key tapped and released between two sim steps still counts as held for the
  // step that sees its press, so quick direction+button combos are never dropped.
  const h = (k: Key) => held.has(map[k]) || gh[k] || p(k);
  return {
    left: h('left'),
    right: h('right'),
    up: h('up'),
    down: h('down'),
    atk: h('atk'),
    spc: h('spc'),
    grd: h('grd'),
    taunt: h('taunt'),
    upP: p('up'),
    downP: p('down'),
    atkP: p('atk'),
    spcP: p('spc'),
    grdP: p('grd'),
    tauntP: p('taunt'),
  };
}

/** Marks every latched press as delivered. Call after each sim step. */
export function endInputStep(): void {
  pressed.clear();
  for (const g of padPressed) for (const k of KEYS) g[k] = false;
}
