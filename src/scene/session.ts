import { Bot } from '../game/bot';
import { Game } from '../game/sim';
import type { StageId } from '../game/stage';
import type { ElementId } from '../game/types';

export type Controller = 'human' | 'cpu' | 'none';
/** attract = bots fighting behind the title; preview = fighters posing on the select screen. */
export type SessionKind = 'attract' | 'preview' | 'match';

/** The choices made on the select screen. */
export interface Rules {
  elements: [ElementId, ElementId];
  stage: StageId;
  stocks: number;
  /** CPU strength: 0 easy, 1 normal, 2 hard. */
  level: number;
}

/** One Game plus who is driving each fighter. The scene remounts per session via `key`. */
export interface Session {
  key: number;
  kind: SessionKind;
  game: Game;
  rules: Rules;
  controllers: [Controller, Controller];
  bots: [Bot | null, Bot | null];
}

export const CPU_LEVELS = ['Easy', 'Normal', 'Hard'] as const;
const SKILL = [0.35, 0.7, 1];

let nextKey = 1;

export function makeSession(kind: SessionKind, rules: Rules, controllers: [Controller, Controller]): Session {
  const seed = Math.floor(Math.random() * 1e9) + 1;
  const game = new Game({ elements: rules.elements, stage: rules.stage, stocks: rules.stocks, seed, intro: kind === 'match' });
  if (kind === 'preview') {
    // Stand the two picks close together, centre stage, between the select panels.
    game.fighters[0].x = -1.7;
    game.fighters[1].x = 1.7;
  }
  const skill = kind === 'attract' ? 0.85 : SKILL[rules.level] ?? 0.7;
  const bot = (i: number) => (controllers[i] === 'cpu' ? new Bot(seed + 977 * (i + 1), skill) : null);
  return { key: nextKey++, kind, game, rules: { ...rules, elements: [...rules.elements] }, controllers, bots: [bot(0), bot(1)] };
}

export const PLAYER_COLORS = ['#ff5a6e', '#4cc9ff'] as const;
