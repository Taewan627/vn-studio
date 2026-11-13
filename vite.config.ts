import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        __VN_AI_IMAGE_GENERATION_ENABLED__: JSON.stringify(env.VITE_AI_IMAGE_GENERATION_ENABLED === 'true'),
      },
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          'sharp': path.resolve(__dirname, 'services/serverOnly.ts'),
        }
      }
    };
});
