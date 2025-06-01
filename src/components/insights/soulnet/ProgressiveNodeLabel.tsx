
import React, { useState, useEffect, useRef, useMemo } from 'react';
import SimplifiedText from './SimplifiedText';
import { useTranslation } from '@/contexts/TranslationContext';

interface ProgressiveNodeLabelProps {
  id: string;
  type: 'entity' | 'emotion';
  position: [number, number, number];
  isHighlighted: boolean;
  isSelected: boolean;
  shouldShowLabel: boolean;
  cameraZoom?: number;
  themeHex: string;
  nodeScale?: number;
}

export const ProgressiveNodeLabel: React.FC<ProgressiveNodeLabelProps> = ({
  id,
  type,
  position,
  isHighlighted,
  isSelected,
  shouldShowLabel,
  cameraZoom,
  themeHex,
  nodeScale = 1
}) => {
  const { currentLanguage, translate } = useTranslation();
  const [displayText, setDisplayText] = useState<string>(id);
  const [isReady, setIsReady] = useState(false);
  const [translationStage, setTranslationStage] = useState<'initial' | 'processing' | 'complete'>('initial');
  const mounted = useRef<boolean>(true);
  const initializationRef = useRef<boolean>(false);
  
  console.log(`[ProgressiveNodeLabel] Label for ${id}, stage: ${translationStage}`);

  // Calculate label position offset with safety checks
  const calculateOffset = (): [number, number, number] => {
    try {
      const baseOffset = type === 'entity' ? 1.8 : 2.2;
      const scaledOffset = baseOffset * Math.max(0.5, Math.min(2, nodeScale || 1));
      return [0, scaledOffset, 0];
    } catch (error) {
      console.warn('[ProgressiveNodeLabel] Offset calculation error:', error);
      return [0, 2, 0];
    }
  };

  // Staged initialization to prevent render crashes
  useEffect(() => {
    if (!mounted.current || initializationRef.current) return;
    
    console.log(`[ProgressiveNodeLabel] Starting staged initialization for ${id}`);
    initializationRef.current = true;

    // Stage 1: Initial setup (immediate)
    setDisplayText(id);
    setTranslationStage('initial');

    // Stage 2: Ready for rendering (delayed)
    const readyTimer = setTimeout(() => {
      if (mounted.current) {
        setIsReady(true);
        console.log(`[ProgressiveNodeLabel] ${id} ready for rendering`);
      }
    }, 200);

    // Stage 3: Translation processing (further delayed)
    const translationTimer = setTimeout(() => {
      if (mounted.current && shouldShowLabel) {
        setTranslationStage('processing');
        console.log(`[ProgressiveNodeLabel] Starting translation for ${id}`);
      }
    }, 800);

    return () => {
      clearTimeout(readyTimer);
      clearTimeout(translationTimer);
    };
  }, [id, shouldShowLabel]);

  // Handle translation processing with error safety
  useEffect(() => {
    if (!mounted.current || translationStage !== 'processing') return;

    const processTranslation = async () => {
      try {
        // For English or no translate function, use original text
        if (currentLanguage === 'en' || !translate) {
          if (mounted.current) {
            setDisplayText(id);
            setTranslationStage('complete');
            console.log(`[ProgressiveNodeLabel] Using original text for ${id}`);
          }
          return;
        }

        // Attempt translation with timeout and error handling
        try {
          const translated = await Promise.race([
            translate(id),
            new Promise<string>((_, reject) => 
              setTimeout(() => reject(new Error('Translation timeout')), 3000)
            )
          ]);

          if (mounted.current && translated && typeof translated === 'string') {
            setDisplayText(translated);
            setTranslationStage('complete');
            console.log(`[ProgressiveNodeLabel] Translation success: ${id} -> ${translated}`);
          } else if (mounted.current) {
            // Fallback to original on invalid result
            setDisplayText(id);
            setTranslationStage('complete');
            console.warn(`[ProgressiveNodeLabel] Invalid translation, using original: ${id}`);
          }
        } catch (error) {
          console.warn(`[ProgressiveNodeLabel] Translation failed for ${id}, using original`);
          if (mounted.current) {
            setDisplayText(id);
            setTranslationStage('complete');
          }
        }
      } catch (error) {
        console.error(`[ProgressiveNodeLabel] Processing error for ${id}:`, error);
        if (mounted.current) {
          setDisplayText(id);
          setTranslationStage('complete');
        }
      }
    };

    processTranslation();
  }, [translationStage, id, currentLanguage, translate]);

  // Cleanup
  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  // Don't render until ready and visible
  if (!isReady || !shouldShowLabel || translationStage === 'initial') {
    return null;
  }

  // Calculate text properties with safety checks
  const textSize = useMemo(() => {
    try {
      const zoom = cameraZoom || 45;
      const baseSize = 0.4;
      const zoomFactor = Math.max(0.7, Math.min(1.3, (50 - zoom) * 0.02 + 1));
      return Math.max(0.2, Math.min(0.8, baseSize * zoomFactor));
    } catch (error) {
      console.warn('[ProgressiveNodeLabel] Text size calculation error:', error);
      return 0.4;
    }
  }, [cameraZoom]);

  const textColor = useMemo(() => {
    try {
      if (isSelected) return '#ffffff';
      if (isHighlighted) return type === 'entity' ? '#ffffff' : themeHex;
      return '#cccccc';
    } catch (error) {
      console.warn('[ProgressiveNodeLabel] Text color calculation error:', error);
      return '#ffffff';
    }
  }, [isSelected, isHighlighted, type, themeHex]);

  const labelOffset = calculateOffset();
  const labelPosition: [number, number, number] = [
    position[0] + labelOffset[0],
    position[1] + labelOffset[1], 
    position[2] + labelOffset[2]
  ];

  console.log(`[ProgressiveNodeLabel] Rendering label "${displayText}" for ${id}`);

  return (
    <SimplifiedText
      text={displayText}
      position={labelPosition}
      color={textColor}
      size={textSize}
      visible={true}
      renderOrder={15}
      maxWidth={25}
    />
  );
};

export default ProgressiveNodeLabel;
