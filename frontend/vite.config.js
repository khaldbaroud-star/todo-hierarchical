import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // يُحدّث الـ Service Worker تلقائياً بدون الحاجة لتدخل المستخدم
      registerType: 'autoUpdate',

      // يفعّل الـ PWA أثناء التطوير (npm run dev) وليس فقط في build
      // مفيد جداً للاختبار بدون الحاجة لعمل build كل مرة
      devOptions: {
        enabled: true,
      },

      manifest: {
        name: 'تطبيق المهام الهرمي',
        short_name: 'المهام',
        description: 'تطبيق شخصي لإدارة المهام الفردية والمركّبة بشكل هرمي',
        lang: 'ar',
        dir: 'rtl',
        theme_color: '#2e7d32',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
});
