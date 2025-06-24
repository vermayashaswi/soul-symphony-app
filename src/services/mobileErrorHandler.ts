
import { toast } from 'sonner';
import { nativeIntegrationService } from './nativeIntegrationService';

interface MobileError {
  type: 'crash' | 'network' | 'permission' | 'storage' | 'audio' | 'unknown';
  message: string;
  stack?: string;
  timestamp: number;
  platform?: string;
  appVersion?: string;
}

class MobileErrorHandler {
  private static instance: MobileErrorHandler;
  private errorQueue: MobileError[] = [];
  private isOnline: boolean = navigator.onLine;

  static getInstance(): MobileErrorHandler {
    if (!MobileErrorHandler.instance) {
      MobileErrorHandler.instance = new MobileErrorHandler();
    }
    return MobileErrorHandler.instance;
  }

  constructor() {
    this.setupGlobalErrorHandlers();
    this.setupNetworkListeners();
  }

  private setupGlobalErrorHandlers(): void {
    // Catch unhandled JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleError({
        type: 'crash',
        message: event.message || 'Unknown error occurred',
        stack: event.error?.stack,
        timestamp: Date.now(),
        platform: nativeIntegrationService.getPlatform(),
      });
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError({
        type: 'unknown',
        message: `Unhandled promise rejection: ${event.reason}`,
        stack: event.reason?.stack,
        timestamp: Date.now(),
        platform: nativeIntegrationService.getPlatform(),
      });
    });

    // Mobile-specific error handlers
    if (nativeIntegrationService.isRunningNatively()) {
      this.setupNativeErrorHandlers();
    }
  }

  private setupNativeErrorHandlers(): void {
    // Handle app state changes
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.processErrorQueue();
      }
    });

    // Handle network state changes
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processErrorQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.handleError({
        type: 'network',
        message: 'Device went offline',
        timestamp: Date.now(),
        platform: nativeIntegrationService.getPlatform(),
      });
    });
  }

  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      toast.success('Connection restored');
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      toast.error('Connection lost - working offline');
    });
  }

  handleError(error: Partial<MobileError>): void {
    const fullError: MobileError = {
      type: error.type || 'unknown',
      message: error.message || 'An error occurred',
      stack: error.stack,
      timestamp: error.timestamp || Date.now(),
      platform: error.platform || nativeIntegrationService.getPlatform(),
      appVersion: '1.0.0'
    };

    console.error('[MobileErrorHandler] Error captured:', fullError);

    // Add to queue for later processing if offline
    this.errorQueue.push(fullError);

    // Show user-friendly error message
    this.showUserFriendlyError(fullError);

    // Process immediately if online
    if (this.isOnline) {
      this.processErrorQueue();
    }
  }

  private showUserFriendlyError(error: MobileError): void {
    let userMessage = '';

    switch (error.type) {
      case 'crash':
        userMessage = 'The app encountered an unexpected error. Please try again.';
        break;
      case 'network':
        userMessage = 'Network connection lost. Some features may be limited.';
        break;
      case 'permission':
        userMessage = 'Permission required to access this feature.';
        break;
      case 'storage':
        userMessage = 'Storage error occurred. Please check available space.';
        break;
      case 'audio':
        userMessage = 'Audio recording error. Please check microphone permissions.';
        break;
      default:
        userMessage = 'Something went wrong. Please try again.';
    }

    toast.error(userMessage);
  }

  private async processErrorQueue(): Promise<void> {
    if (this.errorQueue.length === 0 || !this.isOnline) {
      return;
    }

    try {
      // In a real app, you would send these to your error tracking service
      console.log('[MobileErrorHandler] Processing error queue:', this.errorQueue);
      
      // Clear the queue after successful processing
      this.errorQueue = [];
    } catch (error) {
      console.error('[MobileErrorHandler] Failed to process error queue:', error);
    }
  }

  // Helper methods for specific error types
  handlePermissionError(permission: string): void {
    this.handleError({
      type: 'permission',
      message: `Permission denied: ${permission}`,
      timestamp: Date.now()
    });
  }

  handleAudioError(message: string): void {
    this.handleError({
      type: 'audio',
      message: `Audio error: ${message}`,
      timestamp: Date.now()
    });
  }

  handleStorageError(message: string): void {
    this.handleError({
      type: 'storage',
      message: `Storage error: ${message}`,
      timestamp: Date.now()
    });
  }

  handleNetworkError(message: string): void {
    this.handleError({
      type: 'network',
      message: `Network error: ${message}`,
      timestamp: Date.now()
    });
  }
}

export const mobileErrorHandler = MobileErrorHandler.getInstance();
