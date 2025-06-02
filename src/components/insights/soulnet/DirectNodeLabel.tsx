
import React, { useMemo, useEffect } from 'react';
import SimplifiedTextRenderer from './SimplifiedTextRenderer';

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

  console.log(`[DirectNodeLabel] Rendering with translated text for ${id}: "${translatedText || id}"`);

  // Use translated text if available, otherwise fallback to original id
  const displayText = translatedText || id;
  
  // Enhanced visibility check for tutorial step 9
  const enhancedShouldShowLabel = useMemo(() => {
    const currentTutorialStep = document.body.getAttribute('data-current-step');
    const isTutorialStep9 = currentTutorialStep === '9';
    
    if (isTutorialStep9) {
      console.log(`[DirectNodeLabel] Tutorial step 9 detected, forcing label visibility for ${id}`);
      return true;
    }
    
    return shouldShowLabel;
  }, [shouldShowLabel, id]);

  // Calculate label positioning with improved offset calculation
  const labelOffset = useMemo(() => {
    const baseOffset = type === 'entity' ? 2.2 : 3.0;
    const scaledOffset = baseOffset * Math.max(0.6, Math.min(2.2, nodeScale));
    
    console.log(`[DirectNodeLabel] Label offset for ${id} (${type}): ${scaledOffset} (scale: ${nodeScale})`);
    return [0, scaledOffset, 0] as [number, number, number];
  }, [type, nodeScale, id]);

  // Calculate percentage label positioning (below main label)
  const percentageLabelOffset = useMemo(() => {
    const baseOffset = type === 'entity' ? 1.4 : 2.2;
    const scaledOffset = baseOffset * Math.max(0.6, Math.min(2.2, nodeScale));
    
    return [0, scaledOffset, 0] as [number, number, number];
  }, [type, nodeScale]);

  // Calculate text properties with larger base size
  const textSize = useMemo(() => {
    const zoom = Math.max(10, Math.min(100, cameraZoom));
    const baseSize = 4.0; // Large base size for better visibility
    const zoomFactor = Math.max(0.7, Math.min(1.3, (50 - zoom) * 0.02 + 1));
    const finalSize = Math.max(2.0, Math.min(8.0, baseSize * zoomFactor));
    
    console.log(`[DirectNodeLabel] Text size for ${id}: ${finalSize} (zoom: ${zoom})`);
    return finalSize;
  }, [cameraZoom, id]);

  // Percentage text size (69% of main text size)
  const percentageTextSize = useMemo(() => {
    return textSize * 0.69;
  }, [textSize]);

  // FIXED: Enhanced text color logic with better contrast for light theme
  const textColor = useMemo(() => {
    let color;
    
    if (isSelected) {
      // FIXED: For selected entity nodes in light theme, use black for better contrast
      if (type === 'entity' && effectiveTheme === 'light') {
        color = '#000000'; // Black text for selected entities in light theme
      } else {
        color = '#ffffff'; // White for other selected nodes
      }
    } else if (isHighlighted) {
      // For highlighted nodes, use white for entities, theme color for emotions
      color = type === 'entity' ? '#ffffff' : themeHex;
    } else {
      // Better default colors based on theme with higher contrast
      if (effectiveTheme === 'light') {
        color = '#1a1a1a'; // Dark gray for light theme
      } else {
        color = '#e5e5e5'; // Light gray for dark theme
      }
    }
    
    console.log(`[DirectNodeLabel] Text color for ${id}: ${color} (selected: ${isSelected}, highlighted: ${isHighlighted}, theme: ${effectiveTheme}, type: ${type})`);
    return color;
  }, [isSelected, isHighlighted, type, themeHex, effectiveTheme, id]);

  // Calculate final positions
  const mainLabelPosition: [number, number, number] = [
    position[0] + labelOffset[0],
    position[1] + labelOffset[1],
    position[2] + labelOffset[2]
  ];

  const percentageLabelPosition: [number, number, number] = [
    position[0] + percentageLabelOffset[0],
    position[1] + percentageLabelOffset[1],
    position[2] + percentageLabelOffset[2]
  ];

  if (!enhancedShouldShowLabel || !displayText) {
    console.log(`[DirectNodeLabel] Not rendering label for ${id}: shouldShow=${enhancedShouldShowLabel}, text="${displayText}"`);
    return null;
  }

  // Enhanced logging for percentage display
  if (showPercentage && connectionPercentage > 0) {
    console.log(`[DirectNodeLabel] RENDERING PERCENTAGE: ${id} shows ${connectionPercentage}% at size ${percentageTextSize}`);
  }

  console.log(`[DirectNodeLabel] Rendering main text "${displayText}" at position`, mainLabelPosition, 'with size:', textSize, 'color:', textColor);

  return (
    <>
      {/* Main node label */}
      <SimplifiedTextRenderer
        text={displayText}
        position={mainLabelPosition}
        color={textColor}
        size={textSize}
        visible={true}
        renderOrder={15}
        bold={isHighlighted || isSelected}
        outlineWidth={isSelected ? 0.4 : 0.2}
        outlineColor={isSelected ? '#000000' : '#333333'}
        maxWidth={250}
      />
      
      {/* Percentage label (displayed below main label) */}
      {showPercentage && connectionPercentage > 0 && (
        <SimplifiedTextRenderer
          text={`${connectionPercentage}%`}
          position={percentageLabelPosition}
          color={textColor}
          size={percentageTextSize}
          visible={true}
          renderOrder={16}
          bold={false}
          outlineWidth={0.1}
          outlineColor={isSelected ? '#000000' : '#333333'}
          maxWidth={150}
        />
      )}
    </>
  );
};

export default DirectNodeLabel;
