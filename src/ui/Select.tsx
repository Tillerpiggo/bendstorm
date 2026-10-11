import { useEffect, useRef, useState } from 'react';
import { audio } from '../fx/audio';
import { ELEMENT_IDS, ELEMENTS } from '../game/elements';
import { KEY_LABELS } from '../game/input';
import { STAGE_IDS, STAGES } from '../game/stage';
import type { ElementId } from '../game/types';
import { CPU_LEVELS, type Rules } from '../scene/session';
import { ElementIcon, elVars, Key } from './bits';

interface Props {
  cpu: boolean;
  rules: Rules;
  onRules: (r: Rules) => void;
  onStart: () => void;
  onBack: () => void;
}

const STATS = [
  ['power', 'Power'],
  ['speed', 'Speed'],
  ['weight', 'Weight'],
  ['reach', 'Reach'],
] as const;

const cycle = <T,>(list: readonly T[], cur: T, delta: number): T => list[(list.indexOf(cur) + delta + list.length) % list.length];

export function Select({ cpu, rules, onRules, onStart, onBack }: Props) {
  // The CPU is always "ready"; its element can still be changed with the arrow keys.
  const [locked, setLocked] = useState<[boolean, boolean]>([false, cpu]);
  const state = useRef({ rules, locked });
  state.current = { rules, locked };
  const picks = rules.elements;

  const setPick = (player: 0 | 1, id: ElementId) => {
    const s = state.current;
    if (s.locked[player] && !(cpu && player === 1)) return;
    const elements: [ElementId, ElementId] = [s.rules.elements[0], s.rules.elements[1]];
    elements[player] = id;
    audio.uiMove();
    onRules({ ...s.rules, elements });
  };
  const move = (player: 0 | 1, delta: number) => setPick(player, cycle(ELEMENT_IDS, state.current.rules.elements[player], delta));
  const lock = (player: 0 | 1, on: boolean) => {
    if (cpu && player === 1) return;
    if (state.current.locked[player] === on) return;
    if (on) audio.uiConfirm();
    else audio.uiBack();
    setLocked((l) => (player === 0 ? [on, l[1]] : [l[0], on]));
  };
  const change = (patch: Partial<Rules>) => {
    audio.uiMove();
    onRules({ ...state.current.rules, ...patch });
  };
  const stage = (delta: number) => change({ stage: cycle(STAGE_IDS, state.current.rules.stage, delta) });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      switch (e.code) {
        case 'KeyA':
          move(0, -1);
          break;
        case 'KeyD':
          move(0, 1);
          break;
        case 'KeyF':
        case 'Space':
          e.preventDefault();
          lock(0, true);
          break;
        case 'KeyG':
          lock(0, false);
          break;
        case 'ArrowLeft':
          move(1, -1);
          break;
        case 'ArrowRight':
          move(1, 1);
          break;
        case 'Comma':
        case 'Enter':
          // In a CPU match Enter is the solo player's confirm.
          lock(cpu ? 0 : 1, true);
          break;
        case 'Period':
          lock(1, false);
          break;
        case 'KeyW':
        case 'ArrowUp':
          stage(-1);
          break;
        case 'KeyS':
        case 'ArrowDown':
          stage(1);
          break;
        case 'Tab':
          e.preventDefault();
          if (cpu) change({ level: (state.current.rules.level + 1) % CPU_LEVELS.length });
          break;
        case 'Escape':
          audio.uiBack();
          onBack();
          break;
        default:
          if (/^Digit[1-5]$/.test(e.code)) change({ stocks: Number(e.code.slice(5)) });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // The handlers read live values through `state`, so binding once per mode is enough.
  }, [cpu, onBack]);

  const ready = locked[0] && locked[1];
  useEffect(() => {
    if (!ready) return;
    const id = window.setTimeout(onStart, 700);
    return () => window.clearTimeout(id);
  }, [ready, onStart]);

  const arena = STAGES[rules.stage];

  return (
    <div className="screen select">
      <header className="select-head">
        <p className="eyebrow">{cpu ? 'Versus CPU' : '2 Players'}</p>
        <h2 className="select-title">{ready ? 'Get ready' : 'Choose your element'}</h2>
      </header>

      <div className="select-cols">
        {([0, 1] as const).map((p) => {
          const el = ELEMENTS[picks[p]];
          const isCpu = cpu && p === 1;
          const k = KEY_LABELS[p];
          return (
            <section key={p} className={`panel pick p${p + 1}${locked[p] ? ' is-locked' : ''}`} style={elVars(el.color, el.glow)}>
              <div className="pick-top">
                <span className={`tag p${p + 1}c`}>{isCpu ? 'CPU' : `Player ${p + 1}`}</span>
                <span className="pick-state">{isCpu ? 'Ready' : locked[p] ? 'Locked in' : 'Choosing'}</span>
              </div>

              <div className="chips" role="radiogroup" aria-label={`Player ${p + 1} element`}>
                {ELEMENT_IDS.map((id) => (
                  <button
                    key={id}
                    id={`pick-p${p + 1}-${id}`}
                    type="button"
                    role="radio"
                    aria-checked={picks[p] === id}
                    className={`chip${picks[p] === id ? ' is-on' : ''}`}
                    style={elVars(ELEMENTS[id].color, ELEMENTS[id].glow)}
                    onClick={() => setPick(p, id)}
                  >
                    <ElementIcon id={id} size={26} />
                    <span>{id}</span>
                  </button>
                ))}
              </div>

              <h3 className="pick-name">{el.name}</h3>
              <p className="pick-title">{el.title}</p>
              <p className="pick-tagline">{el.tagline}</p>

              <dl className="stats">
                {STATS.map(([key, label]) => (
                  <div className="stat" key={key}>
                    <dt>{label}</dt>
                    <dd aria-label={`${el.stats[key]} of 5`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <i key={n} className={n <= el.stats[key] ? 'on' : ''} />
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>

              <ul className="moves">
                <li>
                  <b>Attack</b> {el.moves.bolt}
                </li>
                <li title={el.moves.specialHint}>
                  <b>Special</b> {el.moves.special}
                </li>
                <li title={el.moves.sideHint}>
                  <b>
                    <i>←→</i> +
                  </b>{' '}
                  {el.moves.side}
                </li>
                <li title={el.moves.downHint}>
                  <b>
                    <i>↓</i> +
                  </b>{' '}
                  {el.moves.down}
                </li>
                <li title={el.moves.ultHint}>
                  <b>Ultimate</b> {el.moves.ult}
                </li>
              </ul>

              <div className="pick-foot">
                {isCpu ? (
                  <span>
                    <Key>←</Key>
                    <Key>→</Key> change the CPU's element
                  </span>
                ) : locked[p] ? (
                  <button id={`unlock-p${p + 1}`} type="button" className="link" onClick={() => lock(p, false)}>
                    <Key>{k.spc}</Key> change
                  </button>
                ) : (
                  <>
                    <span>
                      <Key>{k.left}</Key>
                      <Key>{k.right}</Key> choose
                    </span>
                    <button id={`lock-p${p + 1}`} type="button" className="btn" onClick={() => lock(p, true)}>
                      <Key>{k.atk}</Key> Lock in
                    </button>
                  </>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <footer className="select-foot">
        <div className="rules panel">
          <div className="rule">
            <span className="rule-label">
              Arena <Key>W</Key>
              <Key>S</Key>
            </span>
            <div className="rule-row">
              <button id="arena-prev" type="button" className="step" aria-label="Previous arena" onClick={() => stage(-1)}>
                ‹
              </button>
              <span className="rule-value">{arena.name}</span>
              <button id="arena-next" type="button" className="step" aria-label="Next arena" onClick={() => stage(1)}>
                ›
              </button>
            </div>
            <span className="rule-note">{arena.blurb}</span>
          </div>
          <div className="rule">
            <span className="rule-label">
              Stocks <Key>1</Key>–<Key>5</Key>
            </span>
            <div className="rule-row">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  id={`stocks-${n}`}
                  type="button"
                  className={`pip${n <= rules.stocks ? ' is-on' : ''}`}
                  aria-label={`${n} stocks`}
                  aria-pressed={n === rules.stocks}
                  onClick={() => change({ stocks: n })}
                />
              ))}
            </div>
          </div>
          {cpu && (
            <div className="rule">
              <span className="rule-label">
                CPU <Key>Tab</Key>
              </span>
              <div className="rule-row">
                {CPU_LEVELS.map((name, i) => (
                  <button
                    key={name}
                    id={`cpu-${name.toLowerCase()}`}
                    type="button"
                    className={`seg${rules.level === i ? ' is-on' : ''}`}
                    aria-pressed={rules.level === i}
                    onClick={() => change({ level: i })}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <button id="select-back" type="button" className="link" onClick={onBack}>
          <kbd className="key sm">Esc</kbd> back
        </button>
      </footer>
    </div>
  );
}
