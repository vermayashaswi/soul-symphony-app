
export const checkReactReadiness = (): boolean => {
  try {
    // Check if React is available
    if (typeof window === 'undefined') return false;
    
    // Check if React hooks are available
    const React = (window as any).React;
    if (!React || !React.useState || !React.useEffect) {
      console.warn('[ReactReadiness] React hooks not available yet');
      return false;
    }
    
    // Check if document is ready
    if (document.readyState === 'loading') {
      console.warn('[ReactReadiness] Document still loading');
      return false;
    }
    
    console.log('[ReactReadiness] React is ready');
    return true;
  } catch (error) {
    console.error('[ReactReadiness] Error checking React readiness:', error);
    return false;
  }
};

export const waitForReactReadiness = (maxWait: number = 5000): Promise<boolean> => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const check = () => {
      if (checkReactReadiness()) {
        resolve(true);
        return;
      }
      
      if (Date.now() - startTime > maxWait) {
        console.error('[ReactReadiness] Timeout waiting for React readiness');
        resolve(false);
        return;
      }
      
      setTimeout(check, 100);
    };
    
    check();
  });
};
