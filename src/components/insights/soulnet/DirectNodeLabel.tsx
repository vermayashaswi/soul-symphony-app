
import React, { useMemo, useEffect } from 'react';
import SmartTextRenderer from './SmartTextRenderer';

interface DirectNodeLabelProps {
  id: string;
  type: 'entity' | 'emotion';
  position: [number, number, number];
  isHighlighted: boolean;
  isSelected: boolean;
  shouldShowLabel: boolean;
  cameraZoom?: number;
  themeHex: string;
  nodeScale?: number;
  connectionPercentage?: number;
  showPercentage?: boolean;
  translatedText?: string;
  effectiveTheme?: 'light' | 'dark';
}

export const DirectNodeLabel: React.FC<DirectNodeLabelProps> = ({
  id,
  type,
  position,
  isHighlighted,
  isSelected,
  shouldShowLabel,
  cameraZoom = 45,
  themeHex,
  nodeScale = 1,
  connectionPercentage = 0,
  showPercentage = false,
  translatedText,
  effectiveTheme = 'light'
}) => {
  // Listen for tutorial debugging events
  useEffect(() => {
    const handleTutorialDebug = (event: CustomEvent) => {
      if (event.detail?.step === 9 && event.detail?.forceShowLabels) {
        console.log(`[DirectNodeLabel] Tutorial step 9 debug: forcing label visibility for ${id}`);
      }
    };

    window.addEventListener('tutorial-soul-net-debug', handleTutorialDebug as EventListener);
    
    return () => {
      window.removeEventListener('tutorial-soul-net-debug', handleTutorialDebug as EventListener);
    };
  }, [id, shouldShowLabel]);

  console.log(`[DirectNodeLabel] FIXED: Rendering with translated text for ${id}: "${translatedText || id}"`);

  // Use translated text if available, otherwise fallback to original id
  const displayText = translatedText || id;
  
  // FIXED: Enhanced percentage display with better formatting and debugging
  const finalDisplayText = useMemo(() => {
    if (showPercentage && connectionPercentage > 0) {
      console.log(`[DirectNodeLabel] FIXED: Adding percentage ${connectionPercentage}% to ${id} (type: ${type})`);
      return `${displayText}\n${connectionPercentage}%`;
    }
    console.log(`[DirectNodeLabel] FIXED: No percentage for ${id}, showPercentage=${showPercentage}, connectionPercentage=${connectionPercentage}`);
    return displayText;
  }, [displayText, showPercentage, connectionPercentage, id, type]);

  // ENHANCED: Improved label positioning with better offset calculation for different node types
  const labelOffset = useMemo(() => {
    // Better offset calculation for different node types and scales
    const baseOffset = type === 'entity' ? 2.2 : 3.0; // Increased for better visibility
    const scaledOffset = baseOffset * Math.max(0.8, Math.min(2.5, nodeScale));
    
    console.log(`[DirectNodeLabel] FIXED: Label offset for ${id} (${type}): ${scaledOffset} (scale: ${nodeScale})`);
    return [0, scaledOffset, 0] as [number, number, number];
  }, [type, nodeScale, id]);

  // FIXED: Larger text size for better percentage visibility - 15x larger base size
  const textSize = useMemo(() => {
    const zoom = Math.max(10, Math.min(100, cameraZoom));
    const baseSize = 6.0; // Increased from 0.4 to 6.0 (15x larger)
    const zoomFactor = Math.max(0.8, Math.min(1.5, (50 - zoom) * 0.02 + 1));
    const finalSize = Math.max(3.0, Math.min(12.0, baseSize * zoomFactor));
    
    console.log(`[DirectNodeLabel] FIXED: Large text size for ${id}: ${finalSize} (zoom: ${zoom})`);
    return finalSize;
  }, [cameraZoom, id]);

  // FIXED: Enhanced text color logic with better contrast and percentage-specific colors
  const textColor = useMemo(() => {
    let color;
    
    if (isSelected) {
      color = '#ffffff'; // Always white for selected nodes
    } else if (isHighlighted && showPercentage) {
      // Special color for percentage display - more vibrant
      color = type === 'entity' ? '#ffffff' : '#ffff00'; // Yellow for emotion percentages
    } else if (isHighlighted) {
      // For highlighted nodes without percentages
      color = type === 'entity' ? '#ffffff' : themeHex;
    } else {
      // Default colors based on theme with higher contrast
      if (effectiveTheme === 'light') {
        color = '#1a1a1a'; // Dark gray for light theme
      } else {
        color = '#e5e5e5'; // Light gray for dark theme
      }
    }
    
    console.log(`[DirectNodeLabel] FIXED: Text color for ${id}: ${color} (selected: ${isSelected}, highlighted: ${isHighlighted}, showPercentage: ${showPercentage}, theme: ${effectiveTheme})`);
    return color;
  }, [isSelected, isHighlighted, type, themeHex, effectiveTheme, showPercentage, id]);

  const labelPosition: [number, number, number] = [
    position[0] + labelOffset[0],
    position[1] + labelOffset[1],
    position[2] + labelOffset[2]
  ];

  // Enhanced visibility check for tutorial step 9
  const enhancedShouldShowLabel = useMemo(() => {
    // Check if we're in tutorial step 9 by looking at body attribute
    const currentTutorialStep = document.body.getAttribute('data-current-step');
    const isTutorialStep9 = currentTutorialStep === '9';
    
    if (isTutorialStep9) {
      console.log(`[DirectNodeLabel] Tutorial step 9 detected, forcing label visibility for ${id}`);
      return true; // Always show labels during tutorial step 9
    }
    
    return shouldShowLabel;
  }, [shouldShowLabel, id]);

  if (!enhancedShouldShowLabel || !finalDisplayText) {
    console.log(`[DirectNodeLabel] FIXED: Not rendering label for ${id}: shouldShow=${enhancedShouldShowLabel}, text="${finalDisplayText}"`);
    return null;
  }

  // ENHANCED: Additional logging for percentage display debugging
  if (showPercentage && connectionPercentage > 0) {
    console.log(`[DirectNodeLabel] FIXED: RENDERING PERCENTAGE: ${id} (${type}) shows ${connectionPercentage}% with text: "${finalDisplayText}"`);
  }

  console.log(`[DirectNodeLabel] FIXED: Rendering large text "${finalDisplayText}" at position`, labelPosition, 'with size:', textSize, 'color:', textColor);

  return (
    <SmartTextRenderer
      text={finalDisplayText}
      position={labelPosition}
      color={textColor}
      size={textSize}
      visible={true}
      renderOrder={15}
      bold={isHighlighted || isSelected || showPercentage} // Make percentage text bold
      outlineWidth={isSelected ? 0.6 : (showPercentage ? 0.4 : 0.3)} // Stronger outline for percentages
      outlineColor={showPercentage ? '#000000' : (isSelected ? '#000000' : '#333333')}
      maxWidth={400} // Increased max width for larger text and percentages
    />
  );
};

export default DirectNodeLabel;
