
import React, { useMemo, useEffect, useState, useCallback } from 'react';
import FlickerFreeTranslatableText3D from './FlickerFreeTranslatableText3D';
import SimpleText from './SimpleText';
import { useTranslation } from '@/contexts/TranslationContext';

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
  nodeScale = 1,
  connectionPercentage = 0,
  showPercentage = false,
  effectiveTheme = 'light',
  userId,
  timeRange
}) => {
  const { currentLanguage } = useTranslation();
  const [hasValidTranslation, setHasValidTranslation] = useState<boolean>(false);

  // Check translation availability
  useEffect(() => {
    if (currentLanguage === 'en') {
      setHasValidTranslation(true);
      return;
    }
    setHasValidTranslation(false);
  }, [currentLanguage, id]);

  // Handle translation completion
  const handleTranslationComplete = useCallback((translatedText: string) => {
    const isValid = !!translatedText;
    setHasValidTranslation(isValid);
    console.log(`[DirectNodeLabel] Translation ${isValid ? 'confirmed' : 'failed'} for ${id}`);
  }, [id]);

  // Calculate positions and styling
  const labelOffset = useMemo(() => {
    const baseOffset = 1.4;
    const scaledOffset = baseOffset * Math.max(0.8, Math.min(2.5, nodeScale));
    return [0, scaledOffset, 0] as [number, number, number];
  }, [nodeScale]);

  const textSize = 2.0;
  const percentageTextSize = 1.5;
  const textColor = effectiveTheme === 'dark' ? '#ffffff' : '#000000';
  const percentageColor = '#ffffff';

  const labelPosition: [number, number, number] = [
    position[0] + labelOffset[0],
    position[1] + labelOffset[1],
    position[2] + labelOffset[2]
  ];

  const percentagePosition: [number, number, number] = [
    position[0] + 2.5,
    position[1] + 0.5,
    position[2] + 0.5
  ];

  // Enhanced visibility for tutorial step 9
  const enhancedShouldShowLabel = useMemo(() => {
    const currentTutorialStep = document.body.getAttribute('data-current-step');
    return currentTutorialStep === '9' || shouldShowLabel;
  }, [shouldShowLabel]);

  // Only show if translation is available
  const finalShouldShowLabel = enhancedShouldShowLabel && (currentLanguage === 'en' || hasValidTranslation);

  if (!finalShouldShowLabel || !id) {
    return null;
  }

  return (
    <>
      <FlickerFreeTranslatableText3D
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
        maxCharsPerLine={18}
        maxLines={3}
        sourceLanguage="en"
        userId={userId}
        timeRange={timeRange}
        onTranslationComplete={handleTranslationComplete}
      />
      
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
