
import React from 'react';
import { cn } from '@/lib/utils';

interface CenteredButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

// WebView detection utility
const isWebView = (): boolean => {
  try {
    const userAgent = navigator.userAgent;
    return userAgent.includes('wv') || 
           userAgent.includes('WebView') || 
           window.location.protocol === 'file:' ||
           (window as any).AndroidInterface !== undefined ||
           document.URL.indexOf('http://') === -1 && document.URL.indexOf('https://') === -1;
  } catch {
    return false;
  }
};

export function CenteredButton({ 
  children, 
  className, 
  variant = 'default',
  size = 'default',
  ...props 
}: CenteredButtonProps) {
  const baseStyles = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background";
  
  const variants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    outline: "border border-input hover:bg-accent hover:text-accent-foreground"
  };
  
  const sizes = {
    default: "h-10 py-2 px-4",
    sm: "h-9 px-3 rounded-md",
    lg: "h-11 px-8 rounded-md", 
    icon: "h-10 w-10"
  };

  // Enhanced centering for WebView environments
  const webViewCenteringStyles = isWebView() ? `
    /* WebView-specific centering fixes */
    position: relative !important;
    left: 50% !important;
    top: 50% !important;
    transform: translate(-50%, -50%) translate3d(0, 0, 0) !important;
    -webkit-transform: translate(-50%, -50%) translate3d(0, 0, 0) !important;
    margin: 0 !important;
  ` : '';

  const centeringStyles = "relative transform-gpu";
  
  // Create enhanced style element for WebView
  React.useEffect(() => {
    if (isWebView()) {
      const styleId = 'webview-button-centering';
      let style = document.getElementById(styleId) as HTMLStyleElement;
      
      if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        document.head.appendChild(style);
      }
      
      style.textContent = `
        .webview-centered-button {
          -webkit-user-select: none !important;
          -webkit-touch-callout: none !important;
          -webkit-tap-highlight-color: transparent !important;
          position: relative !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          margin: auto !important;
          -webkit-transform: translate3d(0, 0, 0) !important;
          transform: translate3d(0, 0, 0) !important;
        }
        
        .webview-centered-button > * {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
      `;
    }
  }, []);

  return (
    <button
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        centeringStyles,
        isWebView() ? 'webview-centered-button' : '',
        className
      )}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        minHeight: size === 'icon' ? '44px' : undefined,
        minWidth: size === 'icon' ? '44px' : undefined,
        flexShrink: 0,
        position: 'relative',
        margin: isWebView() ? 'auto' : undefined,
        WebkitTransform: isWebView() ? 'translate3d(0, 0, 0)' : undefined,
        transform: isWebView() ? 'translate3d(0, 0, 0)' : undefined
      }}
      {...props}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%'
      }}>
        {children}
      </div>
    </button>
  );
}
