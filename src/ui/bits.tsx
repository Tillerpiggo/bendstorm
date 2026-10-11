import type { CSSProperties, ReactNode } from 'react';
import { KEY_LABELS } from '../game/input';
import type { ElementId } from '../game/types';

/** Simple glyph per element, drawn in `currentColor`. */
export function ElementIcon({ id, size = 24 }: { id: ElementId; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true } as const;
  switch (id) {
    case 'fire':
      return (
        <svg {...common} fill="currentColor">
          <path d="M12.6 1.8c.6 3.6 5 5.7 5 10.9a5.6 5.6 0 0 1-11.2 0c0-2.1.9-3.5 2.1-4.7.1 2 .9 3.2 2 3.3-.5-3.7-.2-6.7 2.1-9.5z" />
        </svg>
      );
    case 'water':
      return (
        <svg {...common} fill="currentColor">
          <path d="M12 2.2c3.6 4.6 6.2 7.8 6.2 11.3a6.2 6.2 0 0 1-12.4 0c0-3.5 2.6-6.7 6.2-11.3z" />
        </svg>
      );
    case 'earth':
      return (
        <svg {...common} fill="currentColor">
          <path d="M2.5 19.5 8.3 8.8l3.3 5.1 2.7-4.4 7.2 10z" />
        </svg>
      );
    case 'air':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M3 9h10.5a3 3 0 1 0-3-3" />
          <path d="M3 13.5h14.5a3 3 0 1 1-3 3" />
          <path d="M3 18h6" />
        </svg>
      );
    case 'lightning':
      return (
        <svg {...common} fill="currentColor">
          <path d="M13.6 1.8 4.8 13.4h5.4l-1.7 8.8 9.7-12.4h-5.6z" />
        </svg>
      );
    case 'metal':
      return (
        <svg {...common} fill="currentColor">
          <path d="M12 2.2 20.5 7v10L12 21.8 3.5 17V7zm0 5.3a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z" fillRule="evenodd" />
        </svg>
      );
    case 'shadow':
      return (
        <svg {...common} fill="currentColor">
          <path d="M15.2 2.6a9.6 9.6 0 1 0 6.2 14.3A8 8 0 0 1 15.2 2.6z" />
        </svg>
      );
    case 'tyler':
      return (
        <svg {...common} fill="currentColor">
          <path d="M9.5 3.5 20 2v12.6a3.2 3.2 0 1 1-2-3V6.3l-6.5.9v9.9a3.2 3.2 0 1 1-2-3z" />
        </svg>
      );
    case 'cash':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M16.5 7.5c-.8-1.4-2.4-2.2-4.3-2.2-2.6 0-4.4 1.4-4.4 3.3 0 4.4 9.2 2 9.2 6.7 0 2-1.9 3.4-4.7 3.4-2.2 0-4-.9-4.8-2.5" />
          <path d="M12 2.5v19" />
        </svg>
      );
    case 'void':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none" />
          <path d="M3.4 12a8.6 3.6 -22 1 0 17.2 0a8.6 3.6 -22 1 0-17.2 0" />
        </svg>
      );
  }
}

export function Key({ children }: { children: ReactNode }) {
  return <kbd className="key">{children}</kbd>;
}

const ROWS: { label: string; keys: (p: 0 | 1) => ReactNode }[] = [
  {
    label: 'Move',
    keys: (p) => (
      <>
        <Key>{KEY_LABELS[p].left}</Key>
        <Key>{KEY_LABELS[p].right}</Key>
      </>
    ),
  },
  { label: 'Jump (again in the air, off the wall, or off the ledge)', keys: (p) => <Key>{KEY_LABELS[p].up}</Key> },
  { label: 'Fast-fall, drop through platforms', keys: (p) => <Key>{KEY_LABELS[p].down}</Key> },
  { label: 'Attack: shot, or a strike up close', keys: (p) => <Key>{KEY_LABELS[p].atk}</Key> },
  {
    label: 'Rising strike (tap both); hold up to aim high',
    keys: (p) => (
      <>
        <Key>{KEY_LABELS[p].up}</Key>+<Key>{KEY_LABELS[p].atk}</Key>
      </>
    ),
  },
  {
    label: 'Ground sweep, or dive in the air',
    keys: (p) => (
      <>
        <Key>{KEY_LABELS[p].down}</Key>+<Key>{KEY_LABELS[p].atk}</Key>
      </>
    ),
  },
  { label: 'Special: signature move', keys: (p) => <Key>{KEY_LABELS[p].spc}</Key> },
  {
    label: 'Side special',
    keys: (p) => (
      <>
        <Key>{KEY_LABELS[p].left}</Key>/<Key>{KEY_LABELS[p].right}</Key>+<Key>{KEY_LABELS[p].spc}</Key>
      </>
    ),
  },
  {
    label: 'Down special',
    keys: (p) => (
      <>
        <Key>{KEY_LABELS[p].down}</Key>+<Key>{KEY_LABELS[p].spc}</Key>
      </>
    ),
  },
  {
    label: 'Recovery leap',
    keys: (p) => (
      <>
        <Key>{KEY_LABELS[p].up}</Key>+<Key>{KEY_LABELS[p].spc}</Key>
      </>
    ),
  },
  { label: 'Guard: hold to shield, tap just in time to parry', keys: (p) => <Key>{KEY_LABELS[p].grd}</Key> },
  {
    label: 'Dash (dodges through hits)',
    keys: (p) => (
      <>
        <Key>{KEY_LABELS[p].left}</Key>/<Key>{KEY_LABELS[p].right}</Key>+<Key>{KEY_LABELS[p].grd}</Key>
      </>
    ),
  },
  { label: 'Taunt (hold a direction or down for others)', keys: (p) => <Key>{KEY_LABELS[p].taunt}</Key> },
  {
    label: 'Ultimate, when Spirit is full',
    keys: (p) => (
      <>
        <Key>{KEY_LABELS[p].atk}</Key>+<Key>{KEY_LABELS[p].spc}</Key>
      </>
    ),
  },
];

/** The full move list for both players, side by side. */
export function ControlsSheet({ p2Label = 'Player 2' }: { p2Label?: string }) {
  return (
    <div className="controls">
      <div className="controls-head">
        <span className="p1c">Player 1</span>
        <span />
        <span className="p2c">{p2Label}</span>
      </div>
      {ROWS.map((r) => (
        <div className="controls-row" key={r.label}>
          <span className="controls-keys">{r.keys(0)}</span>
          <span className="controls-label">{r.label}</span>
          <span className="controls-keys right">{r.keys(1)}</span>
        </div>
      ))}
    </div>
  );
}

export const elVars = (color: string, glow: string): CSSProperties => ({ '--el': color, '--el-glow': glow }) as CSSProperties;
