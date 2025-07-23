
import React, { useMemo } from 'react';
import ReliableText from './ReliableText';
import FixedConnectionPercentage from './FixedConnectionPercentage';

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
  // PHASE 1 FIX: Use coordinated translation if available, otherwise use original id
  const displayText = useMemo(() => {
    if (coordinatedTranslation && coordinatedTranslation !== id) {
      console.log(`[DirectNodeLabel] PHASE 1 FIX: Using coordinated translation for ${id}: "${coordinatedTranslation}"`);
      return coordinatedTranslation;
    }
    return id;
  }, [id, coordinatedTranslation]);

  // PHASE 1 FIX: Enhanced label positioning based on node type and scale
  const labelPosition = useMemo((): [number, number, number] => {
    const baseOffset = type === 'entity' ? 1.5 : 1.8;
    const scaledOffset = baseOffset * nodeScale;
    return [
      position[0],
      position[1] + scaledOffset,
      position[2] + 0.5 // Slight Z offset for visibility
    ];
  }, [position, type, nodeScale]);

  // PHASE 1 FIX: Enhanced percentage positioning
  const percentagePosition = useMemo((): [number, number, number] => {
    const baseOffset = type === 'entity' ? 2.2 : 2.5;
    const scaledOffset = baseOffset * nodeScale;
    return [
      position[0],
      position[1] + scaledOffset,
      position[2] + 1.0 // Higher Z offset for percentage
    ];
  }, [position, type, nodeScale]);

  // PHASE 1 FIX: Enhanced color calculation
  const labelColor = useMemo(() => {
    if (isSelected) return '#ffffff';
    if (isHighlighted) return '#f0f0f0';
    return effectiveTheme === 'dark' ? '#cccccc' : '#333333';
  }, [isSelected, isHighlighted, effectiveTheme]);

  // PHASE 1 FIX: Enhanced size calculation based on zoom and selection state
  const labelSize = useMemo(() => {
    const baseSize = 0.5;
    const zoomFactor = Math.max(0.8, Math.min(1.5, 50 / cameraZoom));
    const selectionFactor = isSelected ? 1.3 : isHighlighted ? 1.1 : 1.0;
    return baseSize * zoomFactor * selectionFactor;
  }, [cameraZoom, isSelected, isHighlighted]);

  console.log(`[DirectNodeLabel] PHASE 1 FIX: Rendering label for ${id}`, {
    displayText,
    shouldShowLabel,
    showPercentage,
    connectionPercentage,
    isInstantMode
  });

  if (!shouldShowLabel) {
    return null;
  }

  return (
    <>
      {/* Main node label */}
      <ReliableText
        text={displayText}
        position={labelPosition}
        color={labelColor}
        size={labelSize}
        visible={true}
        renderOrder={15}
        bold={isSelected}
        outlineWidth={isSelected ? 0.06 : 0.04}
        outlineColor={effectiveTheme === 'dark' ? '#000000' : '#000000'}
        maxWidth={20}
      />
      
      {/* PHASE 1 FIX: Enhanced connection percentage display */}
      {showPercentage && connectionPercentage > 0 && (
        <FixedConnectionPercentage
          position={percentagePosition}
          percentage={connectionPercentage}
          isVisible={true}
          nodeType={type}
        />
      )}
    </>
  );
};

export default DirectNodeLabel;
