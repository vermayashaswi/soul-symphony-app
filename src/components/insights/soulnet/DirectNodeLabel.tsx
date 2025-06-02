
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
        // Force label to be visible during tutorial step 9
        if (!shouldShowLabel) {
          console.log(`[DirectNodeLabel] Overriding shouldShowLabel for tutorial step 9`);
        }
      }
    };

    window.addEventListener('tutorial-soul-net-debug', handleTutorialDebug as EventListener);
    
    return () => {
      window.removeEventListener('tutorial-soul-net-debug', handleTutorialDebug as EventListener);
    };
  }, [id, shouldShowLabel]);

  console.log(`[DirectNodeLabel] Rendering with translated text for ${id}: "${translatedText || id}"`);

  // Use translated text if available, otherwise fallback to original id
  const displayText = translatedText || id;
  
  // ENHANCED: Improved connection percentage display logic
  const finalDisplayText = useMemo(() => {
    if (isHighlighted && showPercentage && connectionPercentage > 0) {
      console.log(`[DirectNodeLabel] Adding percentage to ${id}: ${connectionPercentage}%`);
      return `${displayText}\n${connectionPercentage}%`;
    }
    return displayText;
  }, [displayText, isHighlighted, showPercentage, connectionPercentage, id]);

  // ENHANCED: Standardized label positioning with better offset calculation
  const labelOffset = useMemo(() => {
    // Improved offset calculation for different node types and scales
    const baseOffset = type === 'entity' ? 2.0 : 2.8; // Slightly increased for better visibility
    const scaledOffset = baseOffset * Math.max(0.6, Math.min(2.2, nodeScale));
    
    console.log(`[DirectNodeLabel] Label offset for ${id} (${type}): ${scaledOffset} (scale: ${nodeScale})`);
    return [0, scaledOffset, 0] as [number, number, number];
  }, [type, nodeScale, id]);

  // Calculate text properties - 10x larger base size
  const textSize = useMemo(() => {
    const zoom = Math.max(10, Math.min(100, cameraZoom));
    const baseSize = 4.0; // Increased from 0.4 to 4.0 (10x larger)
    const zoomFactor = Math.max(0.7, Math.min(1.3, (50 - zoom) * 0.02 + 1));
    const finalSize = Math.max(2.0, Math.min(8.0, baseSize * zoomFactor));
    
    console.log(`[DirectNodeLabel] Text size for ${id}: ${finalSize} (zoom: ${zoom})`);
    return finalSize;
  }, [cameraZoom, id]);

  // FIXED: Enhanced text color logic with better contrast handling
  const textColor = useMemo(() => {
    let color;
    
    if (isSelected) {
      color = '#ffffff'; // Always white for selected nodes
    } else if (isHighlighted) {
      // For highlighted nodes, use white for entities, theme color for emotions
      color = type === 'entity' ? '#ffffff' : themeHex;
    } else {
      // FIXED: Better default colors based on theme with higher contrast
      if (effectiveTheme === 'light') {
        color = '#1a1a1a'; // Dark gray for light theme (better contrast than black)
      } else {
        color = '#e5e5e5'; // Light gray for dark theme (better contrast)
      }
    }
    
    console.log(`[DirectNodeLabel] Text color for ${id}: ${color} (selected: ${isSelected}, highlighted: ${isHighlighted}, theme: ${effectiveTheme})`);
    return color;
  }, [isSelected, isHighlighted, type, themeHex, effectiveTheme, id]);

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
    console.log(`[DirectNodeLabel] Not rendering label for ${id}: shouldShow=${enhancedShouldShowLabel}, text="${finalDisplayText}"`);
    return null;
  }

  console.log(`[DirectNodeLabel] Rendering text "${finalDisplayText}" at position`, labelPosition, 'with size:', textSize, 'color:', textColor);

  return (
    <SmartTextRenderer
      text={finalDisplayText}
      position={labelPosition}
      color={textColor}
      size={textSize}
      visible={true}
      renderOrder={15}
      bold={isHighlighted || isSelected}
      outlineWidth={isSelected ? 0.4 : 0.2} // Scaled outline width for larger text
      outlineColor={isSelected ? '#000000' : '#333333'}
      maxWidth={250} // Increased max width for larger text
    />
  );
};

export default DirectNodeLabel;
