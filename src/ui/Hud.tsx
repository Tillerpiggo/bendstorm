import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { fx, type Popup } from '../fx/fx';
import { KEY_LABELS } from '../game/input';
import type { Game } from '../game/sim';
import { PLAYER_COLORS } from '../scene/session';
import { ElementIcon, elVars, Key } from './bits';

const POPUPS = 10;

/** Damage readout colour: white when fresh, through gold and orange to deep red. */
function damageColor(d: number): string {
  const stops: [number, [number, number, number]][] = [
    [0, [255, 255, 255]],
    [40, [255, 226, 130]],
    [80, [255, 150, 70]],
    [130, [255, 70, 60]],
    [200, [190, 30, 60]],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (d <= stops[i][0]) {
      const [a, ca] = stops[i - 1];
      const [b, cb] = stops[i];
      const u = (d - a) / (b - a);
      return `rgb(${ca.map((v, k) => Math.round(v + (cb[k] - v) * u)).join(',')})`;
    }
  }
  return 'rgb(190,30,60)';
}

interface Props {
  game: Game;
  labels: [string, string];
  /** Which fighters are human, for the on-screen key reminders. */
  human: [boolean, boolean];
}

/**
 * In-fight overlay. The numbers change every frame, so they are written
 * straight to the DOM from a rAF loop instead of going through React state.
 */
