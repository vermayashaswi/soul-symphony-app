
import React, { useMemo, useEffect, useState } from 'react';
import SimpleText from './SimpleText';
import { useTranslation } from '@/contexts/TranslationContext';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

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
  const { currentLanguage, translate } = useTranslation();
  const [displayText, setDisplayText] = useState<string>(id);
  const [isTranslationReady, setIsTranslationReady] = useState<boolean>(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);

  console.log(`[DirectNodeLabel] Rendering for ${id}, visible: ${shouldShowLabel}`);

  // Handle translation with retry mechanism
  const attemptTranslation = async (attempt: number = 0) => {
    if (!shouldShowLabel || !id) {
      setIsTranslationReady(false);
      return;
    }

    try {
      setTranslationError(null);
      
      if (currentLanguage === 'en' || !translate) {
        setDisplayText(id);
        setIsTranslationReady(true);
        return;
      }

      console.log(`[DirectNodeLabel] Translation attempt ${attempt + 1} for "${id}" to ${currentLanguage}`);
      const translated = await translate(id);
      
      if (translated && typeof translated === 'string') {
        setDisplayText(translated);
        console.log(`[DirectNodeLabel] Translation successful: "${id}" -> "${translated}"`);
      } else {
        setDisplayText(id);
      }
      
      setIsTranslationReady(true);
      setRetryCount(0);
    } catch (error) {
      console.error(`[DirectNodeLabel] Translation attempt ${attempt + 1} failed for ${id}:`, error);
      setTranslationError(error.message || 'Translation failed');
      
      if (attempt < 2) {
        // Auto-retry up to 3 times
        setTimeout(() => attemptTranslation(attempt + 1), 1000 * (attempt + 1));
      } else {
        // After 3 attempts, show original text and allow manual retry
        setDisplayText(id);
        setIsTranslationReady(true);
        setRetryCount(attempt + 1);
      }
    }
  };

  useEffect(() => {
    setIsTranslationReady(false);
    attemptTranslation();
  }, [id, currentLanguage, translate, shouldShowLabel]);

  // Manual retry function
  const handleRetry = () => {
    setIsTranslationReady(false);
    setRetryCount(0);
    attemptTranslation();
  };

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

  if (!enhancedShouldShowLabel || !id || !isTranslationReady) {
    console.log(`[DirectNodeLabel] NOT RENDERING: ${id} - shouldShow=${enhancedShouldShowLabel}, isReady=${isTranslationReady}`);
    return null;
  }

  console.log(`[DirectNodeLabel] RENDERING with GoogleWebTranslate: "${displayText}"`);

  return (
    <>
      {/* Main text label */}
      <SimpleText
        text={displayText}
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
      
      {/* Retry button for failed translations */}
      {translationError && retryCount > 2 && (
        <group position={[position[0], position[1] - 2, position[2]]}>
          <Button
            onClick={handleRetry}
            size="sm"
            variant="outline"
            className="text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry Translation
          </Button>
        </group>
      )}
    </>
  );
};

export default DirectNodeLabel;
