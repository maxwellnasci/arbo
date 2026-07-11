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
        name: 'Arbo Run',
        short_name: 'Arbo Run',
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
        cacheId: 'arbo-v6',
        skipWaiting: true,
        clientsClaim: true,
        // Desliga o navigateFallback padrão do vite-plugin-pwa ('index.html'), que gera um
        // NavigationRoute preso ao precache: o documento HTML fica congelado com os headers
        // (CSP, security headers) de quando foi cacheado pela primeira vez, porque mudanças
        // só em vercel.json não alteram os bytes do index.html — a revisão do precache nunca
        // muda, então o SW nunca refaz o fetch. Vercel já resolve o fallback de SPA via
        // rewrites (vercel.json), então essa rota do SW é redundante para roteamento; o
        // navigate abaixo troca por NetworkFirst para o documento sempre vir da rede quando
        // online, sem ficar preso a headers antigos entre deploys.
        navigateFallback: undefined,
        runtimeCaching: [
          // Documento HTML (navegação) — NetworkFirst: garante que headers (CSP etc.) e
          // referências a novos bundles cheguem sempre que houver rede disponível.
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 24 * 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Supabase REST API — NetworkOnly: dado de aplicação nunca pode vir de cache obsoleto
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkOnly',
          },
          // Supabase Auth — NetworkOnly: sessão/token nunca podem vir de cache obsoleto
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/.*/i,
            handler: 'NetworkOnly',
          },
          // Supabase Storage — mantém NetworkFirst (arquivos estáticos, não dado de aplicação)
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-storage-cache',
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
