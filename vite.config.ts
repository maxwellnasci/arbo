/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-512-maskable.png', 'offline.html'],
      manifest: {
        name: 'Arbo',
        short_name: 'Arbo',
        description: 'CrossFit Running App',
        theme_color: '#111111',
        background_color: '#111111',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        categories: ['health', 'fitness'],
        shortcuts: [
          {
            name: 'Painel do Aluno',
            url: '/aluno',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }]
          },
          {
            name: 'Painel Admin',
            url: '/admin',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }]
          }
        ],
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        // offline.html só aparece quando genuinamente sem rede
        navigateFallback: '/offline.html',
        // Nunca redirecionar para offline.html em rotas de API ou assets estáticos
        navigateFallbackDenylist: [
          /^\/assets\//,
          /^\/icons\//,
          /^\/sw\.js/,
          /^\/workbox-/,
          /^\/registerSW\.js/,
          /^\/manifest\.webmanifest/,
          /^\/robots\.txt/,
          /^https?:\/\/.*\.supabase\.co\//,
        ],
        runtimeCaching: [
          // Supabase REST API — NetworkFirst, timeout 30s (era 10s — muito baixo)
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              networkTimeoutSeconds: 30,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 24 * 60 * 60, // 1 dia
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Supabase Auth e Storage — NetworkFirst, timeout 30s
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/(auth|storage)\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-auth-storage-cache',
              networkTimeoutSeconds: 30,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60, // 1 hora
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Supabase Edge Functions — NetworkOnly (sem cache, sempre rede)
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/functions\/.*/i,
            handler: 'NetworkOnly',
          },
          // Imagens — CacheFirst (seguro, não interferem com navegação)
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 dias
              },
            },
          },
        ],
      }
    })
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
