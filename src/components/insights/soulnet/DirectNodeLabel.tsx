
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
  isInstantMode?: boolean;
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
  effectiveTheme = 'light',
  isInstantMode = false
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

  // INSTANT MODE: Log immediate rendering without delays
  if (isInstantMode) {
    console.log(`[DirectNodeLabel] INSTANT MODE: ${id} with translated text: "${translatedText || id}" and percentage: ${showPercentage ? connectionPercentage + '%' : 'none'} - NO LOADING DELAY`);
  } else {
    console.log(`[DirectNodeLabel] ENHANCED POSITIONING: ${id} with translated text: "${translatedText || id}" and percentage: ${showPercentage ? connectionPercentage + '%' : 'none'}`);
  }

  // Use translated text if available, otherwise fallback to original id
  const displayText = translatedText || id;
  
  // ENHANCED: Improved label positioning with CLOSER positioning for emotion nodes
  const labelOffset = useMemo(() => {
    // UPDATED: Reduced emotion node baseOffset from 3.5 to 1.4 (0.41x distance)
    const baseOffset = type === 'entity' ? 2.8 : 1.4; // Emotion nodes now much closer
    const scaledOffset = baseOffset * Math.max(0.8, Math.min(2.5, nodeScale));
    
    if (isInstantMode) {
      console.log(`[DirectNodeLabel] INSTANT: Enhanced label offset for ${id} (${type}): ${scaledOffset} (scale: ${nodeScale}) - CLOSER POSITIONING`);
    } else {
      console.log(`[DirectNodeLabel] Enhanced label offset for ${id} (${type}): ${scaledOffset} (scale: ${nodeScale}) - CLOSER POSITIONING`);
    }
    return [0, scaledOffset, 0] as [number, number, number];
  }, [type, nodeScale, id, isInstantMode]);

  // ENHANCED: Better text size calculation for enhanced visibility
  const textSize = useMemo(() => {
    const zoom = Math.max(10, Math.min(100, cameraZoom));
    const baseSize = isSelected ? 6.0 : (isHighlighted ? 5.2 : 4.8); // Larger text for selected/highlighted
    const zoomFactor = Math.max(0.8, Math.min(1.5, (50 - zoom) * 0.02 + 1));
    const finalSize = Math.max(3.5, Math.min(16.0, baseSize * zoomFactor));
    
    if (isInstantMode) {
      console.log(`[DirectNodeLabel] INSTANT: Enhanced text size for ${id}: ${finalSize} (zoom: ${zoom})`);
    } else {
      console.log(`[DirectNodeLabel] Enhanced text size for ${id}: ${finalSize} (zoom: ${zoom})`);
    }
    return finalSize;
  }, [cameraZoom, id, isSelected, isHighlighted, isInstantMode]);

  // Much smaller percentage text size
  const percentageTextSize = useMemo(() => {
    return textSize * 0.21;
  }, [textSize]);

  // UPDATED: Black text color for both light and dark themes
  const textColor = useMemo(() => {
    // Always use black text for all node labels regardless of theme or state
    const color = '#000000';
    
    if (isInstantMode) {
      console.log(`[DirectNodeLabel] INSTANT: Black text color for ${id}: ${color} (selected: ${isSelected}, highlighted: ${isHighlighted}, theme: ${effectiveTheme})`);
    } else {
      console.log(`[DirectNodeLabel] Black text color for ${id}: ${color} (selected: ${isSelected}, highlighted: ${isHighlighted}, theme: ${effectiveTheme})`);
    }
    return color;
  }, [isSelected, isHighlighted, type, themeHex, effectiveTheme, id, isInstantMode]);

  // Updated colors for percentage text - also using black
  const percentageColor = useMemo(() => {
    return '#000000'; // Black for all percentage text
  }, []);

  const labelPosition: [number, number, number] = [
    position[0] + labelOffset[0],
    position[1] + labelOffset[1],
    position[2] + labelOffset[2]
  ];

  // Side positioning for percentage
  const percentagePosition: [number, number, number] = useMemo(() => {
    const sideOffset = (type === 'entity' ? 2.0 : 2.5) * nodeScale;
    const verticalOffset = 0;
    return [
      position[0] + sideOffset,
      position[1] + verticalOffset,
      position[2] + 0.5
    ];
  }, [position, type, nodeScale]);

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

  if (!enhancedShouldShowLabel || !displayText) {
    if (isInstantMode) {
      console.log(`[DirectNodeLabel] INSTANT: Not rendering label for ${id}: shouldShow=${enhancedShouldShowLabel}, text="${displayText}"`);
    } else {
      console.log(`[DirectNodeLabel] Not rendering label for ${id}: shouldShow=${enhancedShouldShowLabel}, text="${displayText}"`);
    }
    return null;
  }

  // INSTANT MODE: Log percentage display state with new side positioning
  if (showPercentage && connectionPercentage > 0) {
    if (isInstantMode) {
      console.log(`[DirectNodeLabel] INSTANT MODE - SIDE POSITIONING - PERCENTAGE: ${id} (${type}) shows ${connectionPercentage}% on the side at`, percentagePosition, '- NO LOADING DELAY');
    } else {
      console.log(`[DirectNodeLabel] ENHANCED SIDE POSITIONING - PERCENTAGE: ${id} (${type}) shows ${connectionPercentage}% on the side at`, percentagePosition);
    }
  }

  if (isInstantMode) {
    console.log(`[DirectNodeLabel] INSTANT MODE - MAIN TEXT: "${displayText}" at position`, labelPosition, 'with size:', textSize, 'color:', textColor, '- NO LOADING DELAY - CLOSER POSITIONING');
  } else {
    console.log(`[DirectNodeLabel] ENHANCED POSITIONING - MAIN TEXT: "${displayText}" at position`, labelPosition, 'with size:', textSize, 'color:', textColor, '- CLOSER POSITIONING');
  }

  return (
    <>
      {/* Main translated text using SmartTextRenderer with black color and text wrapping */}
      <SmartTextRenderer
        text={displayText}
        position={labelPosition}
        color={textColor}
        size={textSize}
        visible={true}
        renderOrder={15}
        bold={isHighlighted || isSelected}
        outlineWidth={isSelected ? 0.3 : 0.1} // Reduced outline for better readability with black text
        outlineColor={isSelected ? '#ffffff' : '#f5f5f5'} // Light outline to help with contrast
        maxWidth={600} // Increased for better wrapping
        enableWrapping={true}
      />
      
      {/* Enhanced side-positioned percentage text with black color */}
      {showPercentage && connectionPercentage > 0 && (
        <SimpleText
          text={`${connectionPercentage}%`}
          position={percentagePosition}
          color={percentageColor}
          size={percentageTextSize}
          visible={true}
          renderOrder={16}
          bold={true}
          outlineWidth={0.1} // Reduced outline
          outlineColor="#f5f5f5" // Light outline
          maxWidth={200}
          enableWrapping={false}
        />
      )}
    </>
  );
};

export default DirectNodeLabel;
