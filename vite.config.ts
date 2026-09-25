/// <reference types="vitest/config" />
import { createReadStream, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const BASE = '/hidelings/';

// Runtime files served from our own origin (not a CDN), so the service worker can cache them and the
// models keep working offline: ONNX Runtime for depth (precached) and MediaPipe for hands (cached on use).
const COPIES: { from: string; to: string; files: string[] }[] = [
  {
    from: fileURLToPath(new URL('./node_modules/@huggingface/transformers/dist/', import.meta.url)),
    to: 'ort/',
    files: ['ort-wasm-simd-threaded.jsep.mjs', 'ort-wasm-simd-threaded.jsep.wasm'],
  },
  {
    from: fileURLToPath(new URL('./node_modules/@mediapipe/tasks-vision/wasm/', import.meta.url)),
    to: 'mediapipe/',
    files: ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm'],
  },
];

function runtimeFiles(): Plugin {
  return {
    name: 'hidelings-runtime-files',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0] ?? '';
        for (const c of COPIES) {
          const name = path.replace(`${BASE}${c.to}`, '');
          if (name === path || !c.files.includes(name)) continue;
          res.setHeader('Content-Type', name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
          createReadStream(c.from + name).pipe(res);
          return;
        }
        next();
      });
    },
    generateBundle() {
      for (const c of COPIES) {
        for (const name of c.files) this.emitFile({ type: 'asset', fileName: c.to + name, source: readFileSync(c.from + name) });
      }
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    runtimeFiles(),
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
        globIgnores: ['poc/**', 'assets/*.wasm', 'mediapipe/**'],
        maximumFileSizeToCacheInBytes: 32 * 1024 * 1024,
        navigateFallbackDenylist: [/\/poc\//],
        runtimeCaching: [
          {
            // MediaPipe hands: our WASM copy and Google's model file, cached the first time hands are used.
            urlPattern: ({ url }) => url.pathname.startsWith(`${BASE}mediapipe/`) || url.href.startsWith('https://storage.googleapis.com/mediapipe-models/'),
            handler: 'CacheFirst',
            options: { cacheName: 'hands', expiration: { maxEntries: 10 } },
          },
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
