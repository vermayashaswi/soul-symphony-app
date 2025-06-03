
import React, { useMemo, useEffect } from 'react';
import SmartTextRenderer from './SmartTextRenderer';
import SimpleText from './SimpleText';

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

  console.log(`[DirectNodeLabel] WRAPPED TEXT RENDERING: ${id} with translated text: "${translatedText || id}" and percentage: ${showPercentage ? connectionPercentage + '%' : 'none'}`);

  // Use translated text if available, otherwise fallback to original id
  const displayText = translatedText || id;
  
  // Enhanced label positioning with better offset calculation for different node types
  const labelOffset = useMemo(() => {
    const baseOffset = type === 'entity' ? 2.2 : 3.0;
    const scaledOffset = baseOffset * Math.max(0.8, Math.min(2.5, nodeScale));
    
    console.log(`[DirectNodeLabel] Label offset for ${id} (${type}): ${scaledOffset} (scale: ${nodeScale})`);
    return [0, scaledOffset, 0] as [number, number, number];
  }, [type, nodeScale, id]);

  // Responsive text size with zoom-based scaling
  const textSize = useMemo(() => {
    const zoom = Math.max(10, Math.min(100, cameraZoom));
    const baseSize = 4.2;
    const zoomFactor = Math.max(0.8, Math.min(1.5, (50 - zoom) * 0.02 + 1));
    const finalSize = Math.max(3.0, Math.min(12.0, baseSize * zoomFactor));
    
    console.log(`[DirectNodeLabel] Responsive text size for ${id}: ${finalSize} (zoom: ${zoom})`);
    return finalSize;
  }, [cameraZoom, id]);

  // Responsive max width based on zoom level
  const maxTextWidth = useMemo(() => {
    const zoom = Math.max(10, Math.min(100, cameraZoom));
    const baseWidth = 30;
    const zoomFactor = Math.max(1.0, Math.min(3.0, (zoom - 20) * 0.05 + 1));
    const finalWidth = baseWidth * zoomFactor;
    
    console.log(`[DirectNodeLabel] Responsive max width for ${id}: ${finalWidth} (zoom: ${zoom})`);
    return finalWidth;
  }, [cameraZoom, id]);

  // Percentage text size - slightly smaller than main text
  const percentageTextSize = useMemo(() => {
    return textSize * (1/7);
  }, [textSize]);

  // Enhanced text color logic with better contrast
  const textColor = useMemo(() => {
    let color;
    
    if (isSelected) {
      color = '#ffffff';
    } else if (isHighlighted) {
      color = type === 'entity' ? '#ffffff' : themeHex;
    } else {
      if (effectiveTheme === 'light') {
        color = '#1a1a1a';
      } else {
        color = '#e5e5e5';
      }
    }
    
    console.log(`[DirectNodeLabel] Text color for ${id}: ${color} (selected: ${isSelected}, highlighted: ${isHighlighted}, theme: ${effectiveTheme})`);
    return color;
  }, [isSelected, isHighlighted, type, themeHex, effectiveTheme, id]);

  // Special color for percentage text
  const percentageColor = useMemo(() => {
    if (type === 'emotion') {
      return '#ffff00';
    }
    return '#ffffff';
  }, [type]);

  const labelPosition: [number, number, number] = [
    position[0] + labelOffset[0],
    position[1] + labelOffset[1],
    position[2] + labelOffset[2]
  ];

  // Position for percentage text - slightly below the main label
  const percentagePosition: [number, number, number] = useMemo(() => {
    const percentageOffset = textSize * 0.15;
    return [
      position[0] + labelOffset[0],
      position[1] + labelOffset[1] - percentageOffset,
      position[2] + labelOffset[2]
    ];
  }, [position, labelOffset, textSize]);

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

  // Determine if text wrapping should be enabled based on text length and zoom
  const enableWrapping = useMemo(() => {
    const textLength = displayText.length;
    const isLongText = textLength > 15;
    const isZoomedIn = cameraZoom < 40;
    
    return isLongText || isZoomedIn;
  }, [displayText, cameraZoom]);

  if (!enhancedShouldShowLabel || !displayText) {
    console.log(`[DirectNodeLabel] Not rendering label for ${id}: shouldShow=${enhancedShouldShowLabel}, text="${displayText}"`);
    return null;
  }

  if (showPercentage && connectionPercentage > 0) {
    console.log(`[DirectNodeLabel] WRAPPED TEXT RENDERING - PERCENTAGE: ${id} (${type}) shows ${connectionPercentage}% separately`);
  }

  console.log(`[DirectNodeLabel] WRAPPED TEXT RENDERING - MAIN TEXT: "${displayText}" at position`, labelPosition, 'with size:', textSize, 'color:', textColor, 'wrapping enabled:', enableWrapping);

  return (
    <>
      {/* Main translated text using SmartTextRenderer with wrapping */}
      <SmartTextRenderer
        text={displayText}
        position={labelPosition}
        color={textColor}
        size={textSize}
        visible={true}
        renderOrder={15}
        bold={isHighlighted || isSelected}
        outlineWidth={isSelected ? 0.6 : 0.3}
        outlineColor={isSelected ? '#000000' : '#333333'}
        maxWidth={maxTextWidth}
        cameraZoom={cameraZoom}
        enableWrapping={enableWrapping}
      />
      
      {/* Separate percentage text using SimpleText for guaranteed visibility */}
      {showPercentage && connectionPercentage > 0 && (
        <SimpleText
          text={`${connectionPercentage}%`}
          position={percentagePosition}
          color={percentageColor}
          size={percentageTextSize}
          visible={true}
          renderOrder={16}
          bold={true}
          outlineWidth={0.4}
          outlineColor="#000000"
          maxWidth={200}
          cameraZoom={cameraZoom}
          enableWrapping={false}
        />
      )}
    </>
  );
};

export default DirectNodeLabel;
