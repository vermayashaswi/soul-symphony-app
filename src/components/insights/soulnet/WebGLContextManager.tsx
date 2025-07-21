
import React, { useRef, useEffect, useState } from 'react';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

interface WebGLContextManagerProps {
  children: React.ReactNode;
  onContextLost?: () => void;
  onContextRestored?: () => void;
}

export const WebGLContextManager: React.FC<WebGLContextManagerProps> = ({
  children,
  onContextLost,
  onContextRestored
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [contextStable, setContextStable] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const isNativeEnv = nativeIntegrationService.isRunningNatively();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    console.log(`[WebGLContextManager] Setting up WebGL context monitoring, native: ${isNativeEnv}`);

    const handleContextLost = (event: Event) => {
      console.error('[WebGLContextManager] WebGL context lost');
      event.preventDefault();
      setContextStable(false);
      onContextLost?.();
      
      // Attempt recovery after delay
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
      }, 1000);
    };

    const handleContextRestored = () => {
      console.log('[WebGLContextManager] WebGL context restored');
      setContextStable(true);
      setRetryCount(0);
      onContextRestored?.();
    };

    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);

    // Monitor for memory pressure on mobile
    if (isNativeEnv && 'memory' in performance) {
      const checkMemory = () => {
        const memory = (performance as any).memory;
        if (memory && memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.8) {
          console.warn('[WebGLContextManager] High memory usage detected, forcing cleanup');
          // Trigger a gentle cleanup
          if (window.gc) {
            window.gc();
          }
        }
      };

      const memoryInterval = setInterval(checkMemory, 5000);
      return () => {
        clearInterval(memoryInterval);
        canvas.removeEventListener('webglcontextlost', handleContextLost);
        canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      };
    }

    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, [isNativeEnv, onContextLost, onContextRestored]);

  if (!contextStable && retryCount < 3) {
    return (
      <div className="flex items-center justify-center p-8 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 mx-auto mb-3"></div>
          <h3 className="text-lg font-medium text-yellow-800 dark:text-yellow-300 mb-2">
            Restoring Visualization
          </h3>
          <p className="text-yellow-700 dark:text-yellow-400 text-sm">
            WebGL context is being restored... (Attempt {retryCount}/3)
          </p>
        </div>
      </div>
    );
  }

  if (!contextStable && retryCount >= 3) {
    return (
      <div className="flex items-center justify-center p-8 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
        <div className="text-center">
          <h3 className="text-lg font-medium text-red-800 dark:text-red-300 mb-2">
            Visualization Unavailable
          </h3>
          <p className="text-red-700 dark:text-red-400 text-sm mb-4">
            WebGL context could not be restored. This may be due to device limitations.
          </p>
          <button
            onClick={() => {
              setContextStable(true);
              setRetryCount(0);
            }}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {children}
    </>
  );
};

export default WebGLContextManager;
