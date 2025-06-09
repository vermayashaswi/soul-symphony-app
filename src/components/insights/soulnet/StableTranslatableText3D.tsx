
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { useLocation } from 'react-router-dom';
import { translationStabilityService } from '@/services/translationStabilityService';
import SmartTextRenderer from './SmartTextRenderer';

interface StableTranslatableText3DProps {
  text: string;
  position: [number, number, number];
  color?: string;
  size?: number;
  visible?: boolean;
  renderOrder?: number;
  bold?: boolean;
  outlineWidth?: number;
  outlineColor?: string;
  maxWidth?: number;
  enableWrapping?: boolean;
  maxCharsPerLine?: number;
  maxLines?: number;
  sourceLanguage?: string;
  onTranslationComplete?: (translatedText: string) => void;
  timeRange?: string; // Added to track current time view
}

export const StableTranslatableText3D: React.FC<StableTranslatableText3DProps> = ({
  text,
  position,
  color = '#000000',
  size = 0.4,
  visible = true,
  renderOrder = 10,
  bold = false,
  outlineWidth = 0,
  outlineColor,
  maxWidth = 25,
  enableWrapping = false,
  maxCharsPerLine = 18,
  maxLines = 3,
  sourceLanguage = 'en',
  onTranslationComplete,
  timeRange = 'week'
}) => {
  const { currentLanguage, translate } = useTranslation();
  const location = useLocation();
  const [translatedText, setTranslatedText] = useState<string>(text);
  const [isTranslating, setIsTranslating] = useState(false);
  const currentLanguageRef = useRef<string>(currentLanguage);
  const route = location.pathname;

  useEffect(() => {
    const handleTranslation = async () => {
      // If language hasn't changed and we're same source language, use original
      if (currentLanguage === sourceLanguage) {
        setTranslatedText(text);
        onTranslationComplete?.(text);
        return;
      }

      // Check if translations are locked for this view
      if (translationStabilityService.isTranslationLocked(currentLanguage, route, timeRange)) {
        console.log(`[StableTranslatableText3D] Translations locked for ${currentLanguage}_${route}_${timeRange}, using persistent state`);
        
        // Get persistent state
        const persistentState = translationStabilityService.getTranslationState(text, currentLanguage, route, timeRange);
        if (persistentState) {
          setTranslatedText(persistentState.translatedText);
          onTranslationComplete?.(persistentState.translatedText);
          return;
        }

        // Fallback to last known translation across views
        const fallbackTranslation = translationStabilityService.getLastTranslatedText(text, currentLanguage);
        if (fallbackTranslation) {
          console.log(`[StableTranslatableText3D] Using fallback translation for "${text.substring(0, 30)}"`);
          setTranslatedText(fallbackTranslation);
          onTranslationComplete?.(fallbackTranslation);
          return;
        }
      }

      // Check for existing persistent state first
      const existingState = translationStabilityService.getTranslationState(text, currentLanguage, route, timeRange);
      if (existingState) {
        console.log(`[StableTranslatableText3D] Using persistent state for "${text.substring(0, 30)}"`);
        setTranslatedText(existingState.translatedText);
        onTranslationComplete?.(existingState.translatedText);
        return;
      }

      // Check if we have a fallback from other views
      const fallbackTranslation = translationStabilityService.getLastTranslatedText(text, currentLanguage);
      if (fallbackTranslation) {
        console.log(`[StableTranslatableText3D] Using cross-view fallback for "${text.substring(0, 30)}"`);
        setTranslatedText(fallbackTranslation);
        // Store this as the state for current view too
        translationStabilityService.setTranslationState(text, fallbackTranslation, currentLanguage, route, timeRange, sourceLanguage);
        onTranslationComplete?.(fallbackTranslation);
        return;
      }

      // Only translate if we don't have any existing state and translations aren't locked
      if (!translationStabilityService.isTranslationLocked(currentLanguage, route, timeRange)) {
        console.log(`[StableTranslatableText3D] Performing new translation for "${text.substring(0, 30)}"`);
        
        setIsTranslating(true);
        try {
          const result = await translate(text, sourceLanguage);
          
          if (result && result !== text) {
            setTranslatedText(result);
            onTranslationComplete?.(result);
            
            // Store the translation state
            translationStabilityService.setTranslationState(text, result, currentLanguage, route, timeRange, sourceLanguage);
            
            // Check if we have enough translations to mark this view as stable
            translationStabilityService.checkViewStability(currentLanguage, route, timeRange);
          } else {
            setTranslatedText(text);
            onTranslationComplete?.(text);
          }
        } catch (error) {
          console.error(`[StableTranslatableText3D] Translation failed for "${text.substring(0, 30)}"`, error);
          setTranslatedText(text);
          onTranslationComplete?.(text);
        } finally {
          setIsTranslating(false);
        }
      } else {
        // If locked but no state, use original
        setTranslatedText(text);
        onTranslationComplete?.(text);
      }
    };

    // Only retranslate if language actually changed
    const languageChanged = currentLanguageRef.current !== currentLanguage;
    if (languageChanged) {
      currentLanguageRef.current = currentLanguage;
      console.log(`[StableTranslatableText3D] Language changed to ${currentLanguage}, clearing locks`);
      translationStabilityService.unlockAllTranslations();
    }

    handleTranslation();
  }, [text, currentLanguage, sourceLanguage, route, timeRange, translate, onTranslationComplete]);

  // Listen for language change events
  useEffect(() => {
    const handleLanguageChangeEvent = () => {
      console.log(`[StableTranslatableText3D] Language change event received`);
      translationStabilityService.unlockAllTranslations();
      currentLanguageRef.current = currentLanguage;
    };
    
    window.addEventListener('languageChange', handleLanguageChangeEvent as EventListener);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChangeEvent as EventListener);
    };
  }, [currentLanguage]);

  return (
    <SmartTextRenderer
      text={translatedText}
      position={position}
      color={isTranslating ? '#888888' : color}
      size={size}
      visible={visible}
      renderOrder={renderOrder}
      bold={bold}
      outlineWidth={outlineWidth}
      outlineColor={outlineColor}
      maxWidth={maxWidth}
      enableWrapping={enableWrapping}
      maxCharsPerLine={maxCharsPerLine}
      maxLines={maxLines}
    />
  );
};

export default StableTranslatableText3D;
