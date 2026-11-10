import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const api = process.env.GATEWAY_URL ?? 'http://localhost:8090';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  build: { outDir: fileURLToPath(new URL('../dist/web', import.meta.url)), emptyOutDir: true },
  server: { port: 5175, proxy: { '/admin/api': api, '/health': api } },
});
