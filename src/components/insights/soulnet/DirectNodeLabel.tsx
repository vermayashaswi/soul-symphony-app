
import React, { useMemo, useEffect } from 'react';
import FlickerFreeTranslatableText3D from './FlickerFreeTranslatableText3D';
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
  effectiveTheme?: 'light' | 'dark';
  isInstantMode?: boolean;
  userId?: string;
  timeRange?: string;
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
  isInstantMode = false,
  userId,
  timeRange
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

  // PLAN IMPLEMENTATION: Static text size of 2 (reduced from 8)
  console.log(`[DirectNodeLabel] FLICKER-FREE RENDERING: ${id} - Static size 2, no translation delays`);

  // Same base offset for both entity and emotion nodes
  const labelOffset = useMemo(() => {
    const baseOffset = 1.4;
    const scaledOffset = baseOffset * Math.max(0.8, Math.min(2.5, nodeScale));
    
    console.log(`[DirectNodeLabel] Enhanced label offset for ${id} (${type}): ${scaledOffset} (scale: ${nodeScale}) - UNIFORM POSITIONING`);
    return [0, scaledOffset, 0] as [number, number, number];
  }, [type, nodeScale, id]);

  // PLAN IMPLEMENTATION: Static text size of 2 (reduced from 8)
  const textSize = useMemo(() => {
    const staticSize = 2.0; // Reduced from 8 to 2
    console.log(`[DirectNodeLabel] FLICKER-FREE: Static text size for ${id}: ${staticSize} (zoom independent)`);
    return staticSize;
  }, [id]);

  // PLAN IMPLEMENTATION: Fixed minimum percentage size of 1.5
  const percentageTextSize = useMemo(() => {
    const fixedPercentageSize = 1.5;
    console.log(`[DirectNodeLabel] FLICKER-FREE: Fixed percentage size for ${id}: ${fixedPercentageSize}`);
    return fixedPercentageSize;
  }, [id]);

  // PLAN IMPLEMENTATION: High contrast colors for better visibility
  const textColor = useMemo(() => {
    const color = effectiveTheme === 'dark' ? '#ffffff' : '#000000';
    console.log(`[DirectNodeLabel] HIGH CONTRAST TEXT COLOR for ${id}: ${color} (theme: ${effectiveTheme})`);
    return color;
  }, [effectiveTheme, id]);

  // PLAN IMPLEMENTATION: Enhanced percentage visibility with white text and black outline
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

  // PLAN IMPLEMENTATION: Simplified percentage positioning closer to nodes
  const percentagePosition: [number, number, number] = useMemo(() => {
    const simpleSideOffset = 2.5;
    const simpleVerticalOffset = 0.5;
    const simpleZOffset = 0.5;
    
    const finalPosition: [number, number, number] = [
      position[0] + simpleSideOffset,
      position[1] + simpleVerticalOffset,
      position[2] + simpleZOffset
    ];
    
    console.log(`[DirectNodeLabel] SIMPLIFIED PERCENTAGE POSITIONING for ${id} (${type}): simple offsets - side=${simpleSideOffset}, vertical=${simpleVerticalOffset}, z=${simpleZOffset}`);
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

  if (!enhancedShouldShowLabel || !id) {
    console.log(`[DirectNodeLabel] Not rendering label for ${id}: shouldShow=${enhancedShouldShowLabel}, text="${id}"`);
    return null;
  }

  // PLAN IMPLEMENTATION: Enhanced percentage display debugging
  if (showPercentage && connectionPercentage > 0) {
    console.log(`[DirectNodeLabel] FLICKER-FREE PERCENTAGE: ${id} (${type}) shows ${connectionPercentage}% at`, percentagePosition, `size: ${percentageTextSize}, color: ${percentageColor}`);
  }

  console.log(`[DirectNodeLabel] FLICKER-FREE RENDERING: "${id}" at position`, labelPosition, 'with static size:', textSize, 'color:', textColor);

  return (
    <>
      {/* Main text using FlickerFreeTranslatableText3D with preloaded translations */}
      <FlickerFreeTranslatableText3D
        text={id}
        position={labelPosition}
        color={textColor}
        size={textSize}
        visible={true}
        renderOrder={15}
        bold={isHighlighted || isSelected}
        outlineWidth={0}
        outlineColor={undefined}
        maxWidth={600}
        enableWrapping={true}
        maxCharsPerLine={18}
        maxLines={3}
        sourceLanguage="en"
        userId={userId}
        timeRange={timeRange}
      />
      
      {/* Enhanced percentage text with fixed size and better visibility */}
      {showPercentage && connectionPercentage > 0 && (
        <SimpleText
          text={`${connectionPercentage}%`}
          position={percentagePosition}
          color={percentageColor}
          size={percentageTextSize}
          visible={true}
          renderOrder={20}
          bold={true}
          outlineWidth={0.15}
          outlineColor="#000000"
          maxWidth={300}
          enableWrapping={false}
        />
      )}
    </>
  );
};

export default DirectNodeLabel;
