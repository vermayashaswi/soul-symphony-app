
import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReliableText from './ReliableText';
import { useTranslation } from '@/contexts/TranslationContext';
import { simpleFontService } from '@/utils/simpleFontService';

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
  
  console.log(`[ProgressiveNodeLabel] Enhanced label for ${id}, stage: ${translationStage}, visible: ${shouldShowLabel}`);

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

  // Enhanced initialization with reliable font service
  useEffect(() => {
    if (!mounted.current || initializationRef.current) return;
    
    console.log(`[ProgressiveNodeLabel] Starting enhanced initialization for ${id}`);
    initializationRef.current = true;

    const init = async () => {
      try {
        // Stage 1: Initial setup
        setDisplayText(id);
        setTranslationStage('initial');

        // Stage 2: Font readiness check (non-blocking)
        if (simpleFontService.isReady()) {
          setIsReady(true);
        } else {
          simpleFontService.waitForFonts().then(() => {
            if (mounted.current) setIsReady(true);
          });
          // Fallback timeout
          setTimeout(() => {
            if (mounted.current) setIsReady(true);
          }, 100);
        }

        // Stage 3: Translation processing (delayed)
        setTimeout(() => {
          if (mounted.current && shouldShowLabel) {
            setTranslationStage('processing');
          }
        }, 200);
      } catch (error) {
        console.error('[ProgressiveNodeLabel] Initialization error:', error);
        setDisplayText(id);
        setIsReady(true);
        setTranslationStage('complete');
      }
    };

    init();
  }, [id, shouldShowLabel]);

  // Enhanced translation processing
  useEffect(() => {
    if (!mounted.current || translationStage !== 'processing' || !isReady) return;

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
              setTimeout(() => reject(new Error('Translation timeout')), 2000)
            )
          ]);

          if (mounted.current && translated && typeof translated === 'string') {
            setDisplayText(translated);
            setTranslationStage('complete');
            console.log(`[ProgressiveNodeLabel] Translation success: ${id} -> ${translated}`);
          } else if (mounted.current) {
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
  }, [translationStage, id, currentLanguage, translate, isReady]);

  // Cleanup
  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

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

  // Don't render until ready and visible
  if (!isReady || !shouldShowLabel || translationStage === 'initial' || !displayText) {
    console.log(`[ProgressiveNodeLabel] Not rendering: ready=${isReady}, visible=${shouldShowLabel}, stage=${translationStage}, text="${displayText}"`);
    return null;
  }

  const labelOffset = calculateOffset();
  const labelPosition: [number, number, number] = [
    position[0] + labelOffset[0],
    position[1] + labelOffset[1], 
    position[2] + labelOffset[2]
  ];

  console.log(`[ProgressiveNodeLabel] Rendering enhanced text "${displayText}" for ${id} at`, labelPosition);

  return (
    <ReliableText
      text={displayText}
      position={labelPosition}
      color={textColor}
      size={textSize}
      visible={true}
      renderOrder={15}
      bold={isHighlighted || isSelected}
      outlineWidth={isSelected ? 0.04 : 0.02}
      outlineColor={isSelected ? '#000000' : '#333333'}
      maxWidth={25}
    />
  );
};

export default ProgressiveNodeLabel;
