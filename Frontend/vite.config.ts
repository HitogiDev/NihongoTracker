import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    define: {
      __APP_ENV__: JSON.stringify(env.VITE_APP_ENV),
    },
    plugins: [
      react({
        babel: {
          plugins: [['babel-plugin-react-compiler', {}]],
        },
      }),
      tailwindcss(),
    ],
    server: {
      host: true, // Allow external connections
      allowedHosts: ['localhost', '.ngrok.io', '.ngrok-free.app', '.ngrok.app'],
      proxy: {
        '/api': {
          target: env.VITE_API_URL as string,
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom)\//.test(id)) return 'framework';
            if (id.includes('/gsap/')) return 'animation';
            return undefined;
          },
        },
      },
      commonjsOptions: {
        include: ['node_modules/**'],
      },
    },
  };
});
