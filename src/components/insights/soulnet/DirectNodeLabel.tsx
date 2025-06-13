
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

  // RESTORED: Different y-axis offsets for entity vs emotion nodes
  const labelOffset = useMemo(() => {
    const baseOffset = 1.4;
    const scaledOffset = baseOffset * Math.max(0.8, Math.min(2.5, nodeScale));
    
    // RESTORED: Different y-axis positioning based on node type
    const yAxisOffset = type === 'entity' ? scaledOffset + 0.5 : scaledOffset + 1.0;
    
    console.log(`[DirectNodeLabel] RESTORED Y-AXIS: ${id} (${type}) offset: y=${yAxisOffset} (scale: ${nodeScale})`);
    return [0, yAxisOffset, 0] as [number, number, number];
  }, [type, nodeScale, id]);

  // Fixed font size implementation
  const textSize = useMemo(() => {
    const fixedSize = 3.2;
    console.log(`[DirectNodeLabel] FIXED FONT SIZE: ${id} uses size ${fixedSize}`);
    return fixedSize;
  }, [id]);

  const percentageTextSize = useMemo(() => {
    const fixedPercentageSize = 0.9;
    return fixedPercentageSize;
  }, []);

  // Solid text color based on theme
  const textColor = useMemo(() => {
    const color = effectiveTheme === 'dark' ? '#ffffff' : '#000000';
    console.log(`[DirectNodeLabel] SOLID TEXT COLOR for ${id}: ${color} (theme: ${effectiveTheme})`);
    return color;
  }, [effectiveTheme, id]);

  const percentageColor = useMemo(() => {
    const color = effectiveTheme === 'dark' ? '#ffffff' : '#000000';
    return color;
  }, [effectiveTheme]);

  const labelPosition: [number, number, number] = [
    position[0] + labelOffset[0],
    position[1] + labelOffset[1],
    position[2] + labelOffset[2]
  ];

  // Side positioning for percentage
  const percentagePosition: [number, number, number] = useMemo(() => {
    const sideOffset = (type === 'entity' ? 2.0 : 2.5) * nodeScale;
    return [
      position[0] + sideOffset,
      position[1],
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

  if (!enhancedShouldShowLabel || !id) {
    console.log(`[DirectNodeLabel] Not rendering label for ${id}: shouldShow=${enhancedShouldShowLabel}`);
    return null;
  }

  console.log(`[DirectNodeLabel] SIMPLIFIED RENDER: "${id}" (${type}) at position`, labelPosition, 'with size:', textSize);

  return (
    <>
      {/* SIMPLIFIED: Main text using TranslatableText3D with direct translation */}
      <TranslatableText3D
        text={id}
        position={labelPosition}
        color={textColor}
        size={textSize}
        visible={true}
        renderOrder={15}
        bold={isHighlighted || isSelected}
        outlineWidth={0}
        maxWidth={600}
        enableWrapping={true}
        maxCharsPerLine={13}
        maxLines={3}
        sourceLanguage="en"
      />
      
      {/* Side-positioned percentage text */}
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
          maxWidth={200}
          enableWrapping={false}
        />
      )}
    </>
  );
};

export default DirectNodeLabel;
