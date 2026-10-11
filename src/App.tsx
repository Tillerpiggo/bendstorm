import { useCallback, useEffect, useRef, useState } from 'react';
import { audio } from './fx/audio';
import { ELEMENT_IDS } from './game/elements';
import { attachInput } from './game/input';
import { STAGE_IDS, type StageId } from './game/stage';
import { GameCanvas } from './scene/GameCanvas';
import { makeSession, type Rules, type Session } from './scene/session';
import { Hud } from './ui/Hud';
import { Pause, Results } from './ui/Overlays';
import { Select } from './ui/Select';
import { Title } from './ui/Title';

type Screen = 'title' | 'select' | 'fight' | 'results';

/** Each arena plays the battle theme in its own key (semitones from D minor) and tempo. */
const STAGE_MUSIC: Record<StageId, [number, number]> = { temple: [0, 132], glacier: [2, 124], crater: [-2, 142], carousel: [-3, 140], rift: [5, 118], foundry: [-5, 136] };

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

/** Two bots with random elements in a random arena, fighting behind the title screen. */
function attract(): Session {
  return makeSession('attract', { elements: [pick(ELEMENT_IDS), pick(ELEMENT_IDS)], stage: pick(STAGE_IDS), stocks: 3, level: 1 }, ['cpu', 'cpu']);
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [cpu, setCpu] = useState(false);
  const [rules, setRules] = useState<Rules>({ elements: ['fire', 'water'], stage: 'temple', stocks: 3, level: 1 });
  const [session, setSession] = useState<Session>(attract);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(audio.muted);

  const live = useRef({ screen, paused });
  live.current = { screen, paused };

  useEffect(() => attachInput(), []);

  useEffect(() => {
    // Browsers only start audio from a user gesture.
    const unlock = () => audio.unlock();
    const onKey = (e: KeyboardEvent) => {
      unlock();
      if (e.repeat) return;
      if (e.code === 'KeyM') {
        audio.setMuted(!audio.muted);
        setMuted(audio.muted);
      } else if (e.code === 'Escape' && live.current.screen === 'fight' && !live.current.paused) {
        setPaused(true);
      }
    };
    const onBlur = () => {
      if (live.current.screen === 'fight') setPaused(true);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useEffect(() => {
    audio.duckMusic(paused);
  }, [paused]);

  useEffect(() => {
    // Console/test handle: `__bendstorm.game.fighters[0].meter = 100` and so on.
    (window as unknown as { __bendstorm: unknown }).__bendstorm = session;
  }, [session]);

  const toTitle = useCallback(() => {
    setPaused(false);
    setScreen('title');
    setSession(attract());
    audio.setTrack('title');
  }, []);

  const toSelect = useCallback(
    (vsCpu: boolean) => {
      setCpu(vsCpu);
      setPaused(false);
      setScreen('select');
      setSession(makeSession('preview', rules, ['none', 'none']));
      audio.setTrack('title');
    },
    [rules],
  );

  const changeRules = useCallback((r: Rules) => {
    setRules(r);
    setSession(makeSession('preview', r, ['none', 'none']));
  }, []);

  const startMatch = useCallback(() => {
    setPaused(false);
    setScreen('fight');
    setSession(makeSession('match', rules, ['human', cpu ? 'cpu' : 'human']));
    const [key, bpm] = STAGE_MUSIC[rules.stage];
    audio.setMatch(rules.elements, key, bpm);
  }, [rules, cpu]);

  const onFinished = useCallback(() => {
    const s = live.current.screen;
    if (s === 'title') setSession(attract());
    else if (s === 'fight') setScreen('results');
  }, []);

  const labels: [string, string] = session.kind === 'attract' ? ['CPU', 'CPU'] : ['P1', cpu ? 'CPU' : 'P2'];

  return (
    <div className={`app is-${screen}`}>
      <GameCanvas session={session} paused={paused && screen === 'fight'} onFinished={onFinished} labels={labels} />
      <div className="ui">
        {screen === 'title' && <Title onStart={toSelect} />}
        {screen === 'select' && <Select key={String(cpu)} cpu={cpu} rules={rules} onRules={changeRules} onStart={startMatch} onBack={toTitle} />}
        {screen === 'fight' && <Hud key={session.key} game={session.game} labels={labels} human={[true, !cpu]} />}
        {screen === 'fight' && paused && (
          <Pause p2Label={cpu ? 'CPU' : 'Player 2'} onResume={() => setPaused(false)} onRestart={startMatch} onQuit={toTitle} />
        )}
        {screen === 'results' && (
          <Results game={session.game} labels={labels} onRematch={startMatch} onChange={() => toSelect(cpu)} onQuit={toTitle} />
        )}
        <button
          id="mute-toggle"
          type="button"
          className="mute"
          aria-pressed={muted}
          onClick={() => {
            audio.unlock();
            audio.setMuted(!audio.muted);
            setMuted(audio.muted);
          }}
        >
          {muted ? 'Sound off' : 'Sound on'}
        </button>
      </div>
    </div>
  );
}
