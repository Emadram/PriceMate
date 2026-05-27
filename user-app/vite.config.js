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
        'favicon.png',
        'apple-touch-icon.png',
        'android-chrome-192.png',
        'android-chrome-512.png',
        'pwa-icon.svg',
      ],
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
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-appwrite': ['appwrite'],
          'vendor-icons': ['react-icons', 'lucide-react'],
          'vendor-i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
          'vendor-charts': ['recharts'],
          'vendor-map': ['ol'],
          'vendor-scanner': ['@ericblade/quagga2', '@zxing/browser', '@zxing/library'],
          'vendor-ai': ['openai', '@google/generative-ai'],
        },
      },
    },
  },
})
