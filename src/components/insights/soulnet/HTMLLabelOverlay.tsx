
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useTranslation } from '@/contexts/TranslationContext';
import { cn } from '@/lib/utils';

interface HTMLLabelProps {
  id: string;
  text: string;
  position: [number, number, number];
  isVisible: boolean;
  isHighlighted: boolean;
  isSelected: boolean;
  nodeType: 'entity' | 'emotion';
  color?: string;
  className?: string;
}

const HTMLLabel: React.FC<HTMLLabelProps> = ({
  id,
  text,
  position,
  isVisible,
  isHighlighted,
  isSelected,
  nodeType,
  color = '#ffffff',
  className
}) => {
  const { translate, currentLanguage } = useTranslation();
  const [translatedText, setTranslatedText] = useState(text);
  const [screenPosition, setScreenPosition] = useState({ x: 0, y: 0, z: 0 });
  const { camera, size } = useThree();
  const labelRef = useRef<HTMLDivElement>(null);
  const vector = useRef(new THREE.Vector3());
  const isTranslatingRef = useRef(false);

  // Safe translation with error handling
  useEffect(() => {
    const translateText = async () => {
      if (currentLanguage === 'en' || !text || isTranslatingRef.current) {
        setTranslatedText(text);
        return;
      }
      
      isTranslatingRef.current = true;
      
      try {
        const result = await translate(text);
        setTranslatedText(result || text);
        console.log(`[HTMLLabel] Translated "${text}" to "${result}" for language ${currentLanguage}`);
      } catch (e) {
        console.error('[HTMLLabel] Translation error:', e);
        setTranslatedText(text);
      } finally {
        isTranslatingRef.current = false;
      }
    };
    
    translateText();
  }, [text, currentLanguage, translate]);

  // Safe position update with error handling
  const updatePosition = useCallback(() => {
    if (!isVisible || !camera || !size || !position) return;

    try {
      // Validate position array
      if (!Array.isArray(position) || position.length !== 3) {
        console.warn('Invalid position for label:', id, position);
        return;
      }

      // Check for valid numbers
      if (position.some(coord => typeof coord !== 'number' || isNaN(coord))) {
        console.warn('Invalid coordinates for label:', id, position);
        return;
      }

      // Convert 3D position to screen coordinates
      vector.current.set(position[0], position[1], position[2]);
      vector.current.project(camera);

      // Check for valid projection
      if (isNaN(vector.current.x) || isNaN(vector.current.y) || isNaN(vector.current.z)) {
        console.warn('Invalid projection for label:', id);
        return;
      }

      const x = (vector.current.x * 0.5 + 0.5) * size.width;
      const y = (vector.current.y * -0.5 + 0.5) * size.height;
      const z = vector.current.z;

      // Validate screen coordinates
      if (isNaN(x) || isNaN(y) || isNaN(z)) {
        console.warn('Invalid screen coordinates for label:', id);
        return;
      }

      setScreenPosition({ x, y, z });
    } catch (error) {
      console.error('Position update error for label:', id, error);
    }
  }, [isVisible, camera, size, position, id]);

  // Update screen position on every frame with throttling
  const frameCountRef = useRef(0);
  useFrame(() => {
    frameCountRef.current++;
    // Only update every 2nd frame for performance
    if (frameCountRef.current % 2 === 0) {
      updatePosition();
    }
  });

  // Hide label if behind camera or not visible
  const shouldShow = isVisible && screenPosition.z < 1 && screenPosition.z > -1;

  if (!shouldShow || !translatedText) return null;

  // Safe script detection
  const detectScript = (text: string) => {
    try {
      const isDevanagari = /[\u0900-\u097F]/.test(text);
      const isArabic = /[\u0600-\u06FF]/.test(text);
      const isCJK = /[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/.test(text);
      return { isDevanagari, isArabic, isCJK };
    } catch (error) {
      console.warn('Script detection error:', error);
      return { isDevanagari: false, isArabic: false, isCJK: false };
    }
  };

  const { isDevanagari, isArabic, isCJK } = detectScript(translatedText);

  // Safe style calculation
  const getLabelStyle = () => {
    try {
      return {
        left: `${Math.max(0, Math.min(screenPosition.x, window.innerWidth))}px`,
        top: `${Math.max(0, Math.min(screenPosition.y - 30, window.innerHeight))}px`,
        transform: 'translate(-50%, -50%)',
        color: isSelected || isHighlighted ? undefined : color,
        fontFamily: isDevanagari 
          ? '"Noto Sans Devanagari", sans-serif' 
          : isArabic 
            ? '"Noto Sans Arabic", sans-serif'
            : isCJK
              ? '"Noto Sans CJK SC", sans-serif'
              : '"Inter", sans-serif',
        fontSize: isDevanagari ? '16px' : '14px',
        lineHeight: isDevanagari ? '1.4' : '1.2',
        maxWidth: '200px',
        wordBreak: 'break-word' as const,
        opacity: shouldShow ? 1 : 0,
        visibility: shouldShow ? 'visible' as const : 'hidden' as const,
        pointerEvents: 'none' as const,
        zIndex: 50,
      };
    } catch (error) {
      console.warn('Style calculation error:', error);
      return {
        left: '0px',
        top: '0px',
        opacity: 0,
        visibility: 'hidden' as const,
        pointerEvents: 'none' as const,
      };
    }
  };

  return (
    <div
      ref={labelRef}
      className={cn(
        "absolute select-none transition-all duration-300",
        "text-center font-medium shadow-lg rounded-md px-2 py-1",
        isSelected && "scale-110 font-bold",
        isHighlighted && "scale-105",
        nodeType === 'entity' 
          ? "bg-white/90 text-gray-900 border border-gray-200" 
          : "bg-gray-900/90 text-white border border-gray-600",
        isDevanagari && "text-lg",
        className
      )}
      style={getLabelStyle()}
    >
      {translatedText}
    </div>
  );
};

interface HTMLLabelOverlayProps {
  labels: Array<{
    id: string;
    text: string;
    position: [number, number, number];
    isVisible: boolean;
    isHighlighted: boolean;
    isSelected: boolean;
    nodeType: 'entity' | 'emotion';
    color?: string;
  }>;
}

export const HTMLLabelOverlay: React.FC<HTMLLabelOverlayProps> = ({ labels }) => {
  // Validate labels array
  const validLabels = useMemo(() => {
    try {
      return (labels || []).filter(label => 
        label && 
        typeof label.id === 'string' && 
        typeof label.text === 'string' &&
        Array.isArray(label.position) &&
        label.position.length === 3 &&
        label.position.every(coord => typeof coord === 'number' && !isNaN(coord))
      );
    } catch (error) {
      console.error('Label validation error:', error);
      return [];
    }
  }, [labels]);

  return (
    <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
      {validLabels.map((label) => (
        <HTMLLabel
          key={label.id}
          {...label}
        />
      ))}
    </div>
  );
};

export default HTMLLabelOverlay;
