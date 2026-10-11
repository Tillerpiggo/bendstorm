import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Fixed, non-default port so this never collides with other local dev servers.
  server: { port: 5273, strictPort: true },
  preview: { port: 5274 },
  build: { chunkSizeWarningLimit: 1600 },
});
