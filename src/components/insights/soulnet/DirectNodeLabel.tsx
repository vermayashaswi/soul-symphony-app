
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

  // FIXED: Improved label positioning with better spacing to prevent overlap
  const labelOffset = useMemo(() => {
    // Increase base offset and add dynamic spacing based on node type and scale
    const baseOffset = type === 'entity' ? 2.8 : 3.5; // Increased from 2.2/3.0
    const scaledOffset = baseOffset * Math.max(0.8, Math.min(2.5, nodeScale));
    
    // Add additional spacing for highlighted nodes to prevent overlap
    const highlightSpacing = (isHighlighted || isSelected) ? 0.5 : 0;
    const finalOffset = scaledOffset + highlightSpacing;
    
    console.log(`[DirectNodeLabel] FIXED label offset for ${id} (${type}): ${finalOffset} (scale: ${nodeScale}, highlighted: ${isHighlighted})`);
    return [0, finalOffset, 0] as [number, number, number];
  }, [type, nodeScale, id, isHighlighted, isSelected]);

  // FIXED: Better percentage label positioning to avoid main label overlap
  const percentageLabelOffset = useMemo(() => {
    // Position percentage below the main label with sufficient spacing
    const baseOffset = type === 'entity' ? 1.8 : 2.6; // Increased spacing
    const scaledOffset = baseOffset * Math.max(0.8, Math.min(2.5, nodeScale));
    
    // Add spacing for highlighted nodes
    const highlightSpacing = (isHighlighted || isSelected) ? 0.3 : 0;
    const finalOffset = scaledOffset + highlightSpacing;
    
    return [0, finalOffset, 0] as [number, number, number];
  }, [type, nodeScale, isHighlighted, isSelected]);

  // ENHANCED: Different font sizes for entity vs emotion nodes
  const textSize = useMemo(() => {
    const zoom = Math.max(10, Math.min(100, cameraZoom));
    
    // Different base sizes for entity and emotion nodes
    const baseSize = type === 'entity' ? 1.4 : 1.0; // Entities are larger (1.4 vs 1.0)
    
    const zoomFactor = Math.max(0.7, Math.min(1.3, (50 - zoom) * 0.02 + 1));
    const finalSize = Math.max(0.8, Math.min(2.0, baseSize * zoomFactor));
    
    console.log(`[DirectNodeLabel] ENHANCED text size for ${id} (${type}): ${finalSize} (base: ${baseSize}, zoom: ${zoom})`);
    return finalSize;
  }, [cameraZoom, id, type]);

  // Percentage text size (69% of main text size)
  const percentageTextSize = useMemo(() => {
    return textSize * 0.69;
  }, [textSize]);

  // FIXED: Enhanced text color logic with much better contrast for light theme
  const textColor = useMemo(() => {
    let color;
    
    if (isSelected) {
      // FIXED: For selected nodes, use high contrast colors based on theme
      if (effectiveTheme === 'light') {
        // In light theme, use dark colors for selected nodes for maximum contrast
        color = type === 'entity' ? '#000000' : '#1a1a1a'; // Black for entities, very dark gray for emotions
      } else {
        // In dark theme, use bright white for selected nodes
        color = '#ffffff';
      }
    } else if (isHighlighted) {
      // For highlighted nodes, use theme-appropriate colors
      if (effectiveTheme === 'light') {
        color = type === 'entity' ? '#2d2d2d' : themeHex; // Dark gray for entities, theme color for emotions
      } else {
        color = type === 'entity' ? '#ffffff' : themeHex; // White for entities, theme color for emotions
      }
    } else {
      // FIXED: Much better default colors with higher contrast
      if (effectiveTheme === 'light') {
        color = '#0a0a0a'; // Very dark for light theme
      } else {
        color = '#f0f0f0'; // Very light for dark theme
      }
    }
    
    console.log(`[DirectNodeLabel] FIXED text color for ${id}: ${color} (selected: ${isSelected}, highlighted: ${isHighlighted}, theme: ${effectiveTheme}, type: ${type})`);
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
          renderOrder={16}
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
