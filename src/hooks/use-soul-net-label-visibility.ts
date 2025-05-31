
import { useMemo } from 'react';
import { useTutorial } from '@/contexts/TutorialContext';

interface UseSoulNetLabelVisibilityProps {
  nodeId: string;
  nodeType: 'entity' | 'emotion';
  isSelected: boolean;
  isHighlighted: boolean;
  isFullScreen: boolean;
  selectedNodeId: string | null;
  highlightedNodes: Set<string>;
  globalShouldShowLabels: boolean;
}

export const useSoulNetLabelVisibility = ({
  nodeId,
  nodeType,
  isSelected,
  isHighlighted,
  isFullScreen,
  selectedNodeId,
  highlightedNodes,
  globalShouldShowLabels
}: UseSoulNetLabelVisibilityProps) => {
  const { isInStep } = useTutorial();
  
  // Tutorial step 9 detection
  const isTutorialStep9 = isInStep(9);
  
  // Consolidated visibility logic with clear priority
  const shouldShowLabel = useMemo(() => {
    // Priority 1: Tutorial step 9 - always show all labels
    if (isTutorialStep9) {
      return true;
    }
    
    // Priority 2: Global force show (fullscreen, etc.)
    if (globalShouldShowLabels) {
      return true;
    }
    
    // Priority 3: Node is selected
    if (isSelected) {
      return true;
    }
    
    // Priority 4: Node is highlighted (connected to selected)
    if (isHighlighted && selectedNodeId) {
      return true;
    }
    
    // Priority 5: No selection active and not in fullscreen
    if (!selectedNodeId && !isFullScreen) {
      return false;
    }
    
    // Default: show in fullscreen when no specific selection
    return isFullScreen;
  }, [
    isTutorialStep9,
    globalShouldShowLabels,
    isSelected,
    isHighlighted,
    selectedNodeId,
    isFullScreen
  ]);
  
  // Calculate dynamic properties based on state
  const dynamicProps = useMemo(() => {
    const baseSize = nodeType === 'entity' ? 0.45 : 0.4;
    const tutorialBoost = isTutorialStep9 ? 1.3 : 1.0;
    const highlightBoost = isHighlighted ? 1.1 : 1.0;
    
    return {
      fontSize: baseSize * tutorialBoost * highlightBoost,
      verticalOffset: nodeType === 'entity' ? 2.2 : 2.0,
      renderOrder: isTutorialStep9 ? 25 : (isHighlighted ? 20 : 15),
      outlineWidth: isTutorialStep9 ? 0.018 : (isHighlighted ? 0.012 : 0.008)
    };
  }, [nodeType, isTutorialStep9, isHighlighted]);
  
  return {
    shouldShowLabel,
    isTutorialStep9,
    dynamicProps
  };
};
