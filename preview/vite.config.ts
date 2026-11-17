// Local visual preview outside Reddit: `npm run preview:local`.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  plugins: [react(), tailwind()],
  resolve: {
    alias: {
      '@devvit/web/client': fileURLToPath(new URL('./devvit-stub.ts', import.meta.url)),
      '@devvit/analytics/client/reddit': fileURLToPath(new URL('./analytics-stub.ts', import.meta.url)),
    },
  },
  server: { port: 5174, fs: { allow: ['..'] } },
});
