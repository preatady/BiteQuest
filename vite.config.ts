import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
        manifest: {
          name: 'BiteQuest - Khám Phá Ẩm Thực',
          short_name: 'BiteQuest',
          description: 'Khám phá thành phố qua từng món ăn - AI Food Exploration for Gen Z',
          theme_color: '#FF6B35',
          background_color: '#FDFCF8',
          display: 'standalone',
          orientation: 'portrait',
          icons: [
            {
              src: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=192&auto=format&fit=crop&q=80',
              sizes: '192x192',
              type: 'image/jpeg',
            },
            {
              src: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=512&auto=format&fit=crop&q=80',
              sizes: '512x512',
              type: 'image/jpeg',
            },
          ],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          // Never cache dynamic location, place, check-in, or AI mutation endpoints
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: /^\/api\/.*/i,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    optimizeDeps: {
      exclude: ['maplibre-gl'],
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
