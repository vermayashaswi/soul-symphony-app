
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
  // Ensure that Vite correctly resolves Node.js built-in modules
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        // Copy manifest.json to app subdirectory for PWA
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'manifest.json') {
            return 'app/manifest.json';
          }
          return '[name]-[hash][extname]';
        }
      }
    }
  },
  // Configure public directory handling for manifest
  publicDir: 'public',
  // Add custom handling for manifest.json in app path and version injection
  define: {
    __APP_MANIFEST_PATH__: JSON.stringify('/app/manifest.json'),
    __APP_VERSION__: JSON.stringify('1.1.0'),
    __BUILD_ID__: JSON.stringify(Date.now().toString())
  }
}));
