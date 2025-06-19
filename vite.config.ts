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
    // Deployment optimizations
    target: 'esnext',
    minify: 'terser',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Better cache busting for deployment
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          // Keep manifest.json and sw.js at root
          if (assetInfo.name === 'manifest.json' || assetInfo.name === 'sw.js') {
            return '[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
        // Code splitting for better caching
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-select'],
          utils: ['date-fns', 'clsx', 'tailwind-merge']
        }
      }
    },
    // Ensure clean builds
    emptyOutDir: true,
    // Optimize chunk size warnings
    chunkSizeWarningLimit: 1000
  },
  publicDir: 'public',
  // Cache busting and deployment optimization
  define: {
    __APP_VERSION__: JSON.stringify('2.0.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  },
  // Ensure proper base path handling
  base: '/'
}));
