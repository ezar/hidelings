/// <reference types="vitest/config" />
import { createReadStream, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const BASE = '/hidelings/';

// ONNX Runtime WASM files are served from our own origin (not a CDN) so the service worker
// can precache them and the depth model keeps working offline.
const ORT_DIR = fileURLToPath(new URL('./node_modules/@huggingface/transformers/dist/', import.meta.url));
const ORT_FILES = ['ort-wasm-simd-threaded.jsep.mjs', 'ort-wasm-simd-threaded.jsep.wasm'];

function onnxRuntimeFiles(): Plugin {
  return {
    name: 'hidelings-onnx-runtime-files',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = req.url?.split('?')[0]?.replace(`${BASE}ort/`, '');
        if (!name || !ORT_FILES.includes(name)) return next();
        res.setHeader('Content-Type', name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
        createReadStream(ORT_DIR + name).pipe(res);
      });
    },
    generateBundle() {
      for (const name of ORT_FILES) {
        this.emitFile({ type: 'asset', fileName: `ort/${name}`, source: readFileSync(ORT_DIR + name) });
      }
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    onnxRuntimeFiles(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Hidelings',
        short_name: 'Hidelings',
        description: 'Criaturas que se esconden detrás de las cosas de tu casa.',
        lang: 'es',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FFF6E9',
        theme_color: '#FFF6E9',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,wasm,woff2}'],
        // Vite also emits a hashed copy of the ORT wasm; the app loads the one under ort/.
        globIgnores: ['poc/**', 'assets/*.wasm'],
        maximumFileSizeToCacheInBytes: 32 * 1024 * 1024,
        navigateFallbackDenylist: [/\/poc\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 20 } },
          },
        ],
      },
    }),
  ],
  worker: { format: 'es' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
