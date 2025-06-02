
import React, { useMemo } from 'react';
import { TranslatableText } from '@/components/translation/TranslatableText';

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
  console.log(`[TranslatableHtmlText] Rendering text: "${text}"`);

  // Detect script and apply appropriate font family
  const scriptAwareFontFamily = useMemo(() => {
    if (!text) return 'Inter, system-ui, sans-serif';
    
    // Devanagari script detection (Hindi, Marathi, Nepali, etc.)
    if (/[\u0900-\u097F]/.test(text)) {
      return 'Noto Sans Devanagari, Inter, system-ui, sans-serif';
    }
    
    // Arabic script detection
    if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text)) {
      return 'Noto Sans Arabic, Inter, system-ui, sans-serif';
    }
    
    // Japanese script detection (Hiragana, Katakana, Kanji)
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) {
      return 'Noto Sans JP, Inter, system-ui, sans-serif';
    }
    
    // Korean script detection
    if (/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(text)) {
      return 'Noto Sans KR, Inter, system-ui, sans-serif';
    }
    
    // Chinese script detection (Simplified Chinese)
    if (/[\u4E00-\u9FFF]/.test(text)) {
      return 'Noto Sans SC, Inter, system-ui, sans-serif';
    }
    
    // Default to Inter for Latin scripts
    return 'Inter, system-ui, sans-serif';
  }, [text]);

  const mergedStyle = useMemo(() => {
    return {
      fontFamily: scriptAwareFontFamily,
      fontSize: '12px',
      fontWeight: (isHighlighted || isSelected) ? 'bold' : 'normal',
      color: '#ffffff',
      textAlign: 'center' as const,
      textShadow: isSelected 
        ? '2px 2px 4px rgba(0,0,0,0.8)' 
        : '1px 1px 2px rgba(0,0,0,0.6)',
      maxWidth: '120px',
      wordWrap: 'break-word' as const,
      whiteSpace: 'nowrap' as const,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      lineHeight: '1.2',
      ...style
    };
  }, [scriptAwareFontFamily, isSelected, isHighlighted, style]);

  const mergedClassName = useMemo(() => {
    const baseClasses = 'soul-net-label select-none pointer-events-none';
    return `${baseClasses} ${className}`.trim();
  }, [className]);

  try {
    return (
      <div
        style={mergedStyle}
        className={mergedClassName}
        data-translate="yes"
        data-node-type={nodeType}
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
    return (
      <div style={mergedStyle} className={mergedClassName}>
        {text || 'Unknown'}
      </div>
    );
  }
};

export default TranslatableHtmlText;
