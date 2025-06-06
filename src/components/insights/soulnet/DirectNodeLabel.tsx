import React, { useMemo, useEffect } from 'react';
import SimpleText from './SimpleText';
import { useInsightsTranslation } from '../InsightsTranslationProvider';

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
  cameraZoom = 62.5,
  themeHex,
  nodeScale = 1,
  connectionPercentage = 0,
  showPercentage = false,
  effectiveTheme = 'light',
  isInstantMode = false
}) => {
  const { getTranslation, isTranslating } = useInsightsTranslation();

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

  // Get translated text from centralized translation system
  const translatedText = useMemo(() => {
    const translation = getTranslation(id);
    const finalText = translation || id; // Fallback to original if no translation
    console.log(`[DirectNodeLabel] Using ${translation ? 'translated' : 'original'} text for ${id}: "${finalText}"`);
    return finalText;
  }, [id, getTranslation]);

  // Static text size of 2 (reduced from 8)
  console.log(`[DirectNodeLabel] STATIC TEXT SIZE 2: ${id} - Reduced from 8 for better scaling`);

  // Same base offset for both entity and emotion nodes
  const labelOffset = useMemo(() => {
    const baseOffset = 1.4;
    const scaledOffset = baseOffset * Math.max(0.8, Math.min(2.5, nodeScale));
    
    console.log(`[DirectNodeLabel] Enhanced label offset for ${id} (${type}): ${scaledOffset} (scale: ${nodeScale}) - UNIFORM POSITIONING`);
    return [0, scaledOffset, 0] as [number, number, number];
  }, [type, nodeScale, id]);

  // Static text size of 2 (reduced from 8)
  const textSize = useMemo(() => {
    const staticSize = 2.0; // Reduced from 8 to 2
    console.log(`[DirectNodeLabel] STATIC TEXT SIZE for ${id}: ${staticSize} (reduced from 8, zoom ignored: ${cameraZoom})`);
    return staticSize;
  }, [id, cameraZoom]);

  // Fixed minimum percentage size of 1.5 (instead of proportional 0.7)
  const percentageTextSize = useMemo(() => {
    const fixedPercentageSize = 1.5; // Fixed minimum size instead of 2.0 * 0.35 = 0.7
    console.log(`[DirectNodeLabel] FIXED PERCENTAGE SIZE for ${id}: ${fixedPercentageSize} (was 0.7, now fixed 1.5)`);
    return fixedPercentageSize;
  }, [id]);

  // High contrast colors for better visibility
  const textColor = useMemo(() => {
    const color = effectiveTheme === 'dark' ? '#ffffff' : '#000000';
    console.log(`[DirectNodeLabel] HIGH CONTRAST TEXT COLOR for ${id}: ${color} (theme: ${effectiveTheme})`);
    return color;
  }, [effectiveTheme, id]);

  // Enhanced percentage visibility with white text and black outline
  const percentageColor = useMemo(() => {
    const color = '#ffffff'; // Always white for maximum contrast
    console.log(`[DirectNodeLabel] ENHANCED PERCENTAGE COLOR for ${id}: ${color} (always white for maximum visibility)`);
    return color;
  }, [id]);

  const labelPosition: [number, number, number] = [
    position[0] + labelOffset[0],
    position[1] + labelOffset[1],
    position[2] + labelOffset[2]
  ];

  // Simplified percentage positioning closer to nodes
  const percentagePosition: [number, number, number] = useMemo(() => {
    // Simplified positioning: place percentage to the right and slightly up from the node
    const simpleSideOffset = 2.5; // Reduced from complex calculation
    const simpleVerticalOffset = 0.5; // Small upward offset
    const simpleZOffset = 0.5; // Small forward offset
    
    const finalPosition: [number, number, number] = [
      position[0] + simpleSideOffset,
      position[1] + simpleVerticalOffset,
      position[2] + simpleZOffset
    ];
    
    console.log(`[DirectNodeLabel] SIMPLIFIED PERCENTAGE POSITIONING for ${id} (${type}): simple offsets - side=${simpleSideOffset}, vertical=${simpleVerticalOffset}, z=${simpleZOffset}, final=`, finalPosition);
    return finalPosition;
  }, [position, type, id]);

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

  // Don't render if not visible, but keep visible during translation to prevent flicker
  if (!enhancedShouldShowLabel || !id) {
    console.log(`[DirectNodeLabel] Not rendering label for ${id}: shouldShow=${enhancedShouldShowLabel}, text="${id}"`);
    return null;
  }

  // Enhanced percentage display debugging
  if (showPercentage && connectionPercentage > 0) {
    console.log(`[DirectNodeLabel] PERCENTAGE DISPLAY DEBUG: ${id} (${type}) shows ${connectionPercentage}% at`, percentagePosition, `size: ${percentageTextSize}, color: ${percentageColor}, showPercentage: ${showPercentage}, connectionPercentage: ${connectionPercentage}`);
  } else {
    console.log(`[DirectNodeLabel] PERCENTAGE NOT DISPLAYED for ${id}: showPercentage=${showPercentage}, connectionPercentage=${connectionPercentage}`);
  }

  console.log(`[DirectNodeLabel] RENDERING TEXT SIZE 2: "${translatedText}" at position`, labelPosition, 'with STATIC size:', textSize, 'color:', textColor, 'isTranslating:', isTranslating);

  return (
    <>
      {/* Main text using translated text from centralized system */}
      <SimpleText
        text={translatedText}
        position={labelPosition}
        color={textColor}
        size={textSize} // Static size 2 (reduced from 8)
        visible={true}
        renderOrder={15}
        bold={isHighlighted || isSelected}
        outlineWidth={0}
        outlineColor={undefined}
        maxWidth={600}
      />
      
      {/* Enhanced percentage text with fixed size 1.5 and better visibility */}
      {showPercentage && connectionPercentage > 0 && (
        <SimpleText
          text={`${connectionPercentage}%`}
          position={percentagePosition}
          color={percentageColor} // Always white for maximum contrast
          size={percentageTextSize} // Fixed size 1.5
          visible={true}
          renderOrder={20}
          bold={true}
          outlineWidth={0.15} // Increased outline for better visibility
          outlineColor="#000000" // Always black outline for contrast
          maxWidth={300}
        />
      )}
    </>
  );
};

export default DirectNodeLabel;
