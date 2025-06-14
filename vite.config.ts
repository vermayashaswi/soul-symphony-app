
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
// Import the Lovable componentTagger plugin
import { componentTagger } from 'lovable-tagger';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // Enable componentTagger only during development
    mode === 'development' && componentTagger()
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // The following aliases are no longer needed if using '@'
      // react: path.resolve(__dirname, 'node_modules/react'),
      // 'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime'),
      // 'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
  },
  server: {
    host: '::',
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    sourcemap: true,
  },
}));
