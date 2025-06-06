import React, { useMemo, useEffect } from 'react';
import TranslatableText3D from './TranslatableText3D';
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
}

export const DirectNodeLabel: React.FC<DirectNodeLabelProps> = ({
  id,
  type,
  position,
  isHighlighted,
  isSelected,
  shouldShowLabel,
  cameraZoom = 62.5, // Default to middle of new range
  themeHex,
  nodeScale = 1,
  connectionPercentage = 0,
  showPercentage = false,
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

  // FIXED: Static text size of 8 regardless of zoom
  console.log(`[DirectNodeLabel] FIXED STATIC TEXT SIZE 8: ${id} - No zoom dependency`);

  // Same base offset for both entity and emotion nodes
  const labelOffset = useMemo(() => {
    const baseOffset = 1.4;
    const scaledOffset = baseOffset * Math.max(0.8, Math.min(2.5, nodeScale));
    
    console.log(`[DirectNodeLabel] Enhanced label offset for ${id} (${type}): ${scaledOffset} (scale: ${nodeScale}) - UNIFORM POSITIONING`);
    return [0, scaledOffset, 0] as [number, number, number];
  }, [type, nodeScale, id]);

  // FIXED: Static text size of 8
  const textSize = useMemo(() => {
    const staticSize = 8.0;
    console.log(`[DirectNodeLabel] FIXED STATIC TEXT SIZE for ${id}: ${staticSize} (zoom ignored: ${cameraZoom})`);
    return staticSize;
  }, [id, cameraZoom]);

  // FIXED: Static percentage text size proportional to main text (8 * 0.35 = 2.8)
  const percentageTextSize = useMemo(() => {
    const staticPercentageSize = 2.8; // 8 * 0.35
    console.log(`[DirectNodeLabel] FIXED STATIC PERCENTAGE SIZE for ${id}: ${staticPercentageSize}`);
    return staticPercentageSize;
  }, [id]);

  // UPDATED: High contrast colors for better visibility
  const textColor = useMemo(() => {
    const color = effectiveTheme === 'dark' ? '#ffffff' : '#000000';
    console.log(`[DirectNodeLabel] HIGH CONTRAST TEXT COLOR for ${id}: ${color} (theme: ${effectiveTheme})`);
    return color;
  }, [effectiveTheme, id]);

  // FIXED: Bright, high-contrast percentage color
  const percentageColor = useMemo(() => {
    const color = effectiveTheme === 'dark' ? '#00ff00' : '#ff0000';
    console.log(`[DirectNodeLabel] FIXED HIGH CONTRAST PERCENTAGE COLOR for ${id}: ${color} (theme: ${effectiveTheme})`);
    return color;
  }, [effectiveTheme, id]);

  const labelPosition: [number, number, number] = [
    position[0] + labelOffset[0],
    position[1] + labelOffset[1],
    position[2] + labelOffset[2]
  ];

  // FIXED: Enhanced side positioning for percentage with better spacing and Z-offset
  const percentagePosition: [number, number, number] = useMemo(() => {
    const baseSideOffset = type === 'entity' ? 3.5 : 4.0;
    const sideOffset = baseSideOffset * Math.max(1.0, nodeScale);
    
    let verticalOffset = 0;
    if (type === 'emotion') {
      verticalOffset = position[1] > 0 ? -2.0 : 2.0;
    } else {
      verticalOffset = -1.0;
    }
    
    const zOffset = 2.0;
    
    const finalPosition: [number, number, number] = [
      position[0] + sideOffset,
      position[1] + verticalOffset,
      position[2] + zOffset
    ];
    
    console.log(`[DirectNodeLabel] FIXED PERCENTAGE POSITIONING for ${id} (${type}): sideOffset=${sideOffset}, verticalOffset=${verticalOffset}, zOffset=${zOffset}, final=`, finalPosition);
    return finalPosition;
  }, [position, type, nodeScale, id]);

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

  // FIXED: Enhanced percentage display logging
  if (showPercentage && connectionPercentage > 0) {
    console.log(`[DirectNodeLabel] FIXED STATIC PERCENTAGE DISPLAY: ${id} (${type}) shows ${connectionPercentage}% at`, percentagePosition, `size: ${percentageTextSize}, color: ${percentageColor} - STATIC SIZE 2.8`);
  }

  console.log(`[DirectNodeLabel] FIXED STATIC TEXT SIZE 8: "${id}" at position`, labelPosition, 'with STATIC size:', textSize, 'color:', textColor, '- GOOGLE TRANSLATE INTEGRATION');

  return (
    <>
      {/* Main text using TranslatableText3D with Google Translate integration and STATIC size 8 */}
      <TranslatableText3D
        text={id}
        position={labelPosition}
        color={textColor}
        size={textSize} // FIXED: Static size 8
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
      />
      
      {/* FIXED: Enhanced percentage text with STATIC size 2.8 */}
      {showPercentage && connectionPercentage > 0 && (
        <SimpleText
          text={`${connectionPercentage}%`}
          position={percentagePosition}
          color={percentageColor}
          size={percentageTextSize} // FIXED: Static size 2.8
          visible={true}
          renderOrder={20}
          bold={true}
          outlineWidth={0.05}
          outlineColor={effectiveTheme === 'dark' ? '#000000' : '#ffffff'}
          maxWidth={300}
          enableWrapping={false}
        />
      )}
    </>
  );
};

export default DirectNodeLabel;
