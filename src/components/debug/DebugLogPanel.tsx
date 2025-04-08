
// This file has been emptied as part of the Debug Mode removal.
// Only an empty component that returns null is kept.

import React from 'react';

interface DebugLogPanelProps {
  onClose?: () => void;
}

const DebugLogPanel: React.FC<DebugLogPanelProps> = () => {
  // Return null as we're removing debug functionality
  return null;
};

export default DebugLogPanel;
