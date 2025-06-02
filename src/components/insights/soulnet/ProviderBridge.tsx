
import React from 'react';
import { TranslationProvider } from '@/contexts/TranslationContext';
import ContextSafetyWrapper from './ContextSafetyWrapper';
import RouteAwareRenderer from './RouteAwareRenderer';

interface ProviderBridgeProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const ProviderBridge: React.FC<ProviderBridgeProps> = ({ 
  children, 
  fallback = <div>Loading...</div> 
}) => {
  return (
    <RouteAwareRenderer fallback={fallback}>
      <ContextSafetyWrapper>
        {children}
      </ContextSafetyWrapper>
    </RouteAwareRenderer>
  );
};

// Alternative bridge that creates its own translation context if needed
export const StandaloneProviderBridge: React.FC<ProviderBridgeProps> = ({ 
  children, 
  fallback = <div>Loading...</div> 
}) => {
  return (
    <TranslationProvider>
      <RouteAwareRenderer fallback={fallback}>
        <ContextSafetyWrapper>
          {children}
        </ContextSafetyWrapper>
      </RouteAwareRenderer>
    </TranslationProvider>
  );
};

export default ProviderBridge;
