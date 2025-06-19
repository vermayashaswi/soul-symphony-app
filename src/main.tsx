
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
import { pushNotificationService } from './services/pushNotificationService'

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

// Enhanced iOS Viewport Height Fix - addresses the iOS Safari issue with viewport height
const fixViewportHeight = () => {
  // Enhanced viewport height management for webtonative
  const setVhProperty = () => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    document.documentElement.style.setProperty('--real-vh', `${window.innerHeight}px`);
    
    // Log for debugging
    console.log(`[Viewport] Setting --vh: ${vh}px, window height: ${window.innerHeight}px`);
  };
  
  // Initial set
  setVhProperty();
  
  // Enhanced keyboard detection for Android webtonative
  let initialViewportHeight = window.innerHeight;
  let keyboardVisible = false;
  
  const detectKeyboard = () => {
    const currentHeight = window.innerHeight;
    const heightDifference = initialViewportHeight - currentHeight;
    const threshold = 150; // Minimum height change to consider keyboard open
    
    const wasKeyboardVisible = keyboardVisible;
    keyboardVisible = heightDifference > threshold;
    
    if (keyboardVisible !== wasKeyboardVisible) {
      console.log(`[Keyboard] Keyboard ${keyboardVisible ? 'opened' : 'closed'}, height difference: ${heightDifference}px`);
      
      if (keyboardVisible) {
        document.body.classList.add('keyboard-visible');
        document.documentElement.classList.add('keyboard-visible');
        // Set available height for keyboard mode
        document.documentElement.style.setProperty('--available-height', `${currentHeight}px`);
      } else {
        document.body.classList.remove('keyboard-visible');
        document.documentElement.classList.remove('keyboard-visible');
        // Reset to full height
        document.documentElement.style.setProperty('--available-height', `${initialViewportHeight}px`);
      }
    }
    
    setVhProperty();
  };
  
  // Update on resize and orientation change
  window.addEventListener('resize', detectKeyboard);
  window.addEventListener('orientationchange', () => {
    // Reset initial height on orientation change
    setTimeout(() => {
      initialViewportHeight = window.innerHeight;
      detectKeyboard();
    }, 300);
  });
  
  // Special handling for webtonative and mobile browsers
  if (/Android/i.test(navigator.userAgent) || 
      /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    
    // Visual viewport API support for better keyboard handling
    if (window.visualViewport) {
      console.log('[Viewport] Visual Viewport API available');
      
      const handleVisualViewportChange = () => {
        const visualHeight = window.visualViewport!.height;
        const windowHeight = window.innerHeight;
        
        console.log(`[VisualViewport] Visual: ${visualHeight}px, Window: ${windowHeight}px`);
        
        if (visualHeight < windowHeight * 0.75) {
          document.body.classList.add('keyboard-visible');
          document.documentElement.classList.add('keyboard-visible');
          document.documentElement.style.setProperty('--keyboard-height', `${windowHeight - visualHeight}px`);
        } else {
          document.body.classList.remove('keyboard-visible');
          document.documentElement.classList.remove('keyboard-visible');
          document.documentElement.style.setProperty('--keyboard-height', '0px');
        }
        
        // Update viewport height based on visual viewport
        const vh = visualHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
        document.documentElement.style.setProperty('--visual-vh', `${vh}px`);
      };
      
      window.visualViewport.addEventListener('resize', handleVisualViewportChange);
      window.visualViewport.addEventListener('scroll', handleVisualViewportChange);
    }
    
    // Enhanced input focus handling
    const inputs = document.querySelectorAll('input, textarea');
    inputs.forEach(input => {
      input.addEventListener('focus', () => {
        console.log('[Input] Input focused, managing viewport');
        document.body.classList.add('input-focused');
        
        // Scroll to input after a delay to ensure keyboard is open
        setTimeout(() => {
          input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      });
      
      input.addEventListener('blur', () => {
        console.log('[Input] Input blurred');
        document.body.classList.remove('input-focused');
      });
    });
    
    // Add mutation observer to handle dynamically added inputs
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            const element = node as Element;
            const newInputs = element.querySelectorAll('input, textarea');
            newInputs.forEach(input => {
              input.addEventListener('focus', () => {
                document.body.classList.add('input-focused');
                setTimeout(() => {
                  input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
              });
              
              input.addEventListener('blur', () => {
                document.body.classList.remove('input-focused');
              });
            });
          }
        });
      });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
  }
  
  // Set initial available height
  document.documentElement.style.setProperty('--available-height', `${initialViewportHeight}px`);
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
  }
};

// Initialize systems
const initializeApp = async () => {
  // Initialize font system first
  await initializeFontSystem();
  
  // Initialize enhanced viewport fix
  fixViewportHeight();
  
  // Initialize PWA features
  await initializePWA();
  
  // Detect device type and set classes
  if (/iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    document.documentElement.classList.add('ios-device');
  }
  
  if (/Android/i.test(navigator.userAgent)) {
    document.documentElement.classList.add('android-device');
  }
  
  console.log('[App] Initialization complete');
};

// Enhanced viewport meta tag configuration for webtonative
const updateViewportMetaTag = () => {
  let viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
  
  if (!viewportMeta) {
    viewportMeta = document.createElement('meta');
    viewportMeta.name = 'viewport';
    document.head.appendChild(viewportMeta);
  }
  
  // Enhanced viewport configuration for webtonative keyboard handling
  viewportMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content';
  
  console.log('[Viewport] Updated meta tag:', viewportMeta.content);
};

// Update viewport meta tag immediately
updateViewportMetaTag();

// Start initialization
initializeApp();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ContextReadinessProvider>
        <ThemeProvider>
          <TranslationProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </TranslationProvider>
        </ThemeProvider>
      </ContextReadinessProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
