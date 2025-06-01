
import React, { useEffect, useState, useRef } from 'react';
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

  // Translate text
  useEffect(() => {
    const translateText = async () => {
      if (currentLanguage === 'en' || !text) {
        setTranslatedText(text);
        return;
      }
      
      try {
        const result = await translate(text);
        setTranslatedText(result);
        console.log(`[HTMLLabel] Translated "${text}" to "${result}" for language ${currentLanguage}`);
      } catch (e) {
        console.error('[HTMLLabel] Translation error:', e);
        setTranslatedText(text);
      }
    };
    
    translateText();
  }, [text, currentLanguage, translate]);

  // Update screen position on every frame
  useFrame(() => {
    if (!isVisible) return;

    // Convert 3D position to screen coordinates
    vector.current.set(position[0], position[1], position[2]);
    vector.current.project(camera);

    const x = (vector.current.x * 0.5 + 0.5) * size.width;
    const y = (vector.current.y * -0.5 + 0.5) * size.height;
    const z = vector.current.z;

    setScreenPosition({ x, y, z });
  });

  // Hide label if behind camera or not visible
  const shouldShow = isVisible && screenPosition.z < 1;

  if (!shouldShow) return null;

  // Detect script for font selection
  const isDevanagari = /[\u0900-\u097F]/.test(translatedText);
  const isArabic = /[\u0600-\u06FF]/.test(translatedText);
  const isCJK = /[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/.test(translatedText);

  return (
    <div
      ref={labelRef}
      className={cn(
        "absolute pointer-events-none select-none transition-all duration-300 z-50",
        "text-center font-medium shadow-lg rounded-md px-2 py-1",
        isSelected && "scale-110 font-bold",
        isHighlighted && "scale-105",
        nodeType === 'entity' ? "bg-white/90 text-gray-900 border border-gray-200" : "bg-gray-900/90 text-white border border-gray-600",
        isDevanagari && "text-lg", // Larger text for Devanagari
        className
      )}
      style={{
        left: `${screenPosition.x}px`,
        top: `${screenPosition.y - 30}px`, // Offset above the node
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
        wordBreak: 'break-word',
        opacity: shouldShow ? 1 : 0,
        visibility: shouldShow ? 'visible' : 'hidden'
      }}
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
  return (
    <div className="absolute inset-0 pointer-events-none z-40">
      {labels.map((label) => (
        <HTMLLabel
          key={label.id}
          {...label}
        />
      ))}
    </div>
  );
};

export default HTMLLabelOverlay;
