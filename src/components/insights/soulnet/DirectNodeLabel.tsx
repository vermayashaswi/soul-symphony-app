
import React, { useMemo } from 'react';
import ReliableText from './ReliableText';
import { ConnectionPercentage } from './ConnectionPercentage';

interface DirectNodeLabelProps {
  id: string;
  type: 'entity' | 'emotion';
  position: [number, number, number];
  isHighlighted: boolean;
  isSelected: boolean;
  shouldShowLabel: boolean;
  cameraZoom: number;
  themeHex: string;
  nodeScale: number;
  connectionPercentage?: number;
  showPercentage?: boolean;
  effectiveTheme?: 'light' | 'dark';
  isInstantMode?: boolean;
  coordinatedTranslation?: string;
}

const DirectNodeLabel: React.FC<DirectNodeLabelProps> = ({
  id,
  type,
  position,
  isHighlighted,
  isSelected,
  shouldShowLabel,
  cameraZoom,
  themeHex,
  nodeScale,
  connectionPercentage = 0,
  showPercentage = false,
  effectiveTheme = 'light',
  isInstantMode = false,
  coordinatedTranslation
}) => {
  // Use coordinated translation if available, otherwise fall back to ID
  const displayText = useMemo(() => {
    return coordinatedTranslation || id;
  }, [coordinatedTranslation, id]);

  // ENHANCED: Better label positioning with improved offset calculations
  const labelPosition: [number, number, number] = useMemo(() => {
    const baseOffset = type === 'emotion' ? 1.8 : 1.2;
    const scaleAdjustment = nodeScale * 0.5;
    const yOffset = baseOffset + scaleAdjustment;
    
    return [position[0], position[1] + yOffset, position[2]];
  }, [position, type, nodeScale]);

  // ENHANCED: Dynamic text sizing based on selection state and camera zoom
  const textSize = useMemo(() => {
    const baseSize = 0.35;
    const zoomFactor = Math.max(0.8, Math.min(1.5, 50 / cameraZoom));
    const selectionMultiplier = isSelected ? 1.4 : (isHighlighted ? 1.2 : 1.0);
    
    return baseSize * zoomFactor * selectionMultiplier;
  }, [cameraZoom, isSelected, isHighlighted]);

  // ENHANCED: Better color scheme with theme awareness
  const textColor = useMemo(() => {
    if (isSelected) {
      return effectiveTheme === 'dark' ? '#ffffff' : '#000000';
    }
    if (isHighlighted) {
      return effectiveTheme === 'dark' ? '#e5e5e5' : '#1f1f1f';
    }
    return effectiveTheme === 'dark' ? '#cccccc' : '#333333';
  }, [isSelected, isHighlighted, effectiveTheme]);

  const outlineColor = useMemo(() => {
    return effectiveTheme === 'dark' ? '#000000' : '#ffffff';
  }, [effectiveTheme]);

  if (!shouldShowLabel) {
    return null;
  }

  console.log(`[DirectNodeLabel] ENHANCED RENDER: ${id} - translation: "${displayText}", showPercentage: ${showPercentage}, percentage: ${connectionPercentage}%`);

  return (
    <group>
      {/* Main node label */}
      <ReliableText
        text={displayText}
        position={labelPosition}
        color={textColor}
        size={textSize}
        visible={true}
        renderOrder={20}
        bold={isSelected}
        outlineWidth={0.06}
        outlineColor={outlineColor}
        maxWidth={15}
      />
      
      {/* ENHANCED: Connection percentage display with better positioning */}
      {showPercentage && connectionPercentage > 0 && (
        <ConnectionPercentage
          position={[position[0], position[1] - 1.5, position[2] + 1.0]}
          percentage={connectionPercentage}
          isVisible={true}
          offsetY={-1.5}
          nodeType={type}
        />
      )}
    </group>
  );
};

export default DirectNodeLabel;
