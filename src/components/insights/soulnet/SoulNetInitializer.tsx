
import React, { useState, useEffect, useRef } from 'react';

interface SoulNetInitializerProps {
  children: React.ReactNode;
  onInitialized: () => void;
  hasData: boolean;
}

export const SoulNetInitializer: React.FC<SoulNetInitializerProps> = ({
  children,
  onInitialized,
  hasData
}) => {
  const [isReady, setIsReady] = useState(false);
  const initRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!hasData || initRef.current || !mountedRef.current) return;

    const initialize = async () => {
      try {
        initRef.current = true;
        
        // Simple delay to ensure components are ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (mountedRef.current) {
          setIsReady(true);
          onInitialized();
        }
      } catch (error) {
        console.error('SoulNet initialization error:', error);
        if (mountedRef.current) {
          setIsReady(true);
          onInitialized();
        }
      }
    };

    initialize();
  }, [hasData, onInitialized]);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center" style={{ height: '500px' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Preparing visualization...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default SoulNetInitializer;
