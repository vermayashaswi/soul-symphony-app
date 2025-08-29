// Service to handle messages from service worker
class ServiceWorkerMessageHandler {
  private static instance: ServiceWorkerMessageHandler;
  
  static getInstance(): ServiceWorkerMessageHandler {
    if (!ServiceWorkerMessageHandler.instance) {
      ServiceWorkerMessageHandler.instance = new ServiceWorkerMessageHandler();
    }
    return ServiceWorkerMessageHandler.instance;
  }

  initialize() {
    // Listen for messages from service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('[ServiceWorkerMessageHandler] Received message:', event.data);
        
        if (event.data?.type === 'NAVIGATE_TO' && event.data?.url) {
          this.handleNavigation(event.data.url);
        }
      });
    }
  }

  private handleNavigation(url: string) {
    console.log('[ServiceWorkerMessageHandler] Navigating to:', url);
    
    // Use native navigation service if available
    if ((window as any).nativeNavigationService) {
      (window as any).nativeNavigationService.navigateToPath(url, { replace: true, force: true });
    } else {
      // Fallback to history API
      window.history.pushState(null, '', url);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }
}

export const serviceWorkerMessageHandler = ServiceWorkerMessageHandler.getInstance();