
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { SoulNetTranslationPreloader } from '@/services/soulnetTranslationPreloader';
import UnifiedTextRenderer from './UnifiedTextRenderer';

interface UnifiedNodeLabelProps {
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
  userId?: string;
  timeRange?: string;
}

// Relaxed text validation utilities - allow valid node names with special characters
function isValidNodeText(text: string): boolean {
  if (typeof text !== 'string') {
    console.warn(`[UnifiedNodeLabel] Non-string text:`, typeof text, text);
    return false;
  }
  
  const trimmed = text.trim();
  
  if (trimmed.length === 0) {
    console.warn(`[UnifiedNodeLabel] Empty text after trim:`, text);
    return false;
  }
  
  // More relaxed validation - only reject obvious invalid values
  const invalidValues = ['undefined', 'null', 'NaN', '[object Object]'];
  if (invalidValues.includes(trimmed.toLowerCase())) {
    console.warn(`[UnifiedNodeLabel] Invalid text value:`, trimmed);
    return false;
  }
  
  // Allow single characters and special characters that are valid in node names
  if (trimmed.length < 1) {
    console.warn(`[UnifiedNodeLabel] Text too short:`, trimmed);
    return false;
  }
  
  return true;
}

export const UnifiedNodeLabel: React.FC<UnifiedNodeLabelProps> = ({
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
  userId,
  timeRange
}) => {
  const { currentLanguage } = useTranslation();
  const [displayText, setDisplayText] = useState<string>(id);
  const [isReady, setIsReady] = useState<boolean>(false);

  // Validate node ID with relaxed validation
  const validNodeId = useMemo(() => {
    if (!isValidNodeText(id)) {
      console.warn(`[UnifiedNodeLabel] Invalid node ID: "${id}", using fallback`);
      return `Node_${Date.now()}`;
    }
    return id.trim();
  }, [id]);

  // Handle translation lookup
  useEffect(() => {
    const getTranslation = () => {
      try {
        if (currentLanguage === 'en') {
          setDisplayText(validNodeId);
          setIsReady(true);
          return;
        }

        if (userId && timeRange) {
          const translation = SoulNetTranslationPreloader.getTranslationSync(
            validNodeId,
            currentLanguage,
            userId,
            timeRange
          );

          if (translation && isValidNodeText(translation)) {
            console.log(`[UnifiedNodeLabel] Translation found: "${validNodeId}" -> "${translation}"`);
            setDisplayText(translation);
            setIsReady(true);
            return;
          }
        }

        console.log(`[UnifiedNodeLabel] No translation found, using original: "${validNodeId}"`);
        setDisplayText(validNodeId);
        setIsReady(true);
      } catch (error) {
        console.error(`[UnifiedNodeLabel] Error in translation lookup:`, error);
        setDisplayText(validNodeId);
        setIsReady(true);
      }
    };

    getTranslation();
  }, [validNodeId, currentLanguage, userId, timeRange]);

  // Calculate positions and styling
  const labelOffset = useMemo(() => {
    const baseOffset = 1.4;
    const scaledOffset = baseOffset * Math.max(0.8, Math.min(2.5, nodeScale));
    return [0, scaledOffset, 0] as [number, number, number];
  }, [nodeScale]);

  const textSize = useMemo(() => {
    const clampedZoom = Math.max(15, Math.min(80, cameraZoom));
    const normalizedZoom = (clampedZoom - 15) / (80 - 15);
    const zoomFactor = 0.85 + (normalizedZoom * 0.15);
    const baseSize = type === 'entity' ? 3.5 : 3.2; // 10x larger: 0.35 * 10 = 3.5, 0.32 * 10 = 3.2
    const calculatedSize = baseSize * zoomFactor;
    return Math.max(2.0, Math.min(4.0, calculatedSize)); // 10x larger constraints: 0.2 * 10 = 2.0, 0.4 * 10 = 4.0
  }, [cameraZoom, type]);

  const textColor = useMemo(() => {
    if (isSelected) return '#ffffff';
    if (isHighlighted) return type === 'entity' ? '#ffffff' : themeHex;
    return effectiveTheme === 'dark' ? '#ffffff' : '#000000';
  }, [isSelected, isHighlighted, type, themeHex, effectiveTheme]);

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
  const finalShouldShowLabel = useMemo(() => {
    const currentTutorialStep = document.body.getAttribute('data-current-step');
    return (currentTutorialStep === '9' || shouldShowLabel) && isReady;
  }, [shouldShowLabel, isReady]);

  if (!finalShouldShowLabel || !displayText) {
    return null;
  }

  console.log(`[UnifiedNodeLabel] RENDERING: "${displayText}" (lang: ${currentLanguage}, ready: ${isReady})`);

  return (
    <>
      <UnifiedTextRenderer
        text={displayText}
        position={labelPosition}
        color={textColor}
        size={textSize}
        visible={true}
        renderOrder={15}
        bold={isHighlighted || isSelected}
        outlineWidth={isSelected ? 0.04 : 0.02}
        outlineColor={isSelected ? '#000000' : '#333333'}
        maxWidth={600}
        enableWrapping={true}
        maxCharsPerLine={18}
        maxLines={3}
      />
      
      {showPercentage && connectionPercentage > 0 && (
        <UnifiedTextRenderer
          text={`${connectionPercentage}%`}
          position={percentagePosition}
          color="#ffffff"
          size={1.5}
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

export default UnifiedNodeLabel;
