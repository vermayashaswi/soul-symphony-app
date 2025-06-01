
import React, { useMemo } from 'react';

interface ConnectionPercentageProps {
  position: [number, number, number];
  percentage: number;
  isVisible: boolean;
  offsetY?: number;
  nodeType?: 'entity' | 'emotion';
}

export const ConnectionPercentage: React.FC<ConnectionPercentageProps> = ({
  position,
  percentage,
  isVisible,
  offsetY = 1.0,
  nodeType = 'emotion'
}) => {
  // Since we're using HTML overlay for labels, this component is no longer needed
  // All percentage display is handled by HtmlLabelOverlay
  return null;
};

export default ConnectionPercentage;
