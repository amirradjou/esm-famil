import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // The client always talks to its own origin; in dev Vite forwards to the game server.
    proxy: {
      '/socket.io': { target: 'http://localhost:3000', ws: true },
      '/healthz': 'http://localhost:3000',
    },
  },
});
