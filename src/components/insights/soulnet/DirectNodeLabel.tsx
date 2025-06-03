
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
  
  // UPDATED: Same base offset (1.4) for both entity and emotion nodes
  const labelOffset = useMemo(() => {
    const baseOffset = 1.4; // Same distance for both node types
    const scaledOffset = baseOffset * Math.max(0.8, Math.min(2.5, nodeScale));
    
    if (isInstantMode) {
      console.log(`[DirectNodeLabel] INSTANT: Enhanced label offset for ${id} (${type}): ${scaledOffset} (scale: ${nodeScale}) - UNIFORM POSITIONING`);
    } else {
      console.log(`[DirectNodeLabel] Enhanced label offset for ${id} (${type}): ${scaledOffset} (scale: ${nodeScale}) - UNIFORM POSITIONING`);
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

  // FIXED: Improved maxWidth calculation based on text size and camera zoom
  const maxWidth = useMemo(() => {
    const zoom = Math.max(10, Math.min(100, cameraZoom));
    // Base width that scales with text size and zoom level
    const baseWidth = textSize * 15; // Reduced multiplier for tighter wrapping
    const zoomAdjustment = Math.max(0.6, Math.min(1.2, (zoom - 30) * 0.02 + 1));
    const finalWidth = Math.max(60, Math.min(200, baseWidth * zoomAdjustment));
    
    console.log(`[DirectNodeLabel] Calculated maxWidth for ${id}: ${finalWidth} (textSize: ${textSize}, zoom: ${zoom})`);
    return finalWidth;
  }, [textSize, cameraZoom, id]);

  // Much smaller percentage text size
  const percentageTextSize = useMemo(() => {
    return textSize * 0.21;
  }, [textSize]);

  // FIXED: White text for dark theme, black text for light theme
  const textColor = useMemo(() => {
    const color = effectiveTheme === 'dark' ? '#ffffff' : '#000000';
    
    if (isInstantMode) {
      console.log(`[DirectNodeLabel] INSTANT: Text color for ${id}: ${color} (theme: ${effectiveTheme}, selected: ${isSelected}, highlighted: ${isHighlighted})`);
    } else {
      console.log(`[DirectNodeLabel] Text color for ${id}: ${color} (theme: ${effectiveTheme}, selected: ${isSelected}, highlighted: ${isHighlighted})`);
    }
    return color;
  }, [effectiveTheme, isSelected, isHighlighted, id, isInstantMode]);

  // Updated colors for percentage text - also theme-aware
  const percentageColor = useMemo(() => {
    return effectiveTheme === 'dark' ? '#ffffff' : '#000000';
  }, [effectiveTheme]);

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
    console.log(`[DirectNodeLabel] INSTANT MODE - MAIN TEXT: "${displayText}" at position`, labelPosition, `with size: ${textSize}, color: ${textColor}, maxWidth: ${maxWidth} - NO LOADING DELAY - UNIFORM POSITIONING`);
  } else {
    console.log(`[DirectNodeLabel] ENHANCED POSITIONING - MAIN TEXT: "${displayText}" at position`, labelPosition, `with size: ${textSize}, color: ${textColor}, maxWidth: ${maxWidth} - UNIFORM POSITIONING`);
  }

  return (
    <>
      {/* Main translated text using SmartTextRenderer with theme-aware color and improved text wrapping */}
      <SmartTextRenderer
        text={displayText}
        position={labelPosition}
        color={textColor}
        size={textSize}
        visible={true}
        renderOrder={15}
        bold={isHighlighted || isSelected}
        outlineWidth={isSelected ? 0.3 : 0.1} // Reduced outline for better readability
        outlineColor={effectiveTheme === 'dark' ? '#000000' : '#ffffff'} // Contrasting outline
        maxWidth={maxWidth}
        enableWrapping={true}
      />
      
      {/* Enhanced side-positioned percentage text with theme-aware color */}
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
          outlineColor={effectiveTheme === 'dark' ? '#000000' : '#ffffff'} // Contrasting outline
          maxWidth={200}
          enableWrapping={false}
        />
      )}
    </>
  );
};

export default DirectNodeLabel;
