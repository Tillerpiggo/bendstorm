import { useEffect, useRef, useState } from 'react';
import { audio } from '../fx/audio';
import { ControlsSheet } from './bits';

const OPTIONS = [
  { id: 'pvp', label: '2 Players', hint: 'Same keyboard. WASD against the arrow keys.' },
  { id: 'cpu', label: 'Versus CPU', hint: 'You on WASD against a computer bender.' },
] as const;

export function Title({ onStart }: { onStart: (cpu: boolean) => void }) {
  const [sel, setSel] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const selRef = useRef(sel);
  selRef.current = sel;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
        case 'ArrowDown':
        case 'KeyS':
          setSel((s) => 1 - s);
          audio.uiMove();
          break;
        case 'Enter':
        case 'Space':
        case 'KeyF':
          e.preventDefault();
          audio.uiConfirm();
          onStart(selRef.current === 1);
          break;
        case 'KeyC':
          setShowControls((v) => !v);
          audio.uiMove();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStart]);

  return (
    <div className="screen title">
      <div className="title-scrim" />
      <header className="title-head">
        <p className="eyebrow">An elemental platform fighter</p>
        <h1 className="logo" aria-label="Bendstorm">
          <span>BEND</span>
          <span>STORM</span>
        </h1>
        <p className="title-tag">Four elements. Two benders. One keyboard.</p>
      </header>

      <nav className="menu" aria-label="Game mode">
        {OPTIONS.map((o, i) => (
          <button
            key={o.id}
            id={`mode-${o.id}`}
            type="button"
            className={`menu-item${sel === i ? ' is-sel' : ''}`}
            onMouseEnter={() => setSel(i)}
            onClick={() => {
              audio.unlock();
              audio.uiConfirm();
              onStart(i === 1);
            }}
          >
            <span className="menu-label">{o.label}</span>
            <span className="menu-hint">{o.hint}</span>
          </button>
        ))}
        <button id="toggle-controls" type="button" className="link" onClick={() => setShowControls((v) => !v)}>
          {showControls ? 'Hide controls' : 'Show controls'} <kbd className="key sm">C</kbd>
        </button>
      </nav>

      {showControls && (
        <aside className="title-controls panel">
          <ControlsSheet />
        </aside>
      )}

      <footer className="title-foot">
        <span>
          <kbd className="key sm">W</kbd>
          <kbd className="key sm">S</kbd> choose
        </span>
        <span>
          <kbd className="key sm">Enter</kbd> start
        </span>
        <span>
          <kbd className="key sm">M</kbd> mute
        </span>
      </footer>
    </div>
  );
}
