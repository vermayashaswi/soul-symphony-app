
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

  console.log(`[DirectNodeLabel] ENHANCED POSITIONING: ${id} with translated text: "${translatedText || id}" and percentage: ${showPercentage ? connectionPercentage + '%' : 'none'}`);

  // Use translated text if available, otherwise fallback to original id
  const displayText = translatedText || id;
  
  // ENHANCED: Improved label positioning with better offset calculation for larger nodes
  const labelOffset = useMemo(() => {
    // Adjusted for 15% larger nodes - increased base offset
    const baseOffset = type === 'entity' ? 2.5 : 3.2; // Increased from 2.2/3.0
    const scaledOffset = baseOffset * Math.max(0.8, Math.min(2.5, nodeScale));
    
    console.log(`[DirectNodeLabel] Enhanced label offset for ${id} (${type}): ${scaledOffset} (scale: ${nodeScale})`);
    return [0, scaledOffset, 0] as [number, number, number];
  }, [type, nodeScale, id]);

  // ENHANCED: Better text size calculation for larger nodes
  const textSize = useMemo(() => {
    const zoom = Math.max(10, Math.min(100, cameraZoom));
    const baseSize = 4.8; // Increased from 4.2 to accommodate larger nodes
    const zoomFactor = Math.max(0.8, Math.min(1.5, (50 - zoom) * 0.02 + 1));
    const finalSize = Math.max(3.5, Math.min(14.0, baseSize * zoomFactor));
    
    console.log(`[DirectNodeLabel] Enhanced text size for ${id}: ${finalSize} (zoom: ${zoom})`);
    return finalSize;
  }, [cameraZoom, id]);

  // ENHANCED: Side positioning for percentage text to avoid overlap
  const percentageTextSize = useMemo(() => {
    return textSize * 0.7; // Slightly larger percentage text
  }, [textSize]);

  // ENHANCED: Text color logic with better contrast
  const textColor = useMemo(() => {
    let color;
    
    if (isSelected) {
      color = '#ffffff'; // Always white for selected nodes
    } else if (isHighlighted) {
      color = type === 'entity' ? '#ffffff' : themeHex;
    } else {
      // Default colors based on theme with higher contrast
      if (effectiveTheme === 'light') {
        color = '#1a1a1a'; // Dark gray for light theme
      } else {
        color = '#e5e5e5'; // Light gray for dark theme
      }
    }
    
    console.log(`[DirectNodeLabel] Enhanced text color for ${id}: ${color} (selected: ${isSelected}, highlighted: ${isHighlighted}, theme: ${effectiveTheme})`);
    return color;
  }, [isSelected, isHighlighted, type, themeHex, effectiveTheme, id]);

  // Special color for percentage text - bright yellow for better visibility
  const percentageColor = useMemo(() => {
    if (type === 'emotion') {
      return '#ffff00'; // Bright yellow for emotion percentages
    }
    return '#ffffff'; // White for entity percentages
  }, [type]);

  const labelPosition: [number, number, number] = [
    position[0] + labelOffset[0],
    position[1] + labelOffset[1],
    position[2] + labelOffset[2]
  ];

  // ENHANCED: Side positioning for percentage - positioned to the right of the node
  const percentagePosition: [number, number, number] = useMemo(() => {
    // Position percentage to the side (right) of the node instead of below the label
    const sideOffset = (type === 'entity' ? 2.0 : 2.5) * nodeScale; // Horizontal offset to the right
    const verticalOffset = 0; // Same height as node center
    return [
      position[0] + sideOffset,
      position[1] + verticalOffset,
      position[2] + 0.5 // Slightly forward for better visibility
    ];
  }, [position, type, nodeScale]);

  // Enhanced visibility check for tutorial step 9
  const enhancedShouldShowLabel = useMemo(() => {
    // Check if we're in tutorial step 9 by looking at body attribute
    const currentTutorialStep = document.body.getAttribute('data-current-step');
    const isTutorialStep9 = currentTutorialStep === '9';
    
    if (isTutorialStep9) {
      console.log(`[DirectNodeLabel] Tutorial step 9 detected, forcing label visibility for ${id}`);
      return true; // Always show labels during tutorial step 9
    }
    
    return shouldShowLabel;
  }, [shouldShowLabel, id]);

  if (!enhancedShouldShowLabel || !displayText) {
    console.log(`[DirectNodeLabel] Not rendering label for ${id}: shouldShow=${enhancedShouldShowLabel}, text="${displayText}"`);
    return null;
  }

  // ENHANCED: Log percentage display state with new side positioning
  if (showPercentage && connectionPercentage > 0) {
    console.log(`[DirectNodeLabel] ENHANCED SIDE POSITIONING - PERCENTAGE: ${id} (${type}) shows ${connectionPercentage}% on the side at`, percentagePosition);
  }

  console.log(`[DirectNodeLabel] ENHANCED POSITIONING - MAIN TEXT: "${displayText}" at position`, labelPosition, 'with size:', textSize, 'color:', textColor);

  return (
    <>
      {/* Main translated text using SmartTextRenderer */}
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
        maxWidth={400}
      />
      
      {/* ENHANCED: Side-positioned percentage text using SimpleText */}
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
        />
      )}
    </>
  );
};

export default DirectNodeLabel;
