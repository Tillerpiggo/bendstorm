import { useEffect, useRef, useState } from 'react';
import { audio } from '../fx/audio';
import type { Game } from '../game/sim';
import { ControlsSheet, ElementIcon, elVars } from './bits';

interface MenuOption {
  id: string;
  label: string;
  /** Extra KeyboardEvent.code that triggers this option directly. */
  hotkey?: string;
  hotkeyLabel?: string;
  run: () => void;
}

/**
 * A vertical list driven by W/S or the arrows, confirmed with Enter or Space.
 * Attack keys never confirm, and `armMs` ignores input briefly after opening,
 * so players still mashing from the fight can't dismiss a screen by accident.
 */
function useMenu(options: MenuOption[], onEscape?: () => void, armMs = 0): [number, (i: number) => void] {
  const [sel, setSel] = useState(0);
  const live = useRef({ options, sel, onEscape });
  live.current = { options, sel, onEscape };
  useEffect(() => {
    const armedAt = performance.now() + armMs;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || performance.now() < armedAt) return;
      const { options: opts, sel: s, onEscape: esc } = live.current;
      const n = opts.length;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        setSel((s + n - 1) % n);
        audio.uiMove();
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        setSel((s + 1) % n);
        audio.uiMove();
      } else if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        audio.uiConfirm();
        opts[s].run();
      } else if (e.code === 'Escape' && esc) {
        audio.uiBack();
        esc();
      } else {
        const hit = opts.find((o) => o.hotkey === e.code);
        if (hit) {
          audio.uiConfirm();
          hit.run();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [armMs]);
  return [sel, setSel];
}

function MenuList({ options, sel, setSel }: { options: MenuOption[]; sel: number; setSel: (i: number) => void }) {
  return (
    <nav className="menu compact">
      {options.map((o, i) => (
        <button
          key={o.id}
          id={o.id}
          type="button"
          className={`menu-item${sel === i ? ' is-sel' : ''}`}
          onMouseEnter={() => setSel(i)}
          onClick={() => {
            audio.uiConfirm();
            o.run();
          }}
        >
          <span className="menu-label">{o.label}</span>
          {o.hotkeyLabel && <kbd className="key sm">{o.hotkeyLabel}</kbd>}
        </button>
      ))}
    </nav>
  );
}

interface PauseProps {
  p2Label: string;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

export function Pause({ p2Label, onResume, onRestart, onQuit }: PauseProps) {
  const options: MenuOption[] = [
    { id: 'pause-resume', label: 'Resume', hotkeyLabel: 'Esc', run: onResume },
    { id: 'pause-restart', label: 'Restart match', hotkey: 'KeyR', hotkeyLabel: 'R', run: onRestart },
    { id: 'pause-quit', label: 'Quit to title', hotkey: 'KeyQ', hotkeyLabel: 'Q', run: onQuit },
  ];
  const [sel, setSel] = useMenu(options, onResume);
  return (
    <div className="screen overlay" role="dialog" aria-label="Paused">
      <div className="overlay-box panel">
        <h2 className="overlay-title">Paused</h2>
        <MenuList options={options} sel={sel} setSel={setSel} />
        <ControlsSheet p2Label={p2Label} />
      </div>
    </div>
  );
}

interface ResultsProps {
  game: Game;
  labels: [string, string];
  onRematch: () => void;
  onChange: () => void;
  onQuit: () => void;
}

export function Results({ game, labels, onRematch, onChange, onQuit }: ResultsProps) {
  const options: MenuOption[] = [
    { id: 'results-rematch', label: 'Rematch', hotkeyLabel: 'Enter', run: onRematch },
    { id: 'results-change', label: 'Change benders', hotkey: 'KeyC', hotkeyLabel: 'C', run: onChange },
    { id: 'results-quit', label: 'Title screen', hotkeyLabel: 'Esc', run: onQuit },
  ];
  const [sel, setSel] = useMenu(options, onQuit, 700);
  const w = game.winner < 0 ? 0 : game.winner;
  const winner = game.fighters[w];
  const rows: [string, (i: number) => string][] = [
    ['KOs', (i) => String(game.fighters[i].kos)],
    ['Damage dealt', (i) => `${Math.round(game.fighters[i].dealt)}%`],
    ['Best combo', (i) => String(game.fighters[i].bestCombo)],
    ['Stocks left', (i) => String(game.fighters[i].stocks)],
  ];
  return (
    <div className="screen results" role="dialog" aria-label="Results">
      <div className="results-box" style={elVars(winner.el.color, winner.el.glow)}>
        <p className="eyebrow">
          <span className={`p${w + 1}c`}>{labels[w]}</span> · {winner.el.title}
        </p>
        <h2 className="results-title">
          <ElementIcon id={winner.el.id} size={56} />
          {winner.el.name} wins
        </h2>
        <table className="results-table panel">
          <thead>
            <tr>
              <th className="p1c">
                {labels[0]} {game.fighters[0].el.name}
              </th>
              <th />
              <th className="p2c">
                {labels[1]} {game.fighters[1].el.name}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, get]) => (
              <tr key={label}>
                <td>{get(0)}</td>
                <th scope="row">{label}</th>
                <td>{get(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MenuList options={options} sel={sel} setSel={setSel} />
    </div>
  );
}
