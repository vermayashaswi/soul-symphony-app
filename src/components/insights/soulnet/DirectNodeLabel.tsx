
import React, { useMemo, useEffect, useState } from 'react';
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
  const { currentLanguage } = useTranslation();
  const [hasValidTranslation, setHasValidTranslation] = useState<boolean>(false);

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

  // STRICT: Check translation availability
  useEffect(() => {
    if (currentLanguage === 'en') {
      setHasValidTranslation(true);
      return;
    }

    // For non-English languages, start with false and wait for translation confirmation
    setHasValidTranslation(false);
  }, [currentLanguage, id]);

  // STRICT: Handle translation completion confirmation
  const handleTranslationComplete = (translatedText: string) => {
    if (translatedText) {
      setHasValidTranslation(true);
      console.log(`[DirectNodeLabel] TRANSLATION CONFIRMED for ${id}: ${translatedText}`);
    } else {
      setHasValidTranslation(false);
      console.log(`[DirectNodeLabel] NO TRANSLATION for ${id}`);
    }
  };

  console.log(`[DirectNodeLabel] STRICT MODE: ${id} - hasValidTranslation: ${hasValidTranslation}, language: ${currentLanguage}`);

  // Same base offset for both entity and emotion nodes
  const labelOffset = useMemo(() => {
    const baseOffset = 1.4;
    const scaledOffset = baseOffset * Math.max(0.8, Math.min(2.5, nodeScale));
    
    console.log(`[DirectNodeLabel] Label offset for ${id} (${type}): ${scaledOffset} (scale: ${nodeScale})`);
    return [0, scaledOffset, 0] as [number, number, number];
  }, [type, nodeScale, id]);

  // Static text size
  const textSize = useMemo(() => {
    const staticSize = 2.0;
    console.log(`[DirectNodeLabel] Static text size for ${id}: ${staticSize}`);
    return staticSize;
  }, [id]);

  // Fixed percentage size
  const percentageTextSize = useMemo(() => {
    const fixedPercentageSize = 1.5;
    console.log(`[DirectNodeLabel] Fixed percentage size for ${id}: ${fixedPercentageSize}`);
    return fixedPercentageSize;
  }, [id]);

  // High contrast colors
  const textColor = useMemo(() => {
    const color = effectiveTheme === 'dark' ? '#ffffff' : '#000000';
    console.log(`[DirectNodeLabel] Text color for ${id}: ${color} (theme: ${effectiveTheme})`);
    return color;
  }, [effectiveTheme, id]);

  // Enhanced percentage visibility
  const percentageColor = useMemo(() => {
    const color = '#ffffff'; // Always white for maximum contrast
    console.log(`[DirectNodeLabel] Percentage color for ${id}: ${color}`);
    return color;
  }, [id]);

  const labelPosition: [number, number, number] = [
    position[0] + labelOffset[0],
    position[1] + labelOffset[1],
    position[2] + labelOffset[2]
  ];

  // Simplified percentage positioning
  const percentagePosition: [number, number, number] = useMemo(() => {
    const simpleSideOffset = 2.5;
    const simpleVerticalOffset = 0.5;
    const simpleZOffset = 0.5;
    
    const finalPosition: [number, number, number] = [
      position[0] + simpleSideOffset,
      position[1] + simpleVerticalOffset,
      position[2] + simpleZOffset
    ];
    
    console.log(`[DirectNodeLabel] Percentage positioning for ${id} (${type}): simple offsets`);
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

  // STRICT: Only show label if we have valid translation OR we're in English
  const finalShouldShowLabel = enhancedShouldShowLabel && (currentLanguage === 'en' || hasValidTranslation);

  if (!finalShouldShowLabel || !id) {
    console.log(`[DirectNodeLabel] NOT RENDERING: ${id} - shouldShow=${enhancedShouldShowLabel}, hasValidTranslation=${hasValidTranslation}, currentLanguage=${currentLanguage}`);
    return null;
  }

  console.log(`[DirectNodeLabel] RENDERING with strict translation handling: "${id}"`);

  return (
    <>
      {/* STRICT: Main text using FlickerFreeTranslatableText3D without fallbacks */}
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
        onTranslationComplete={handleTranslationComplete}
      />
      
      {/* Percentage text with fixed size and better visibility */}
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
