
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

interface TranslationStatus {
  [nodeId: string]: boolean;
}

interface SoulNetTranslationContextType {
  registerNode: (nodeId: string) => void;
  markNodeTranslated: (nodeId: string) => void;
  isAllTranslated: boolean;
  translationProgress: number;
  reset: () => void;
}

const SoulNetTranslationContext = createContext<SoulNetTranslationContextType | undefined>(undefined);

interface SoulNetTranslationTrackerProps {
  children: React.ReactNode;
  expectedNodes: string[];
  onAllTranslated?: () => void;
}

export const SoulNetTranslationTracker: React.FC<SoulNetTranslationTrackerProps> = ({
  children,
  expectedNodes,
  onAllTranslated
}) => {
  const [translationStatus, setTranslationStatus] = useState<TranslationStatus>({});
  const [isAllTranslated, setIsAllTranslated] = useState(false);
  const onAllTranslatedRef = useRef(onAllTranslated);
  
  // Update ref when callback changes
  useEffect(() => {
    onAllTranslatedRef.current = onAllTranslated;
  }, [onAllTranslated]);

  // Initialize status for expected nodes
  useEffect(() => {
    const initialStatus: TranslationStatus = {};
    expectedNodes.forEach(nodeId => {
      initialStatus[nodeId] = false;
    });
    setTranslationStatus(initialStatus);
    setIsAllTranslated(false);
    console.log('[SoulNetTranslationTracker] Initialized with', expectedNodes.length, 'nodes');
  }, [expectedNodes]);

  const registerNode = useCallback((nodeId: string) => {
    setTranslationStatus(prev => {
      if (prev[nodeId] === undefined) {
        console.log('[SoulNetTranslationTracker] Registering node:', nodeId);
        return { ...prev, [nodeId]: false };
      }
      return prev;
    });
  }, []);

  const markNodeTranslated = useCallback((nodeId: string) => {
    setTranslationStatus(prev => {
      if (prev[nodeId] === false) {
        console.log('[SoulNetTranslationTracker] Node translated:', nodeId);
        const newStatus = { ...prev, [nodeId]: true };
        
        // Check if all nodes are translated
        const allTranslated = Object.values(newStatus).every(status => status === true);
        
        if (allTranslated && !isAllTranslated) {
          console.log('[SoulNetTranslationTracker] All nodes translated!');
          setIsAllTranslated(true);
          // Use timeout to ensure state update completes first
          setTimeout(() => {
            onAllTranslatedRef.current?.();
          }, 0);
        }
        
        return newStatus;
      }
      return prev;
    });
  }, [isAllTranslated]);

  const reset = useCallback(() => {
    console.log('[SoulNetTranslationTracker] Resetting translation status');
    setTranslationStatus({});
    setIsAllTranslated(false);
  }, []);

  const translationProgress = React.useMemo(() => {
    const totalNodes = Object.keys(translationStatus).length;
    if (totalNodes === 0) return 0;
    
    const translatedNodes = Object.values(translationStatus).filter(status => status).length;
    return Math.round((translatedNodes / totalNodes) * 100);
  }, [translationStatus]);

  const value: SoulNetTranslationContextType = {
    registerNode,
    markNodeTranslated,
    isAllTranslated,
    translationProgress,
    reset
  };

  return (
    <SoulNetTranslationContext.Provider value={value}>
      {children}
    </SoulNetTranslationContext.Provider>
  );
};

export const useSoulNetTranslation = (): SoulNetTranslationContextType => {
  const context = useContext(SoulNetTranslationContext);
  if (context === undefined) {
    throw new Error('useSoulNetTranslation must be used within a SoulNetTranslationTracker');
  }
  return context;
};
