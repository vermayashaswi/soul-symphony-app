
import React, { useMemo, useEffect } from 'react';
import TranslatableText3D from './TranslatableText3D';

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

  console.log(`[DirectNodeLabel] GOOGLE TRANSLATE MODE: ${id} - using TranslatableText3D for real translation`);

  // Use original id for translation (ignore translatedText prop as we'll handle translation internally)
  const displayText = id;
  
  // Same base offset for both entity and emotion nodes
  const labelOffset = useMemo(() => {
    const baseOffset = 1.4;
    const scaledOffset = baseOffset * Math.max(0.8, Math.min(2.5, nodeScale));
    
    console.log(`[DirectNodeLabel] Enhanced label offset for ${id} (${type}): ${scaledOffset} (scale: ${nodeScale})`);
    return [0, scaledOffset, 0] as [number, number, number];
  }, [type, nodeScale, id]);

  // Better text size calculation for enhanced visibility
  const textSize = useMemo(() => {
    const zoom = Math.max(10, Math.min(100, cameraZoom));
    const baseSize = isSelected ? 0.6 : (isHighlighted ? 0.52 : 0.48);
    const zoomFactor = Math.max(0.8, Math.min(1.5, (50 - zoom) * 0.02 + 1));
    const finalSize = Math.max(0.35, Math.min(1.6, baseSize * zoomFactor));
    
    console.log(`[DirectNodeLabel] Enhanced text size for ${id}: ${finalSize} (zoom: ${zoom})`);
    return finalSize;
  }, [cameraZoom, id, isSelected, isHighlighted]);

  // Much smaller percentage text size
  const percentageTextSize = useMemo(() => {
    return textSize * 0.21;
  }, [textSize]);

  // Solid text colors based on theme
  const textColor = useMemo(() => {
    const color = effectiveTheme === 'dark' ? '#ffffff' : '#000000';
    console.log(`[DirectNodeLabel] GOOGLE TRANSLATE - TEXT COLOR for ${id}: ${color} (theme: ${effectiveTheme})`);
    return color;
  }, [effectiveTheme, id]);

  // Percentage text also uses theme-aware colors
  const percentageColor = useMemo(() => {
    const color = effectiveTheme === 'dark' ? '#ffffff' : '#000000';
    console.log(`[DirectNodeLabel] GOOGLE TRANSLATE - PERCENTAGE COLOR for ${id}: ${color} (theme: ${effectiveTheme})`);
    return color;
  }, [effectiveTheme, id]);

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
    console.log(`[DirectNodeLabel] Not rendering label for ${id}: shouldShow=${enhancedShouldShowLabel}, text="${displayText}"`);
    return null;
  }

  // Log percentage display state with side positioning
  if (showPercentage && connectionPercentage > 0) {
    console.log(`[DirectNodeLabel] GOOGLE TRANSLATE - PERCENTAGE: ${id} (${type}) shows ${connectionPercentage}% on the side at`, percentagePosition);
  }

  console.log(`[DirectNodeLabel] GOOGLE TRANSLATE - MAIN TEXT: "${displayText}" at position`, labelPosition, 'with size:', textSize, 'color:', textColor);

  return (
    <>
      {/* Main translated text using TranslatableText3D with Google Web Translate */}
      <TranslatableText3D
        text={displayText}
        position={labelPosition}
        color={textColor}
        size={textSize}
        visible={true}
        renderOrder={15}
        bold={isHighlighted || isSelected}
        outlineWidth={0}
        outlineColor={undefined}
        maxWidth={25}
        enableWrapping={false}
        sourceLanguage="en"
      />
      
      {/* Enhanced side-positioned percentage text */}
      {showPercentage && connectionPercentage > 0 && (
        <TranslatableText3D
          text={`${connectionPercentage}%`}
          position={percentagePosition}
          color={percentageColor}
          size={percentageTextSize}
          visible={true}
          renderOrder={16}
          bold={true}
          outlineWidth={0}
          outlineColor={undefined}
          maxWidth={10}
          enableWrapping={false}
          sourceLanguage="en"
        />
      )}
    </>
  );
};

export default DirectNodeLabel;
