/**
 * Simplified Native Initialization Service
 * Streamlined initialization for better mobile app reliability
 */

import { nativeIntegrationService } from './nativeIntegrationService';
import { nativeAuthService } from './nativeAuthService';
import { nativeDebugService } from './nativeDebugService';

export interface SimpleInitState {
  isInitialized: boolean;
  isInitializing: boolean;
  nativeEnvironment: boolean;
  authReady: boolean;
  error: string | null;
  initStartTime: number;
  initDuration?: number;
}

class SimpleNativeInitService {
  private static instance: SimpleNativeInitService;
  private initState: SimpleInitState = {
    isInitialized: false,
    isInitializing: false,
    nativeEnvironment: false,
    authReady: false,
    error: null,
    initStartTime: 0
  };
  
  private initPromise: Promise<boolean> | null = null;

  static getInstance(): SimpleNativeInitService {
    if (!SimpleNativeInitService.instance) {
      SimpleNativeInitService.instance = new SimpleNativeInitService();
    }
    return SimpleNativeInitService.instance;
  }

  async initialize(): Promise<boolean> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.performInitialization();
    return this.initPromise;
  }

  private async performInitialization(): Promise<boolean> {
    if (this.initState.isInitialized) {
      console.log('[SimpleInit] Already initialized');
      return true;
    }

    this.initState = {
      ...this.initState,
      isInitializing: true,
      initStartTime: Date.now(),
      error: null
    };

    try {
      console.log('[SimpleInit] Starting simplified initialization...');

      // Step 1: Initialize native integration with timeout
      console.log('[SimpleInit] Step 1: Initializing native integration');
      
      const initTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Initialization timeout')), 15000);
      });
      
      await Promise.race([
        nativeIntegrationService.initialize(),
        initTimeout
      ]);
      
      const isNative = nativeIntegrationService.isRunningNatively();
      this.initState.nativeEnvironment = isNative;
      
      console.log('[SimpleInit] Native environment detected:', isNative);

      // Step 2: Initialize auth only if native (with fallback)
      if (isNative) {
        try {
          console.log('[SimpleInit] Step 2: Initializing native auth');
          await Promise.race([
            nativeAuthService.initialize(),
            new Promise<void>((resolve) => setTimeout(resolve, 5000)) // 5s timeout for auth
          ]);
          this.initState.authReady = true;
        } catch (authError) {
          console.warn('[SimpleInit] Auth initialization failed, continuing without auth:', authError);
          this.initState.authReady = false;
        }
      } else {
        console.log('[SimpleInit] Skipping auth init - not native environment');
        this.initState.authReady = false;
      }

      // Step 3: Complete initialization
      const initDuration = Date.now() - this.initState.initStartTime;
      this.initState = {
        ...this.initState,
        isInitialized: true,
        isInitializing: false,
        initDuration
      };

      console.log('[SimpleInit] Initialization completed successfully in', initDuration, 'ms');
      
      // Log debug info for troubleshooting
      if (isNative) {
        setTimeout(() => {
          nativeDebugService.logDebugInfo();
        }, 1000);
      }

      return true;

    } catch (error) {
      const initDuration = Date.now() - this.initState.initStartTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
      
      this.initState = {
        ...this.initState,
        isInitialized: false,
        isInitializing: false,
        error: errorMessage,
        initDuration
      };

      console.error('[SimpleInit] Initialization failed after', initDuration, 'ms:', errorMessage);
      return false;
    }
  }

  getInitState(): SimpleInitState {
    return { ...this.initState };
  }

  isNativeEnvironment(): boolean {
    return this.initState.nativeEnvironment;
  }

  isReady(): boolean {
    return this.initState.isInitialized && !this.initState.error;
  }

  reset(): void {
    console.log('[SimpleInit] Resetting initialization state');
    this.initState = {
      isInitialized: false,
      isInitializing: false,
      nativeEnvironment: false,
      authReady: false,
      error: null,
      initStartTime: 0
    };
    this.initPromise = null;
  }
}

export const simpleNativeInitService = SimpleNativeInitService.getInstance();