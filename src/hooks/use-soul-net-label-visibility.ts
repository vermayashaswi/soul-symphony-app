
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
  
  // Simplified visibility logic
  const shouldShowLabel = useMemo(() => {
    // Always show in tutorial step 9
    if (isTutorialStep9) {
      return true;
    }
    
    // Show if globally forced (fullscreen, etc.)
    if (globalShouldShowLabels) {
      return true;
    }
    
    // Show if selected or highlighted
    if (isSelected || isHighlighted) {
      return true;
    }
    
    // Show by default when no selection is active
    if (!selectedNodeId) {
      return true;
    }
    
    // Hide when something else is selected
    return false;
  }, [
    isTutorialStep9,
    globalShouldShowLabels,
    isSelected,
    isHighlighted,
    selectedNodeId
  ]);
  
  // Simplified dynamic properties
  const dynamicProps = useMemo(() => {
    const baseSize = nodeType === 'entity' ? 0.35 : 0.3;
    const tutorialBoost = isTutorialStep9 ? 1.2 : 1.0;
    const highlightBoost = (isSelected || isHighlighted) ? 1.1 : 1.0;
    
    return {
      fontSize: baseSize * tutorialBoost * highlightBoost,
      verticalOffset: nodeType === 'entity' ? 1.8 : 1.6,
      renderOrder: isTutorialStep9 ? 25 : (isHighlighted ? 20 : 15),
      outlineWidth: isTutorialStep9 ? 0.015 : (isHighlighted ? 0.01 : 0.008)
    };
  }, [nodeType, isTutorialStep9, isSelected, isHighlighted]);
  
  return {
    shouldShowLabel,
    isTutorialStep9,
    dynamicProps
  };
};
