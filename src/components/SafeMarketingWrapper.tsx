import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasThemeError: boolean;
  error: Error | null;
}

// Error boundary specifically for theme-related errors on marketing pages
class SafeMarketingWrapper extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasThemeError: false, 
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if this is the specific useTheme error
    const isThemeError = error.message.includes('useTheme must be used within a ThemeProvider');
    
    if (isThemeError) {
      console.error('🚨 CAUGHT THEME ERROR ON MARKETING PAGE:', error);
      console.error('This confirms a component is using useTheme outside ThemeProvider');
      return { 
        hasThemeError: true, 
        error
      };
    }
    
    // Re-throw other errors
    throw error;
  }

  componentDidCatch(error: Error, errorInfo: any): void {
    if (this.state.hasThemeError) {
      console.error("SafeMarketingWrapper caught theme error:", error, errorInfo);
      console.error("Error boundary activated for theme error on marketing page");
    }
  }

  render(): ReactNode {
    if (this.state.hasThemeError) {
      // Render a basic marketing page without any theme dependencies
      return (
        <div className="min-h-screen bg-white">
          <div className="flex flex-col items-center justify-center min-h-screen p-8">
            <div className="text-center max-w-md">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                SOULO
              </h1>
              <p className="text-lg text-gray-600 mb-8">
                Voice journaling app for mental wellness
              </p>
              <div className="space-y-4">
                <button 
                  onClick={() => window.location.href = '/app'}
                  className="block w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Launch App
                </button>
                <button 
                  onClick={() => window.location.reload()}
                  className="block w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Reload Page
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default SafeMarketingWrapper;