import React from 'react';
import { Html } from '@react-three/drei';

interface TextItem {
  id: string;
  text: string;
  position: [number, number, number];
  color: string;
  size: number;
  visible: boolean;
  bold: boolean;
  isHighlighted: boolean;
  isSelected: boolean;
  nodeType: 'entity' | 'emotion';
}

interface HtmlTextOverlayProps {
  textItems: TextItem[];
}

export const HtmlTextOverlay: React.FC<HtmlTextOverlayProps> = ({ textItems }) => {
  if (!textItems || textItems.length === 0) {
    return null;
  }

  return (
    <>
      {textItems.map(item => {
        if (!item.visible || !Array.isArray(item.position) || item.position.length !== 3) {
          return null;
        }

        return (
          <Html
            key={`html-text-${item.id}`}
            position={item.position}
            center
            style={{
              color: item.color,
              fontSize: `${item.size * 16}px`,
              fontWeight: item.bold ? 'bold' : 'normal',
              pointerEvents: 'none',
              userSelect: 'none',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              textShadow: item.isSelected ? '0 0 4px rgba(0,0,0,0.5)' : 'none'
            }}
          >
            {item.text}
          </Html>
        );
      })}
    </>
  );
};

export default HtmlTextOverlay;
