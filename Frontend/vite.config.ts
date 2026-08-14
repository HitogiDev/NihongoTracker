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
    resolve: {
      // `@nihongotracker/yomitan-content` is a linked path dependency with its
      // own dev-only React (for its tests). Without deduping, Rollup resolves
      // the JSX runtime from inside the package and the build fails with
      // `"jsx" is not exported by react/jsx-runtime`.
      dedupe: ['react', 'react-dom'],
    },
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
