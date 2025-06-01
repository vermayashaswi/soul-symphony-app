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
  const [useSimplified, setUseSimplified] = useState(false);
  const mounted = useRef<boolean>(true);
  
  console.log(`[ProgressiveNodeLabel] Processing label for ${id}`);

  // Calculate label position offset
  const calculateOffset = (): [number, number, number] => {
    const baseOffset = type === 'entity' ? 1.8 : 2.2;
    const scaledOffset = baseOffset * (nodeScale || 1);
    return [0, scaledOffset, 0];
  };

  // Handle text processing with progressive enhancement
  useEffect(() => {
    if (!mounted.current) return;

    const processText = async () => {
      try {
        // Start with original text
        setDisplayText(id);
        setIsReady(true);

        // If not English, attempt translation
        if (currentLanguage !== 'en' && translate) {
          try {
            const translated = await Promise.race([
              translate(id),
              new Promise<string>((_, reject) => 
                setTimeout(() => reject(new Error('Translation timeout')), 3000)
              )
            ]);

            if (mounted.current && translated && typeof translated === 'string') {
              setDisplayText(translated);
              console.log(`[ProgressiveNodeLabel] Translation success: ${id} -> ${translated}`);
            }
          } catch (error) {
            console.warn(`[ProgressiveNodeLabel] Translation failed for ${id}, using original`);
            // Keep original text on translation failure
          }
        }
      } catch (error) {
        console.error(`[ProgressiveNodeLabel] Processing error for ${id}:`, error);
        setUseSimplified(true);
      }
    };

    processText();
  }, [id, currentLanguage, translate]);

  // Cleanup
  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  // Don't render if not ready or not visible
  if (!isReady || !shouldShowLabel) {
    return null;
  }

  // Calculate text properties
  const textSize = useMemo(() => {
    const zoom = cameraZoom || 45;
    const baseSize = 0.4;
    const zoomFactor = Math.max(0.7, Math.min(1.3, (50 - zoom) * 0.02 + 1));
    return baseSize * zoomFactor;
  }, [cameraZoom]);

  const textColor = useMemo(() => {
    if (isSelected) return '#ffffff';
    if (isHighlighted) return type === 'entity' ? '#ffffff' : themeHex;
    return '#cccccc';
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
