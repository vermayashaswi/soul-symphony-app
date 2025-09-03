
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/mobile.css' // Import mobile-specific styles
import './styles/tutorial.css' // Import tutorial-specific styles
import { AuthProvider } from './contexts/AuthContext'
import { BrowserRouter } from 'react-router-dom'
import { TranslationProvider } from './contexts/TranslationContext'
import { ContextReadinessProvider } from './contexts/ContextReadinessManager'
import { ThemeProvider } from './hooks/use-theme'
import { initializeServiceWorker } from './utils/serviceWorker'
import { backgroundSyncService } from './services/backgroundSyncService'
import { periodicSyncService } from './services/periodicSyncService'
import { fcmNotificationService as pushNotificationService } from './services/fcmNotificationService'
import { mobileErrorHandler } from './services/mobileErrorHandler'
import { mobileOptimizationService } from './services/mobileOptimizationService'
import { nativeAppInitService } from './services/nativeAppInitService'
import { nativeIntegrationService } from './services/nativeIntegrationService'
import { preloadCriticalImages } from './utils/imagePreloader'
import { LoadingScreen } from './components/LoadingScreen'

// Enhanced Font Loading System
const initializeFontSystem = async () => {
  console.log('[FontSystem] Starting font initialization...');
  
  // Core fonts that must be loaded
  const coreFonts = [
    'Inter',
    'Noto Sans',
    'Noto Sans Devanagari',
    'Noto Sans Arabic',
    'Noto Sans SC',
    'Noto Sans JP',
    'Noto Sans KR',
    'Noto Sans Bengali',
    'Noto Sans Thai'
  ];
  
  // Font loading with timeout and retry
  const loadFontWithRetry = async (fontFamily: string, retries = 3): Promise<boolean> => {
    for (let i = 0; i < retries; i++) {
      try {
        if (document.fonts && document.fonts.check) {
          const isLoaded = document.fonts.check(`12px "${fontFamily}"`);
          if (isLoaded) {
            console.log(`[FontSystem] ${fontFamily} already loaded`);
            return true;
          }
          
          // Wait for font to load with timeout
          const fontFace = new FontFace(fontFamily, `local("${fontFamily}")`);
          await Promise.race([
            fontFace.load(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
          ]);
          
          console.log(`[FontSystem] ${fontFamily} loaded successfully`);
          return true;
        }
      } catch (error) {
        console.warn(`[FontSystem] Attempt ${i + 1} failed for ${fontFamily}:`, error);
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
    
    console.error(`[FontSystem] Failed to load ${fontFamily} after ${retries} attempts`);
    return false;
  };
  
  // Load core fonts
  const fontPromises = coreFonts.map(font => loadFontWithRetry(font));
  
  try {
    // Wait for document fonts ready with timeout
    await Promise.race([
      document.fonts ? document.fonts.ready : Promise.resolve(),
      new Promise(resolve => setTimeout(resolve, 5000))
    ]);
    
    const results = await Promise.allSettled(fontPromises);
    const loadedCount = results.filter(result => result.status === 'fulfilled' && result.value).length;
    
    console.log(`[FontSystem] Font loading complete: ${loadedCount}/${coreFonts.length} fonts loaded`);
    
    // Set global font ready flag
    (window as any).__SOULO_FONTS_READY__ = true;
    
    // Dispatch font ready event
    window.dispatchEvent(new CustomEvent('fontsReady', { 
      detail: { 
        loadedCount, 
        totalCount: coreFonts.length,
        timestamp: Date.now()
      } 
    }));
    
  } catch (error) {
    console.error('[FontSystem] Font initialization error:', error);
    // Set ready flag anyway to prevent hanging
    (window as any).__SOULO_FONTS_READY__ = true;
    window.dispatchEvent(new CustomEvent('fontsReady', { detail: { error } }));
  }
};

// iOS Viewport Height Fix - addresses the iOS Safari issue with viewport height
const fixViewportHeight = () => {
  // Set CSS variable for viewport height that updates on resize
  const setVhProperty = () => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  };
  
  // Initial set
  setVhProperty();
  
  // Update on resize and orientation change
  window.addEventListener('resize', setVhProperty);
  window.addEventListener('orientationchange', () => {
    // Slight delay to ensure viewport has updated after orientation change
    setTimeout(setVhProperty, 100);
  });
  
  // Special handling for iOS keyboard appearance
  if (/iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    
    // Track when iOS keyboard shows/hides by monitoring input focus
    const inputs = document.querySelectorAll('input, textarea');
    inputs.forEach(input => {
      input.addEventListener('focus', () => {
        document.body.classList.add('keyboard-visible');
        // Force reflow to ensure transition works
        setTimeout(() => {
          window.scrollTo(0, 0);
          setVhProperty();
        }, 50);
      });
      
      input.addEventListener('blur', () => {
        document.body.classList.remove('keyboard-visible');
        // Small delay to ensure UI updates after keyboard hides
        setTimeout(setVhProperty, 50);
      });
    });
  }
};

// Initialize PWA Service Worker
const initializePWA = async () => {
  try {
    console.log('[PWA] Initializing service worker...');
    
    const result = await initializeServiceWorker();
    
    if (result.success) {
      console.log('[PWA] Service worker registered successfully');
      
      // Initialize background sync service
      backgroundSyncService.initializeListeners();
      
      // Initialize periodic sync service
      await periodicSyncService.initialize();
      
      // Listen for service worker updates
      window.addEventListener('swUpdateAvailable', () => {
        console.log('[PWA] Service worker update available');
        // You can show a notification to the user here
      });
      
      // Listen for periodic sync messages
      navigator.serviceWorker?.addEventListener('message', (event) => {
        if (event.data?.type === 'PERIODIC_SYNC_STATUS') {
          console.log('[PWA] Periodic sync completed:', event.data.payload);
        }
      });
      
    } else {
      console.warn('[PWA] Service worker registration failed:', result.error?.message);
    }
    
  } catch (error) {
    console.error('[PWA] PWA initialization error:', error);
    mobileErrorHandler.handleError({
      type: 'unknown',
      message: `PWA initialization failed: ${error}`
    });
  }
};

// Consolidated initialization with loading state management
let appInitialized = false;
let initializationPromise: Promise<void> | null = null;

const initializeApp = async (): Promise<void> => {
  if (appInitialized) return;
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    try {
      console.log('[App] Starting consolidated initialization...');
      
      // Run all initialization tasks in parallel for better performance
      await Promise.all([
        // Core system initialization
        initializeFontSystem(),
        mobileOptimizationService.initialize(),
        
        // Native app services (runs conditionally)
        (async () => {
          await nativeIntegrationService.initialize();
          if (nativeIntegrationService.isRunningNatively()) {
            await nativeAppInitService.initialize();
            console.log('[App] Native services initialized');
          } else {
            // Initialize PWA only for web
            await initializePWA();
            console.log('[App] PWA services initialized');
          }
        })(),
        
        // UI optimizations
        (async () => {
          fixViewportHeight();
          preloadCriticalImages();
          
          // Platform detection
          if (/iPad|iPhone|iPod/.test(navigator.userAgent) || 
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
            document.documentElement.classList.add('ios-device');
          }
          
          if (/Android/.test(navigator.userAgent)) {
            document.documentElement.classList.add('android-device');
          }
        })()
      ]);
      
      // Clean up any malformed paths
      const currentPath = window.location.pathname;
      if (currentPath.includes('https://') || currentPath.includes('soulo.online')) {
        window.history.replaceState(null, '', '/');
      }
      
      document.body.classList.add('app-initialized');
      appInitialized = true;
      
      console.log('[App] Consolidated initialization complete');
    } catch (error) {
      console.error('[App] Initialization failed:', error);
      mobileErrorHandler.handleError({
        type: 'crash',
        message: `App initialization failed: ${error}`
      });
      throw error;
    }
  })();
  
  return initializationPromise;
};