export function Hud({ game, labels, human }: Props) {
  const dmg = useRef<(HTMLSpanElement | null)[]>([null, null]);
  const meter = useRef<(HTMLDivElement | null)[]>([null, null]);
  const card = useRef<(HTMLDivElement | null)[]>([null, null]);
  const stocks = useRef<(HTMLDivElement | null)[]>([null, null]);
  const cool = useRef<(HTMLDivElement | null)[]>([null, null]);
  const ammo = useRef<(HTMLDivElement | null)[]>([null, null]);
  const arrows = useRef<(HTMLDivElement | null)[]>([null, null]);
  const pops = useRef<(HTMLSpanElement | null)[]>([]);
  const banner = useRef<HTMLDivElement>(null);
  const flash = useRef<HTMLDivElement>(null);
  const lines = useRef<HTMLDivElement>(null);
  const dark = useRef<HTMLDivElement>(null);
  const fried = useRef<HTMLDivElement>(null);
  const rain = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const lastDmg = [-1, -1];
    const lastStocks = [-1, -1];
    const lastAmmo = [-1, -1];
    let lastBanner = '';
    const shown: (Popup | null)[] = Array(POPUPS).fill(null);
    const v = new THREE.Vector3();
    /** World (x, y) on the fight plane → viewport pixels. Returns false when there is no camera yet. */
    const project = (x: number, y: number): boolean => {
      const cam = fx.camera;
      if (!cam) return false;
      v.set(x, y, 0).project(cam);
      return true;
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const W = window.innerWidth;
      const H = window.innerHeight;

      for (let i = 0; i < 2; i++) {
        const f = game.fighters[i];
        const d = Math.floor(f.damage);
        const el = dmg.current[i];
        if (el && d !== lastDmg[i]) {
          el.textContent = String(d);
          el.style.color = damageColor(d);
          if (d > lastDmg[i] && lastDmg[i] >= 0) {
            // Punch the number on every hit, harder for bigger hits.
            const k = Math.min(1.5, 1.12 + (d - lastDmg[i]) * 0.025);
            el.animate(
              [
                { transform: `scale(${k}) rotate(${(Math.random() - 0.5) * 8}deg)` },
                { transform: 'scale(1) rotate(0deg)' },
              ],
              { duration: 220, easing: 'cubic-bezier(.2,.9,.3,1)' },
            );
          }
          lastDmg[i] = d;
        }
        const m = meter.current[i];
        if (m) m.style.transform = `scaleX(${Math.min(1, f.meter / 100)})`;
        const c = card.current[i];
        if (c) {
          c.classList.toggle('is-ready', f.meter >= 100 && f.state !== 'dead');
          c.classList.toggle('is-out', f.state === 'dead');
          c.classList.toggle('is-cursed', f.confuseT > 0);
        }
        const cd = cool.current[i];
        if (cd) cd.style.transform = `scaleX(${1 - Math.min(1, f.spcCd / f.spcMax)})`;
        const am = ammo.current[i];
        const shots = Math.floor(f.ammo + 1e-6);
        if (am && shots !== lastAmmo[i]) {
          for (let k = 0; k < am.children.length; k++) am.children[k].classList.toggle('spent', k >= shots);
          lastAmmo[i] = shots;
        }
        const s = stocks.current[i];
        if (s && f.stocks !== lastStocks[i]) {
          for (let k = 0; k < s.children.length; k++) s.children[k].classList.toggle('lost', k >= f.stocks);
          lastStocks[i] = f.stocks;
        }

        // Edge marker for a fighter who has been knocked out of view.
        const ar = arrows.current[i];
        if (ar) {
          let show = false;
          if (f.state !== 'dead' && project(f.x, f.y + 0.9) && (Math.abs(v.x) > 1.02 || Math.abs(v.y) > 1.02)) {
            show = true;
            const cx = Math.max(-0.92, Math.min(0.92, v.x));
            const cy = Math.max(-0.86, Math.min(0.72, v.y));
            const ang = Math.atan2(-(v.y - cy), v.x - cx);
            ar.style.transform = `translate(${(cx * 0.5 + 0.5) * W}px, ${(1 - (cy * 0.5 + 0.5)) * H}px) translate(-50%, -50%)`;
            (ar.firstElementChild as HTMLElement).style.transform = `rotate(${ang}rad)`;
          }
          ar.style.opacity = show ? '1' : '0';
        }
      }

      // Floating damage numbers and callouts, pinned to where the hit landed.
      for (let i = 0; i < POPUPS; i++) {
        const el = pops.current[i];
        if (!el) continue;
        const p = fx.popups[i] ?? null;
        if (!p || !project(p.x, p.y)) {
          if (shown[i]) el.style.opacity = '0';
          shown[i] = null;
          continue;
        }
        if (shown[i] !== p) {
          el.textContent = p.text;
          el.style.color = p.color;
          el.className = `pop${p.big ? ' is-big' : ''}${p.bubble ? ' is-bubble' : ''}`;
          shown[i] = p;
        }
        const u = p.t / p.dur;
        const pop = u < 0.15 ? 0.6 + (u / 0.15) * 0.6 : 1.2 - Math.min(1, (u - 0.15) / 0.2) * 0.2;
        el.style.opacity = String(u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3);
        el.style.transform = `translate(${(v.x * 0.5 + 0.5) * W}px, ${(1 - (v.y * 0.5 + 0.5)) * H - (p.bubble ? 0 : u * 46)}px) translate(-50%, -50%) scale(${pop})`;
      }

      let text = '';
      if (game.winner >= 0) text = 'GAME!';
      else if (game.introT > 0) text = game.introT <= 3 ? String(Math.ceil(game.introT)) : '';
      else if (game.goT >= 0 && game.time - game.goT < 0.9) text = 'BEND!';
      const b = banner.current;
      if (b && text !== lastBanner) {
        b.textContent = text;
        b.className = `banner${text.length > 1 ? ' is-word' : ''}`;
        if (text) {
          b.animate(
            [
              { transform: 'scale(1.7)', opacity: 0 },
              { transform: 'scale(1)', opacity: 1 },
            ],
            { duration: 260, easing: 'cubic-bezier(.2,.9,.3,1.2)' },
          );
        }
        lastBanner = text;
      }

      if (flash.current) {
        flash.current.style.opacity = String(fx.flash);
        flash.current.style.background = fx.flashColor;
      }
      if (dark.current) dark.current.style.opacity = String(fx.dark);
      if (fried.current) fried.current.style.opacity = String(fx.fry);
      if (rain.current) rain.current.style.opacity = String(fx.rain);
      document.querySelector('.app')?.classList.toggle('is-fried', fx.fry > 0.5);
      // Speed lines converge on the point of impact during a killing blow.
      const sl = lines.current;
      if (sl) {
        sl.style.opacity = String(Math.min(1, fx.crit * 1.4));
        if (fx.crit > 0 && project(fx.critX, fx.critY)) {
          sl.style.setProperty('--cx', `${(v.x * 0.5 + 0.5) * 100}%`);
          sl.style.setProperty('--cy', `${(1 - (v.y * 0.5 + 0.5)) * 100}%`);
        }
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      document.querySelector('.app')?.classList.remove('is-fried');
    };
  }, [game]);

  return (
    <div className="hud">
      <div ref={dark} className="nightmare" />
      <div ref={rain} className="moneyrain" aria-hidden="true">
        {Array.from({ length: 22 }, (_, i) => (
          <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDuration: `${1.1 + ((i * 7) % 9) * 0.12}s`, animationDelay: `${-((i * 13) % 10) * 0.17}s` }}>
            {i % 3 ? '💸' : '💵'}
          </span>
        ))}
      </div>
      <div ref={fried} className="fried" aria-hidden="true">
        {['😂', '💯', '🔥', '👌', '😂', '🅱️'].map((e, i) => (
          <span key={i} style={{ left: `${8 + ((i * 31) % 80)}%`, top: `${6 + ((i * 47) % 70)}%`, animationDelay: `${i * -0.13}s` }}>
            {e}
          </span>
        ))}
      </div>
      <div ref={lines} className="speedlines" />
      <div ref={flash} className="flash" />
      {Array.from({ length: POPUPS }, (_, i) => (
        <span
          key={i}
          ref={(n) => {
            pops.current[i] = n;
          }}
          className="pop"
        />
      ))}
      {([0, 1] as const).map((i) => (
        <div
          key={i}
          ref={(n) => {
            arrows.current[i] = n;
          }}
          className="offscreen"
          style={{ color: PLAYER_COLORS[i] }}
        >
          <i />
          <b>{labels[i]}</b>
        </div>
      ))}
      <div ref={banner} className="banner" aria-live="polite" />
      <div className="cards">
        {([0, 1] as const).map((i) => {
          const f = game.fighters[i];
          const k = KEY_LABELS[i];
          return (
            <div
              key={i}
              ref={(n) => {
                card.current[i] = n;
              }}
              className={`card p${i + 1}`}
              style={elVars(f.el.color, f.el.glow)}
            >
              <div className="card-sigil">
                <ElementIcon id={f.el.id} size={30} />
              </div>
              <div className="card-body">
                <div className="card-name">
                  <span className={`p${i + 1}c`}>{labels[i]}</span> {f.el.name}
                </div>
                <div className="card-dmg">
                  <span
                    ref={(n) => {
                      dmg.current[i] = n;
                    }}
                    className="dmg"
                  >
                    0
                  </span>
                  <span className="pct">%</span>
                </div>
                <div
                  ref={(n) => {
                    stocks.current[i] = n;
                  }}
                  className="stocks"
                  aria-label="Stocks"
                >
                  {Array.from({ length: game.startStocks }, (_, n) => (
                    <i key={n} />
                  ))}
                </div>
              </div>
              <div
                ref={(n) => {
                  ammo.current[i] = n;
                }}
                className="ammo"
                aria-label="Shots"
              >
                {Array.from({ length: f.el.ammo }, (_, n) => (
                  <i key={n} />
                ))}
              </div>
              <div className="cursed">Controls reversed</div>
              <div className="card-bars">
                <div className="bar spirit" title="Spirit">
                  <div
                    ref={(n) => {
                      meter.current[i] = n;
                    }}
                    className="fill"
                  />
                  <span className="bar-label">Spirit</span>
                  {human[i] && (
                    <span className="bar-ready">
                      Ultimate <Key>{k.atk}</Key>+<Key>{k.spc}</Key>
                    </span>
                  )}
                </div>
                <div className="bar cooldown" title="Specials">
                  <div
                    ref={(n) => {
                      cool.current[i] = n;
                    }}
                    className="fill"
                  />
                  <span className="bar-label">Special</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="hud-tips">
        <kbd className="key sm">Esc</kbd> pause <kbd className="key sm">M</kbd> mute
      </div>
    </div>
  );
}
