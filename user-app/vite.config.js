import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'LogoPriceMate.png',
        'favicon.png',
        'apple-touch-icon.png',
        'android-chrome-192.png',
        'android-chrome-512.png',
        'pwa-icon.svg',
      ],
      workbox: {
        // Cache product images at runtime so they persist across page switches
        runtimeCaching: [
          {
            // OpenFoodFacts product images (images.openfoodfacts.org)
            urlPattern: /^https:\/\/images\.openfoodfacts\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'off-product-images',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Appwrite storage images (cloud.appwrite.io/v1/storage/...)
            urlPattern: /^https:\/\/cloud\.appwrite\.io\/v1\/storage\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'appwrite-storage-images',
              expiration: {
                maxEntries: 150,
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Catch-all for other external product images (CDNs, etc.)
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'external-images',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 14 * 24 * 60 * 60, // 14 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      manifest: {
        name: 'PriceMate',
        short_name: 'PriceMate',
        description: 'Real-time price comparison and barcode scanning',
        theme_color: '#6d28d9',
        background_color: '#faf5ff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/android-chrome-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/android-chrome-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-appwrite': ['appwrite'],
          'vendor-icons': ['react-icons'],
          'vendor-i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
          'vendor-charts': ['recharts'],
          'vendor-map': ['ol'],
          'vendor-scanner': ['@zxing/browser', '@zxing/library'],
          'vendor-ai': ['openai'],
        },
      },
    },
  },
})
