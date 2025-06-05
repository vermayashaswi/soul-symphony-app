
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
  cameraZoom = 45,
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

  // Log rendering mode
  if (isInstantMode) {
    console.log(`[DirectNodeLabel] INSTANT MODE: ${id} with FIXED PERCENTAGE POSITIONING - NO LOADING DELAY`);
  } else {
    console.log(`[DirectNodeLabel] FIXED PERCENTAGE POSITIONING: ${id} with enhanced visibility`);
  }

  // Same base offset for both entity and emotion nodes
  const labelOffset = useMemo(() => {
    const baseOffset = 1.4;
    const scaledOffset = baseOffset * Math.max(0.8, Math.min(2.5, nodeScale));
    
    if (isInstantMode) {
      console.log(`[DirectNodeLabel] INSTANT: Enhanced label offset for ${id} (${type}): ${scaledOffset} (scale: ${nodeScale}) - UNIFORM POSITIONING`);
    } else {
      console.log(`[DirectNodeLabel] Enhanced label offset for ${id} (${type}): ${scaledOffset} (scale: ${nodeScale}) - UNIFORM POSITIONING`);
    }
    return [0, scaledOffset, 0] as [number, number, number];
  }, [type, nodeScale, id, isInstantMode]);

  // Better text size calculation for enhanced visibility
  const textSize = useMemo(() => {
    const zoom = Math.max(10, Math.min(100, cameraZoom));
    const baseSize = isSelected ? 6.0 : (isHighlighted ? 5.2 : 4.8);
    const zoomFactor = Math.max(0.8, Math.min(1.5, (50 - zoom) * 0.02 + 1));
    const finalSize = Math.max(3.5, Math.min(16.0, baseSize * zoomFactor));
    
    if (isInstantMode) {
      console.log(`[DirectNodeLabel] INSTANT: Enhanced text size for ${id}: ${finalSize} (zoom: ${zoom})`);
    } else {
      console.log(`[DirectNodeLabel] Enhanced text size for ${id}: ${finalSize} (zoom: ${zoom})`);
    }
    return finalSize;
  }, [cameraZoom, id, isSelected, isHighlighted, isInstantMode]);

  // FIXED: Larger percentage text size for better visibility
  const percentageTextSize = useMemo(() => {
    const basePercentageSize = textSize * 0.35; // Increased from 0.21 to 0.35
    const minSize = Math.max(2.0, basePercentageSize); // Ensure minimum readable size
    console.log(`[DirectNodeLabel] FIXED PERCENTAGE SIZE for ${id}: ${minSize} (base: ${basePercentageSize})`);
    return minSize;
  }, [textSize, id]);

  // UPDATED: High contrast colors for better visibility
  const textColor = useMemo(() => {
    const color = effectiveTheme === 'dark' ? '#ffffff' : '#000000';
    
    if (isInstantMode) {
      console.log(`[DirectNodeLabel] INSTANT: HIGH CONTRAST TEXT COLOR for ${id}: ${color} (theme: ${effectiveTheme})`);
    } else {
      console.log(`[DirectNodeLabel] HIGH CONTRAST TEXT COLOR for ${id}: ${color} (theme: ${effectiveTheme})`);
    }
    return color;
  }, [effectiveTheme, id, isInstantMode]);

  // FIXED: Bright, high-contrast percentage color
  const percentageColor = useMemo(() => {
    // Use bright colors for maximum visibility
    const color = effectiveTheme === 'dark' ? '#00ff00' : '#ff0000'; // Bright green for dark, bright red for light
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
    // INCREASED: Much larger side offset for better separation
    const baseSideOffset = type === 'entity' ? 3.5 : 4.0; // Increased from 2.0/2.5 to 3.5/4.0
    const sideOffset = baseSideOffset * Math.max(1.0, nodeScale);
    
    // IMPROVED: Better vertical positioning based on node type and new Y positions
    let verticalOffset = 0;
    if (type === 'emotion') {
      // Emotions are now at Y +10/-10, so adjust percentage positioning accordingly
      verticalOffset = position[1] > 0 ? -2.0 : 2.0; // Offset away from emotion clusters
    } else {
      // Entities are in center layer, use small vertical offset
      verticalOffset = -1.0;
    }
    
    // ENHANCED: Better Z-offset to bring percentages forward
    const zOffset = 2.0; // Increased from 0.5 to 2.0 for better visibility
    
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
    if (isInstantMode) {
      console.log(`[DirectNodeLabel] INSTANT: Not rendering label for ${id}: shouldShow=${enhancedShouldShowLabel}, text="${id}"`);
    } else {
      console.log(`[DirectNodeLabel] Not rendering label for ${id}: shouldShow=${enhancedShouldShowLabel}, text="${id}"`);
    }
    return null;
  }

  // FIXED: Enhanced percentage display logging
  if (showPercentage && connectionPercentage > 0) {
    if (isInstantMode) {
      console.log(`[DirectNodeLabel] INSTANT MODE - FIXED PERCENTAGE DISPLAY: ${id} (${type}) shows ${connectionPercentage}% at`, percentagePosition, `size: ${percentageTextSize}, color: ${percentageColor} - ENHANCED VISIBILITY`);
    } else {
      console.log(`[DirectNodeLabel] FIXED PERCENTAGE DISPLAY: ${id} (${type}) shows ${connectionPercentage}% at`, percentagePosition, `size: ${percentageTextSize}, color: ${percentageColor} - ENHANCED VISIBILITY`);
    }
  }

  if (isInstantMode) {
    console.log(`[DirectNodeLabel] INSTANT MODE - MAIN TEXT: "${id}" at position`, labelPosition, 'with size:', textSize, 'color:', textColor, '- NO LOADING DELAY - GOOGLE TRANSLATE INTEGRATION`);
  } else {
    console.log(`[DirectNodeLabel] ENHANCED POSITIONING - MAIN TEXT: "${id}" at position`, labelPosition, 'with size:', textSize, 'color:', textColor, '- GOOGLE TRANSLATE INTEGRATION`);
  }

  return (
    <>
      {/* Main text using TranslatableText3D with Google Translate integration */}
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
      />
      
      {/* FIXED: Enhanced percentage text with improved visibility and positioning */}
      {showPercentage && connectionPercentage > 0 && (
        <SimpleText
          text={`${connectionPercentage}%`}
          position={percentagePosition}
          color={percentageColor}
          size={percentageTextSize}
          visible={true}
          renderOrder={20} // INCREASED: Higher render order for better visibility (was 16, now 20)
          bold={true}
          outlineWidth={0.05} // ADDED: Small outline for better contrast
          outlineColor={effectiveTheme === 'dark' ? '#000000' : '#ffffff'} // ADDED: Contrasting outline
          maxWidth={300} // INCREASED: Larger max width (was 200, now 300)
          enableWrapping={false}
        />
      )}
    </>
  );
};

export default DirectNodeLabel;
