
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { translationService } from '@/services/translationService';
import UnifiedTextRenderer from './UnifiedTextRenderer';

interface StreamlinedNodeLabelProps {
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

// Simple text validation - allow any reasonable text
function isValidText(text: string): boolean {
  return typeof text === 'string' && text.trim().length > 0;
}

export const StreamlinedNodeLabel: React.FC<StreamlinedNodeLabelProps> = ({
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
  const { currentLanguage } = useTranslation();
  const [displayText, setDisplayText] = useState<string>(id);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);

  // Validate node ID
  const validNodeId = useMemo(() => {
    return isValidText(id) ? id.trim() : `Node_${Date.now()}`;
  }, [id]);

  // STREAMLINED TRANSLATION - Always attempt translation for non-English
  useEffect(() => {
    const translateNodeText = async () => {
      if (currentLanguage === 'en') {
        setDisplayText(validNodeId);
        return;
      }

      // For non-English languages, ALWAYS attempt translation
      console.log(`[StreamlinedNodeLabel] ALWAYS translating "${validNodeId}" to ${currentLanguage}`);
      
      try {
        setIsTranslating(true);
        
        // Direct translation call - no conditions, no prerequisites
        const translatedText = await translationService.translateText(
          validNodeId,
          currentLanguage,
          'en'
        );
        
        if (translatedText && isValidText(translatedText) && translatedText !== validNodeId) {
          console.log(`[StreamlinedNodeLabel] SUCCESS: "${validNodeId}" -> "${translatedText}"`);
          setDisplayText(translatedText);
        } else {
          console.log(`[StreamlinedNodeLabel] Translation returned original text for "${validNodeId}"`);
          setDisplayText(validNodeId);
        }
      } catch (error) {
        console.error(`[StreamlinedNodeLabel] Translation error for "${validNodeId}":`, error);
        setDisplayText(validNodeId);
      } finally {
        setIsTranslating(false);
      }
    };

    translateNodeText();
  }, [validNodeId, currentLanguage]);

  // Calculate positions and styling - same as before
  const labelOffset = useMemo(() => {
    const baseOffset = 1.4;
    const scaledOffset = baseOffset * Math.max(0.8, Math.min(2.5, nodeScale));
    return [0, scaledOffset, 0] as [number, number, number];
  }, [nodeScale]);

  const textSize = useMemo(() => {
    const clampedZoom = Math.max(15, Math.min(80, cameraZoom));
    const normalizedZoom = (clampedZoom - 15) / (80 - 15);
    const zoomFactor = 0.85 + (normalizedZoom * 0.15);
    const baseSize = type === 'entity' ? 3.5 : 3.2;
    const calculatedSize = baseSize * zoomFactor;
    return Math.max(2.0, Math.min(4.0, calculatedSize));
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
    return currentTutorialStep === '9' || shouldShowLabel;
  }, [shouldShowLabel]);

  if (!finalShouldShowLabel || !displayText) {
    return null;
  }

  console.log(`[StreamlinedNodeLabel] RENDERING: "${displayText}" (lang: ${currentLanguage}, translating: ${isTranslating})`);

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

export default StreamlinedNodeLabel;
