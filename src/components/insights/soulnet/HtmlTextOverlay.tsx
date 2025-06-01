
import React from 'react';
import * as THREE from 'three';

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

        // Create a simple text sprite using canvas texture
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return null;

        canvas.width = 256;
        canvas.height = 64;
        
        context.fillStyle = 'rgba(0, 0, 0, 0)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.font = `${item.bold ? 'bold ' : ''}${Math.max(12, item.size * 16)}px Arial`;
        context.fillStyle = item.color;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        if (item.isSelected) {
          context.shadowColor = 'rgba(0, 0, 0, 0.5)';
          context.shadowBlur = 4;
        }
        
        context.fillText(item.text, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ 
          map: texture,
          transparent: true,
          alphaTest: 0.1
        });
        const sprite = new THREE.Sprite(material);
        
        sprite.position.set(item.position[0], item.position[1], item.position[2]);
        sprite.scale.set(2, 0.5, 1);

        return (
          <primitive 
            key={`text-sprite-${item.id}`} 
            object={sprite} 
          />
        );
      })}
    </>
  );
};

export default HtmlTextOverlay;
