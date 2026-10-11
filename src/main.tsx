import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800-italic.css';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const start = () => {
  // No StrictMode: its dev-only double mount would build the WebGL scene twice.
  createRoot(document.getElementById('root')!).render(<App />);
};

// The fighters' name tags are drawn to a canvas, which can only use a font that has
// already loaded, so wait for the display face (but never hang on it).
const font = document.fonts?.load('italic 800 64px "Barlow Condensed"') ?? Promise.resolve();
Promise.race([font, new Promise((r) => setTimeout(r, 1500))]).then(start, start);
