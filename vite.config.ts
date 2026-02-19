import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const apiTarget =
      env.VITE_API_BASE?.trim() ||
      'https://moodboardlab-api-bhc6a4b0dgbdb2gf.westeurope-01.azurewebsites.net';

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/__api_proxy__': {
            target: apiTarget,
            changeOrigin: true,
            secure: true,
            rewrite: (urlPath) => urlPath.replace(/^\/__api_proxy__/, ''),
          },
        },
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
