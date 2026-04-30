import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'node:path';
import manifest from './src/manifest';

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@catalog': resolve(__dirname, 'catalog'),
      // Alias React → Preact/compat for ~140KB bundle savings.
      // API-compatible with React 18, including createRoot + JSX runtime.
      react: 'preact/compat',
      'react-dom': 'preact/compat',
      'react-dom/test-utils': 'preact/test-utils',
      'react/jsx-runtime': 'preact/jsx-runtime',
    },
  },
  optimizeDeps: {
    include: ['preact/compat', 'preact/jsx-runtime', 'preact/hooks'],
  },
  build: {
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5174 },
    // CRXJS/HMR CORS fix: extension origin must be allow-listed so the
    // dev-built service worker can fetch /@vite/env and /@crx/client-worker.
    // Vite 5's default CORS config doesn't echo chrome-extension:// origins.
    cors: {
      origin: [/chrome-extension:\/\//],
    },
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
});
