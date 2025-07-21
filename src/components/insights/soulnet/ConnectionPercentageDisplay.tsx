
import React, { useMemo } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

interface ConnectionPercentageDisplayProps {
  selectedNodeId: string;
  targetNodeId: string;
  selectedPosition: THREE.Vector3;
  targetPosition: THREE.Vector3;
  connectionStrength: number;
  cameraZoom: number;
  effectiveTheme: 'light' | 'dark';
}

export const ConnectionPercentageDisplay: React.FC<ConnectionPercentageDisplayProps> = ({
  selectedNodeId,
  targetNodeId,
  selectedPosition,
  targetPosition,
  connectionStrength,
  cameraZoom,
  effectiveTheme
}) => {
  const textProps = useMemo(() => {
    // Calculate midpoint between nodes
    const midpoint = new THREE.Vector3()
      .addVectors(selectedPosition, targetPosition)
      .multiplyScalar(0.5);

    // Calculate offset perpendicular to the line
    const direction = new THREE.Vector3()
      .subVectors(targetPosition, selectedPosition)
      .normalize();
    
    const perpendicular = new THREE.Vector3(-direction.y, direction.x, 0);
    const offset = perpendicular.multiplyScalar(0.3);
    
    const textPosition = midpoint.clone().add(offset);

    // Calculate text size based on camera zoom
    const baseSize = 0.15;
    const textSize = Math.max(baseSize / Math.sqrt(cameraZoom), 0.05);

    // Format percentage
    const percentage = Math.round(connectionStrength * 100);
    const displayText = `${percentage}%`;

    // Color based on strength and theme
    let color = '#666666';
    if (connectionStrength > 0.7) {
      color = effectiveTheme === 'light' ? '#22c55e' : '#4ade80'; // Strong connection
    } else if (connectionStrength > 0.4) {
      color = effectiveTheme === 'light' ? '#f59e0b' : '#fbbf24'; // Medium connection
    } else {
      color = effectiveTheme === 'light' ? '#ef4444' : '#f87171'; // Weak connection
    }

    return {
      position: textPosition,
      size: textSize,
      text: displayText,
      color
    };
  }, [selectedPosition, targetPosition, connectionStrength, cameraZoom, effectiveTheme]);

  console.log('[ConnectionPercentageDisplay] Rendering:', {
    selectedNodeId,
    targetNodeId,
    connectionStrength,
    percentage: Math.round(connectionStrength * 100),
    position: textProps.position,
    size: textProps.size
  });

  return (
    <Text
      position={textProps.position}
      fontSize={textProps.size}
      color={textProps.color}
      anchorX="center"
      anchorY="middle"
      font="/fonts/inter-medium.woff"
      outlineWidth={0.01}
      outlineColor={effectiveTheme === 'light' ? '#ffffff' : '#000000'}
    >
      {textProps.text}
    </Text>
  );
};
