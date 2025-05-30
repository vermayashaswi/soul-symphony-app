
import React, { useState, useEffect } from 'react';
import { ColorPicker } from './ColorPicker';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTheme } from '@/hooks/use-theme';

export const ColorPickerWrapper: React.FC = () => {
  const { themeColor, setThemeColor } = useTheme();
  const [currentColor, setCurrentColor] = useState(themeColor || '#3b82f6');

  useEffect(() => {
    if (themeColor) {
      setCurrentColor(themeColor);
    }
  }, [themeColor]);

  const handleColorChange = (color: string) => {
    setCurrentColor(color);
    setThemeColor(color);
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium mb-2">
          <TranslatableText text="Theme Color" />
        </h4>
        <p className="text-sm text-muted-foreground mb-4">
          <TranslatableText text="Choose your preferred theme color for the application." />
        </p>
      </div>
      
      <ColorPicker
        value={currentColor}
        onChange={handleColorChange}
        applyImmediately={true}
      />
    </div>
  );
};
