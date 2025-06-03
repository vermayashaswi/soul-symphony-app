
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

  // Use translated text if available, otherwise fallback to original id
  const displayText = translatedText || id;
  
  console.log(`[DirectNodeLabel] Rendering text for ${id}: "${displayText}"`);
  
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

  // Label positioning with better spacing to prevent overlap
  const labelOffset = useMemo(() => {
    const baseOffset = type === 'entity' ? 2.8 : 3.5;
    const scaledOffset = baseOffset * Math.max(0.8, Math.min(2.5, nodeScale));
    const highlightSpacing = (isHighlighted || isSelected) ? 0.5 : 0;
    const finalOffset = scaledOffset + highlightSpacing;
    
    console.log(`[DirectNodeLabel] Label offset for ${id} (${type}): ${finalOffset} (scale: ${nodeScale}, highlighted: ${isHighlighted})`);
    return [0, finalOffset, 0] as [number, number, number];
  }, [type, nodeScale, id, isHighlighted, isSelected]);

  // Percentage label positioning to avoid main label overlap
  const percentageLabelOffset = useMemo(() => {
    const baseOffset = type === 'entity' ? 1.8 : 2.6;
    const scaledOffset = baseOffset * Math.max(0.8, Math.min(2.5, nodeScale));
    const highlightSpacing = (isHighlighted || isSelected) ? 0.3 : 0;
    const finalOffset = scaledOffset + highlightSpacing;
    
    return [0, finalOffset, 0] as [number, number, number];
  }, [type, nodeScale, isHighlighted, isSelected]);

  // Calculate text properties with proper size scaling
  const textSize = useMemo(() => {
    const zoom = Math.max(10, Math.min(100, cameraZoom));
    const baseSize = 1.2;
    const zoomFactor = Math.max(0.7, Math.min(1.3, (50 - zoom) * 0.02 + 1));
    const finalSize = Math.max(0.8, Math.min(2.0, baseSize * zoomFactor));
    
    console.log(`[DirectNodeLabel] Text size for ${id}: ${finalSize} (zoom: ${zoom})`);
    return finalSize;
  }, [cameraZoom, id]);

  // Percentage text size (69% of main text size)
  const percentageTextSize = useMemo(() => {
    return textSize * 0.69;
  }, [textSize]);

  // Enhanced text color logic with better contrast for light theme
  const textColor = useMemo(() => {
    let color;
    
    if (isSelected) {
      if (effectiveTheme === 'light') {
        color = type === 'entity' ? '#000000' : '#1a1a1a';
      } else {
        color = '#ffffff';
      }
    } else if (isHighlighted) {
      if (effectiveTheme === 'light') {
        color = type === 'entity' ? '#2d2d2d' : themeHex;
      } else {
        color = type === 'entity' ? '#ffffff' : themeHex;
      }
    } else {
      if (effectiveTheme === 'light') {
        color = '#0a0a0a';
      } else {
        color = '#f0f0f0';
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
      {/* Main node label using SimplifiedTextRenderer */}
      <SimplifiedTextRenderer
        text={displayText}
        position={mainLabelPosition}
        color={textColor}
        size={textSize}
        visible={true}
        bold={isHighlighted || isSelected}
        outlineWidth={isSelected ? 0.1 : 0.05}
        outlineColor={effectiveTheme === 'light' ? '#ffffff' : '#000000'}
        maxWidth={40}
      />
      
      {/* Percentage label (displayed below main label with proper spacing) */}
      {showPercentage && connectionPercentage > 0 && (
        <SimplifiedTextRenderer
          text={`${connectionPercentage}%`}
          position={percentageLabelPosition}
          color={textColor}
          size={percentageTextSize}
          visible={true}
          bold={false}
          outlineWidth={0.03}
          outlineColor={effectiveTheme === 'light' ? '#ffffff' : '#000000'}
          maxWidth={20}
        />
      )}
    </>
  );
};

export default DirectNodeLabel;
