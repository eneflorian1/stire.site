import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/sitemap.xml': {
        target: 'http://localhost:8000',
        changeOrigin: false,
        secure: false,
      },
      '/sitemap-news.xml': {
        target: 'http://localhost:8000',
        changeOrigin: false,
        secure: false,
      },
      '/sitemap-articles-latest.xml': {
        target: 'http://localhost:8000',
        changeOrigin: false,
        secure: false,
      },
      '/sitemap-articles-': {
        target: 'http://localhost:8000',
        changeOrigin: false,
        secure: false,
      },
      '/sitemap-categories.xml': {
        target: 'http://localhost:8000',
        changeOrigin: false,
        secure: false,
      },
      '/sitemap-images.xml': {
        target: 'http://localhost:8000',
        changeOrigin: false,
        secure: false,
      },
    },
  },
});


