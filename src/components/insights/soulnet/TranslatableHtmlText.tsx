
import React, { useMemo, useEffect, useState } from 'react';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { googleTranslateService } from '@/services/googleTranslateService';
import { useTranslation } from '@/contexts/TranslationContext';

interface TranslatableHtmlTextProps {
  text: string;
  style?: React.CSSProperties;
  className?: string;
  isSelected?: boolean;
  isHighlighted?: boolean;
  nodeType?: 'entity' | 'emotion';
}

export const TranslatableHtmlText: React.FC<TranslatableHtmlTextProps> = ({
  text,
  style = {},
  className = '',
  isSelected = false,
  isHighlighted = false,
  nodeType = 'entity'
}) => {
  const { currentLanguage } = useTranslation();
  const [isGoogleTranslateReady, setIsGoogleTranslateReady] = useState(false);
  
  console.log(`[TranslatableHtmlText] Rendering text: "${text}" in language: ${currentLanguage}`);

  // Initialize Google Translate service
  useEffect(() => {
    const initializeTranslate = async () => {
      try {
        await googleTranslateService.initialize();
        setIsGoogleTranslateReady(true);
        console.log('[TranslatableHtmlText] Google Translate service ready');
      } catch (error) {
        console.warn('[TranslatableHtmlText] Google Translate service failed to initialize:', error);
        setIsGoogleTranslateReady(false);
      }
    };

    initializeTranslate();
  }, []);

  // Enhanced script detection with better font fallbacks
  const scriptAwareFontFamily = useMemo(() => {
    if (!text) return 'Inter, system-ui, sans-serif';
    
    // Devanagari script detection (Hindi, Marathi, Nepali, etc.)
    if (/[\u0900-\u097F]/.test(text)) {
      return 'Noto Sans Devanagari, Devanagari Sangam MN, Mangal, Inter, system-ui, sans-serif';
    }
    
    // Arabic script detection
    if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text)) {
      return 'Noto Sans Arabic, Arabic Typesetting, Tahoma, Inter, system-ui, sans-serif';
    }
    
    // Japanese script detection (Hiragana, Katakana, Kanji)
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) {
      return 'Noto Sans JP, Hiragino Kaku Gothic Pro, Meiryo, Inter, system-ui, sans-serif';
    }
    
    // Korean script detection
    if (/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(text)) {
      return 'Noto Sans KR, Malgun Gothic, Dotum, Inter, system-ui, sans-serif';
    }
    
    // Chinese script detection
    if (/[\u4E00-\u9FFF]/.test(text)) {
      return 'Noto Sans SC, Microsoft YaHei, SimHei, Inter, system-ui, sans-serif';
    }
    
    // Default to Inter for Latin scripts
    return 'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  }, [text]);

  const mergedStyle = useMemo(() => {
    return {
      fontFamily: scriptAwareFontFamily,
      fontSize: '12px',
      fontWeight: (isHighlighted || isSelected) ? 'bold' : 'normal',
      color: '#ffffff',
      textAlign: 'center' as const,
      textShadow: isSelected 
        ? '2px 2px 4px rgba(0,0,0,0.8), 0 0 8px rgba(255,255,255,0.3)' 
        : '1px 1px 2px rgba(0,0,0,0.6), 0 0 4px rgba(255,255,255,0.2)',
      maxWidth: '120px',
      wordWrap: 'break-word' as const,
      whiteSpace: 'nowrap' as const,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      lineHeight: '1.2',
      padding: '2px 4px',
      borderRadius: '2px',
      backgroundColor: isSelected ? 'rgba(0,0,0,0.2)' : 'transparent',
      backdropFilter: isSelected ? 'blur(2px)' : 'none',
      WebkitBackdropFilter: isSelected ? 'blur(2px)' : 'none', // Safari support
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
      textRendering: 'optimizeLegibility',
      ...style
    };
  }, [scriptAwareFontFamily, isSelected, isHighlighted, style]);

  const mergedClassName = useMemo(() => {
    const baseClasses = 'soul-net-label select-none pointer-events-none';
    const stateClasses = isSelected ? 'soul-net-label-selected' : '';
    const highlightClasses = isHighlighted ? 'soul-net-label-highlighted' : '';
    return `${baseClasses} ${stateClasses} ${highlightClasses} ${className}`.trim();
  }, [className, isSelected, isHighlighted]);

  try {
    return (
      <div
        style={mergedStyle}
        className={mergedClassName}
        data-translate="yes"
        data-node-type={nodeType}
        data-google-translate-ready={isGoogleTranslateReady}
        lang="auto"
      >
        <TranslatableText
          text={text || 'Unknown'}
          as="span"
          forceTranslate={true}
        />
      </div>
    );
  } catch (error) {
    console.error('[TranslatableHtmlText] Error rendering text:', error);
    
    // Fallback rendering without translation
    return (
      <div 
        style={{
          ...mergedStyle,
          fontFamily: 'Inter, system-ui, sans-serif' // Safe fallback font
        }} 
        className={mergedClassName}
      >
        {text || 'Unknown'}
      </div>
    );
  }
};

export default TranslatableHtmlText;
