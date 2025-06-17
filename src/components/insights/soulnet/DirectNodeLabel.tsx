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
  // APP-LEVEL: Coordinated translation props
  coordinatedTranslation?: string;
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
  effectiveTheme = 'light',
  isInstantMode = false,
  coordinatedTranslation
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

  // Log rendering mode with coordination info
  if (isInstantMode) {
    console.log(`[DirectNodeLabel] APP-LEVEL INSTANT MODE: ${id} with coordinated translation: "${coordinatedTranslation}" - NO LOADING DELAY`);
  } else {
    console.log(`[DirectNodeLabel] APP-LEVEL ENHANCED POSITIONING: ${id} with coordinated translation: "${coordinatedTranslation}"`);
  }

  // Same base offset for both entity and emotion nodes
  const labelOffset = useMemo(() => {
    const baseOffset = 1.4;
    const scaledOffset = baseOffset * Math.max(0.8, Math.min(2.5, nodeScale));
    
    if (isInstantMode) {
      console.log(`[DirectNodeLabel] APP-LEVEL INSTANT: Enhanced label offset for ${id} (${type}): ${scaledOffset} (scale: ${nodeScale}) - UNIFORM POSITIONING`);
    } else {
      console.log(`[DirectNodeLabel] APP-LEVEL: Enhanced label offset for ${id} (${type}): ${scaledOffset} (scale: ${nodeScale}) - UNIFORM POSITIONING`);
    }
    return [0, scaledOffset, 0] as [number, number, number];
  }, [type, nodeScale, id, isInstantMode]);

  // FIXED FONT SIZE IMPLEMENTATION: Constant text size of 3.2 independent of all zoom and camera calculations
  const textSize = useMemo(() => {
    const fixedSize = 3.2; // Fixed size for all nodes regardless of state
    
    if (isInstantMode) {
      console.log(`[DirectNodeLabel] FIXED FONT SIZE INSTANT: ${id} uses FIXED size ${fixedSize} (no zoom dependency, no state dependency)`);
    } else {
      console.log(`[DirectNodeLabel] FIXED FONT SIZE: ${id} uses FIXED size ${fixedSize} (no zoom dependency, no state dependency)`);
    }
    return fixedSize;
  }, [id, isInstantMode]);

  // FIXED FONT SIZE IMPLEMENTATION: Constant percentage text size
  const percentageTextSize = useMemo(() => {
    const fixedPercentageSize = 0.9; // Absolute fixed size for percentage text
    console.log(`[DirectNodeLabel] FIXED PERCENTAGE SIZE: ${id} uses FIXED percentage size ${fixedPercentageSize}`);
    return fixedPercentageSize;
  }, [id]);

  // UPDATED: Solid white text for dark theme, solid black text for light theme
  const textColor = useMemo(() => {
    const color = effectiveTheme === 'dark' ? '#ffffff' : '#000000';
    
    if (isInstantMode) {
      console.log(`[DirectNodeLabel] APP-LEVEL INSTANT: SOLID TEXT COLOR for ${id}: ${color} (theme: ${effectiveTheme})`);
    } else {
      console.log(`[DirectNodeLabel] APP-LEVEL: SOLID TEXT COLOR for ${id}: ${color} (theme: ${effectiveTheme})`);
    }
    return color;
  }, [effectiveTheme, id, isInstantMode]);

  // UPDATED: Percentage text also uses solid color for theme
  const percentageColor = useMemo(() => {
    const color = effectiveTheme === 'dark' ? '#ffffff' : '#000000';
    console.log(`[DirectNodeLabel] APP-LEVEL: SOLID PERCENTAGE COLOR for ${id}: ${color} (theme: ${effectiveTheme})`);
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
      console.log(`[DirectNodeLabel] APP-LEVEL: Tutorial step 9 detected, forcing label visibility for ${id}`);
      return true;
    }
    
    return shouldShowLabel;
  }, [shouldShowLabel, id]);

  if (!enhancedShouldShowLabel || !id) {
    if (isInstantMode) {
      console.log(`[DirectNodeLabel] APP-LEVEL INSTANT: Not rendering label for ${id}: shouldShow=${enhancedShouldShowLabel}, text="${id}"`);
    } else {
      console.log(`[DirectNodeLabel] APP-LEVEL: Not rendering label for ${id}: shouldShow=${enhancedShouldShowLabel}, text="${id}"`);
    }
    return null;
  }

  // Log percentage display state with side positioning
  if (showPercentage && connectionPercentage > 0) {
    if (isInstantMode) {
      console.log(`[DirectNodeLabel] APP-LEVEL INSTANT MODE - SIDE POSITIONING - PERCENTAGE: ${id} (${type}) shows ${connectionPercentage}% on the side at`, percentagePosition, '- NO LOADING DELAY');
    } else {
      console.log(`[DirectNodeLabel] APP-LEVEL ENHANCED SIDE POSITIONING - PERCENTAGE: ${id} (${type}) shows ${connectionPercentage}% on the side at`, percentagePosition);
    }
  }

  if (isInstantMode) {
    console.log(`[DirectNodeLabel] FIXED FONT INSTANT MODE - MAIN TEXT: "${id}" at position`, labelPosition, 'with FIXED size:', textSize, 'color:', textColor, '- NO LOADING DELAY - APP-LEVEL TRANSLATION');
  } else {
    console.log(`[DirectNodeLabel] FIXED FONT - MAIN TEXT: "${id}" at position`, labelPosition, 'with FIXED size:', textSize, 'color:', textColor, '- APP-LEVEL TRANSLATION');
  }

  return (
    <>
      {/* APP-LEVEL: Main text using TranslatableText3D with app-level translation integration */}
      <TranslatableText3D
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
        coordinatedTranslation={coordinatedTranslation}
        useCoordinatedTranslation={!!coordinatedTranslation}
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
          outlineWidth={0}
          outlineColor={undefined}
          maxWidth={200}
          enableWrapping={false}
        />
      )}
    </>
  );
};

export default DirectNodeLabel;
