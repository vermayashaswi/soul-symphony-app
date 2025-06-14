
import React, { Component, ReactNode } from 'react';
import { checkReactReadiness } from '@/utils/react-readiness';
import { MinimalThemeProvider } from '@/hooks/use-minimal-theme';

interface Props {
  children: ReactNode;
  isMarketingPage?: boolean;
}

interface State {
  isReactReady: boolean;
  hasError: boolean;
}

export class SafeThemeWrapper extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      isReactReady: checkReactReadiness(),
      hasError: false
    };
  }

  static getDerivedStateFromError(): State {
    return { isReactReady: false, hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[SafeThemeWrapper] Theme error:', error);
  }

  componentDidMount() {
    if (!this.state.isReactReady) {
      // Wait for React to be ready
      const checkReady = () => {
        if (checkReactReadiness()) {
          this.setState({ isReactReady: true });
        } else {
          setTimeout(checkReady, 100);
        }
      };
      checkReady();
    }
  }

  render() {
    const { children, isMarketingPage = false } = this.props;
    const { isReactReady, hasError } = this.state;

    // If there's an error or React isn't ready, provide minimal fallback
    if (hasError || !isReactReady) {
      return (
        <div className="min-h-screen bg-white text-gray-900">
          {children}
        </div>
      );
    }

    // For marketing pages, use minimal theme
    if (isMarketingPage) {
      return (
        <MinimalThemeProvider>
          {children}
        </MinimalThemeProvider>
      );
    }

    // For app pages, children should be wrapped with full ThemeProvider by parent
    return <>{children}</>;
  }
}
