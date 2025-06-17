
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

  // ENHANCED: Always use coordinated translation for instant mode
  const useCoordinatedTranslation = isInstantMode;

  // Enhanced logging with coordination info
  console.log(`[DirectNodeLabel] COORDINATED MODE: ${id} - instant: ${isInstantMode}, coordinated: "${coordinatedTranslation}", useCoordinated: ${useCoordinatedTranslation}`);

  // Same base offset for both entity and emotion nodes
  const labelOffset = useMemo(() => {
    const baseOffset = 1.4;
    const scaledOffset = baseOffset * Math.max(0.8, Math.min(2.5, nodeScale));
    return [0, scaledOffset, 0] as [number, number, number];
  }, [nodeScale]);

  // FIXED FONT SIZE: Constant text size independent of zoom and camera calculations
  const textSize = useMemo(() => {
    const fixedSize = 3.2;
    console.log(`[DirectNodeLabel] FIXED SIZE: ${id} uses constant size ${fixedSize}`);
    return fixedSize;
  }, [id]);

  // FIXED FONT SIZE: Constant percentage text size
  const percentageTextSize = useMemo(() => {
    return 0.9;
  }, []);

  // ENHANCED: Solid theme-based text color
  const textColor = useMemo(() => {
    return effectiveTheme === 'dark' ? '#ffffff' : '#000000';
  }, [effectiveTheme]);

  // ENHANCED: Percentage text uses same solid color
  const percentageColor = useMemo(() => {
    return effectiveTheme === 'dark' ? '#ffffff' : '#000000';
  }, [effectiveTheme]);

  const labelPosition: [number, number, number] = [
    position[0] + labelOffset[0],
    position[1] + labelOffset[1],
    position[2] + labelOffset[2]
  ];

  const percentagePosition: [number, number, number] = [
    position[0],
    position[1] + labelOffset[1] + 0.8,
    position[2]
  ];

  if (!shouldShowLabel) {
    console.log(`[DirectNodeLabel] COORDINATED: Label hidden for ${id}`);
    return null;
  }

  return (
    <>
      {/* ENHANCED: Use coordinated translation system for instant mode */}
      <TranslatableText3D
        text={id}
        position={labelPosition}
        color={textColor}
        size={textSize}
        visible={shouldShowLabel}
        renderOrder={20}
        bold={true}
        outlineWidth={0}
        maxWidth={25}
        enableWrapping={false}
        maxCharsPerLine={18}
        maxLines={1}
        sourceLanguage="en"
        coordinatedTranslation={coordinatedTranslation}
        useCoordinatedTranslation={useCoordinatedTranslation}
      />
      
      {showPercentage && connectionPercentage > 0 && (
        <SimpleText
          text={`${connectionPercentage}%`}
          position={percentagePosition}
          color={percentageColor}
          size={percentageTextSize}
          visible={shouldShowLabel}
          renderOrder={21}
          bold={true}
        />
      )}
    </>
  );
};

export default DirectNodeLabel;
