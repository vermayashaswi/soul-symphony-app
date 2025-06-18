import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    allowedHosts: [
      "571d731e-b54b-453e-9f48-a2c79a572930.lovableproject.com",
    ],
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ['react', 'react-dom']
  },
  optimizeDeps: {
    exclude: ['lovable-tagger'],
    include: ['react', 'react-dom']
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        // Ensure manifest.json is properly handled for PWABuilder
        assetFileNames: (assetInfo) => {
          // Keep manifest.json at root for PWABuilder detection
          if (assetInfo.name === 'manifest.json') {
            return 'manifest.json';
          }
          return '[name]-[hash][extname]';
        }
      }
    }
  },
  publicDir: 'public',
  // PWABuilder-friendly configuration
  define: {
    __PWA_MANIFEST_PATH__: JSON.stringify('/manifest.json'),
    __APP_VERSION__: JSON.stringify('1.3.0')
  }
}));
