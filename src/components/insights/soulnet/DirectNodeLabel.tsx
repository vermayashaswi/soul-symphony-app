
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

// ENHANCED: Comprehensive text validation for node labels
function isValidNodeId(id: string): boolean {
  if (typeof id !== 'string') {
    console.warn(`[DirectNodeLabel] Non-string node ID:`, typeof id, id);
    return false;
  }
  
  const trimmed = id.trim();
  
  // Check for empty or whitespace-only strings
  if (trimmed.length === 0) {
    console.warn(`[DirectNodeLabel] Empty node ID after trim:`, id);
    return false;
  }
  
  // Check for invalid placeholder values
  const invalidValues = ['undefined', 'null', 'NaN', '[object Object]', 'true', 'false'];
  if (invalidValues.includes(trimmed.toLowerCase())) {
    console.warn(`[DirectNodeLabel] Invalid node ID value:`, trimmed);
    return false;
  }
  
  // Check for numeric-only strings (often invalid entities)
  if (/^\d+$/.test(trimmed)) {
    console.warn(`[DirectNodeLabel] Numeric-only node ID:`, trimmed);
    return false;
  }
  
  // Check minimum meaningful length
  if (trimmed.length < 2) {
    console.warn(`[DirectNodeLabel] Node ID too short:`, trimmed);
    return false;
  }
  
  console.log(`[DirectNodeLabel] Valid node ID:`, trimmed);
  return true;
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
  const [translationReady, setTranslationReady] = useState<boolean>(false);
  const [displayMode, setDisplayMode] = useState<'loading' | 'ready' | 'fallback'>('loading');

  // ENHANCED: Validate node ID before processing
  const validNodeId = useMemo(() => {
    if (!isValidNodeId(id)) {
      console.warn(`[DirectNodeLabel] Invalid node ID: "${id}", entering fallback mode`);
      setDisplayMode('fallback');
      return null;
    }
    return id.trim();
  }, [id]);

  // ENHANCED: Smart readiness detection with fallback handling
  useEffect(() => {
    if (!validNodeId) {
      setDisplayMode('fallback');
      setTranslationReady(false);
      return;
    }

    if (currentLanguage === 'en') {
      console.log(`[DirectNodeLabel] English language, marking ready for ${validNodeId}`);
      setTranslationReady(true);
      setDisplayMode('ready');
    } else {
      // Start optimistic for non-English, will be corrected by translation completion
      console.log(`[DirectNodeLabel] Non-English language (${currentLanguage}), starting optimistic for ${validNodeId}`);
      setTranslationReady(true);
      setDisplayMode('ready');
    }
  }, [currentLanguage, validNodeId]);

  // Handle translation completion
  const handleTranslationComplete = useCallback((translatedText: string) => {
    if (validNodeId) {
      setTranslationReady(true);
      setDisplayMode('ready');
      console.log(`[DirectNodeLabel] Translation confirmed for ${validNodeId}: "${translatedText}"`);
    }
  }, [validNodeId]);

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

  // ENHANCED: Always show labels if we should - don't wait for translations, but validate node ID
  const finalShouldShowLabel = enhancedShouldShowLabel && (validNodeId !== null);

  if (!finalShouldShowLabel) {
    return null;
  }

  // Use fallback display for invalid node IDs
  const displayText = validNodeId || `Invalid_${Date.now()}`;

  console.log(`[DirectNodeLabel] RENDERING LABEL: ${displayText} (ready: ${translationReady}, lang: ${currentLanguage}, valid: ${!!validNodeId}, mode: ${displayMode})`);

  return (
    <>
      <FlickerFreeTranslatableText3D
        text={displayText}
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
