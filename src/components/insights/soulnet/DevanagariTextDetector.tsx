
import React from 'react';

interface DevanagariTextDetectorProps {
  text: string;
  children: (isDevanagari: boolean, scriptType: string) => React.ReactNode;
}

export const DevanagariTextDetector: React.FC<DevanagariTextDetectorProps> = ({
  text,
  children
}) => {
  const detectScriptType = (text: string): string => {
    if (!text) return 'latin';
    
    // Enhanced script detection
    if (/[\u0900-\u097F]/.test(text)) return 'devanagari';
    if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text)) return 'arabic';
    if (/[\u4E00-\u9FFF\u3400-\u4DBF]/.test(text)) return 'chinese';
    if (/[\u3040-\u309F\u30A0-\u30FF\u31F0-\u31FF]/.test(text)) return 'japanese';
    if (/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(text)) return 'korean';
    
    return 'latin';
  };

  const scriptType = detectScriptType(text);
  const isDevanagari = scriptType === 'devanagari';

  return <>{children(isDevanagari, scriptType)}</>;
};

export default DevanagariTextDetector;
