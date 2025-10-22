import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    define: {
      __APP_ENV__: JSON.stringify(env.VITE_APP_ENV),
    },
    plugins: [react(), tailwindcss()],
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
      commonjsOptions: {
        include: ['node_modules/**'],
      },
    },
  };
});
