
import { useState, useCallback, useRef } from 'react';

interface SoulNetState {
  isInitialized: boolean;
  canvasReady: boolean;
  selectedNode: string | null;
  cameraZoom: number;
  error: Error | null;
  retryCount: number;
}

export const useSoulNetState = () => {
  const [state, setState] = useState<SoulNetState>({
    isInitialized: false,
    canvasReady: false,
    selectedNode: null,
    cameraZoom: 45,
    error: null,
    retryCount: 0
  });
  
  const mountedRef = useRef(true);

  const setInitialized = useCallback((value: boolean) => {
    if (!mountedRef.current) return;
    setState(prev => ({ ...prev, isInitialized: value }));
  }, []);

  const setCanvasReady = useCallback((value: boolean) => {
    if (!mountedRef.current) return;
    setState(prev => ({ ...prev, canvasReady: value }));
  }, []);

  const setSelectedNode = useCallback((nodeId: string | null) => {
    if (!mountedRef.current) return;
    setState(prev => ({ ...prev, selectedNode: nodeId }));
  }, []);

  const setCameraZoom = useCallback((zoom: number) => {
    if (!mountedRef.current) return;
    setState(prev => ({ ...prev, cameraZoom: zoom }));
  }, []);

  const setError = useCallback((error: Error | null) => {
    if (!mountedRef.current) return;
    setState(prev => ({ 
      ...prev, 
      error, 
      retryCount: error ? prev.retryCount + 1 : 0 
    }));
  }, []);

  const resetState = useCallback(() => {
    if (!mountedRef.current) return;
    setState({
      isInitialized: false,
      canvasReady: false,
      selectedNode: null,
      cameraZoom: 45,
      error: null,
      retryCount: 0
    });
  }, []);

  const cleanup = useCallback(() => {
    mountedRef.current = false;
  }, []);

  return {
    ...state,
    setInitialized,
    setCanvasReady,
    setSelectedNode,
    setCameraZoom,
    setError,
    resetState,
    cleanup
  };
};