// Create initialization-aware App component
const InitializedApp: React.FC = () => {
  const [isInitialized, setIsInitialized] = React.useState(appInitialized);
  const [initError, setInitError] = React.useState<string | null>(null);
  
  React.useEffect(() => {
    if (!appInitialized) {
      initializeApp()
        .then(() => setIsInitialized(true))
        .catch((error) => setInitError(error.toString()));
    }
  }, []);
  
  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="flex flex-col items-center space-y-4 text-center max-w-md">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-xl font-semibold text-red-600">Initialization Failed</h2>
          <p className="text-muted-foreground">
            The app failed to initialize properly. This usually happens due to network issues or device compatibility.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  
  if (!isInitialized) {
    return <LoadingScreen status="Initializing app..." />;
  }
  
  return <App />;
};

// Error boundary specifically for theme provider issues
interface ThemeErrorBoundaryState {
  hasError: boolean;
}

interface ThemeErrorBoundaryProps {
  children: React.ReactNode;
}

class ThemeErrorBoundary extends React.Component<ThemeErrorBoundaryProps, ThemeErrorBoundaryState> {
  constructor(props: ThemeErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any): ThemeErrorBoundaryState | null {
    // Check if this is the specific theme provider error
    if (error?.message?.includes('useTheme must be used within a ThemeProvider')) {
      console.warn('[ThemeErrorBoundary] Caught theme provider error, attempting recovery');
      return { hasError: true };
    }
    return null;
  }

  componentDidCatch(error: any, errorInfo: any) {
    if (error?.message?.includes('useTheme must be used within a ThemeProvider')) {
      console.error('[ThemeErrorBoundary] Theme provider error caught:', error, errorInfo);
      // Force a re-render after a short delay to allow providers to initialize
      setTimeout(() => {
        this.setState({ hasError: false });
      }, 100);
    }
  }

  render() {
    if (this.state.hasError) {
      // Return a minimal loading state while providers initialize
      return React.createElement('div', { 
        style: { 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100vh',
          fontFamily: 'Inter, sans-serif'
        } 
      }, 'Loading...');
    }

    return this.props.children;
  }
}

// Conditionally use StrictMode based on environment
const isProduction = import.meta.env.PROD;
const AppWithStrictMode = isProduction ? 
  ({ children }: { children: React.ReactNode }) => <>{children}</> : 
  React.StrictMode;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <AppWithStrictMode>
    <ThemeErrorBoundary>
      <BrowserRouter>
        <ContextReadinessProvider>
          <ThemeProvider>
            <TranslationProvider>
              <AuthProvider>
                <InitializedApp />
              </AuthProvider>
            </TranslationProvider>
          </ThemeProvider>
        </ContextReadinessProvider>
      </BrowserRouter>
    </ThemeErrorBoundary>
  </AppWithStrictMode>,
)
