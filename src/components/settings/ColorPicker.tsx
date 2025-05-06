
import React from 'react';
import { cn } from '@/lib/utils';
import { ColorTheme } from '@/types/theme';

interface ColorPickerProps {
  selectedTheme?: ColorTheme;
  onChange?: (color: ColorTheme) => void;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  selectedTheme = 'blue',
  onChange
}) => {
  const colorOptions = [
    { name: 'blue', color: '#3b82f6', hoverColor: '#2563eb' },
    { name: 'green', color: '#10b981', hoverColor: '#059669' },
    { name: 'purple', color: '#8b5cf6', hoverColor: '#7c3aed' },
    { name: 'pink', color: '#ec4899', hoverColor: '#db2777' },
    { name: 'orange', color: '#f97316', hoverColor: '#ea580c' },
    { name: 'red', color: '#ef4444', hoverColor: '#dc2626' },
    { name: 'teal', color: '#14b8a6', hoverColor: '#0d9488' },
    { name: 'indigo', color: '#6366f1', hoverColor: '#4f46e5' },
  ];

  const handleColorChange = (color: ColorTheme) => {
    if (onChange) {
      onChange(color);
    }
  };

  return (
    <div className="color-picker grid grid-cols-4 gap-2">
      {colorOptions.map((option) => (
        <button
          key={option.name}
          className={cn(
            "w-10 h-10 rounded-full transition-all",
            "hover:ring-2 hover:ring-offset-2 hover:ring-offset-background",
            selectedTheme === option.name ? "ring-2 ring-offset-2 ring-offset-background" : ""
          )}
          style={{ 
            backgroundColor: option.color,
            boxShadow: selectedTheme === option.name ? `0 0 0 2px ${option.hoverColor}` : 'none'
          }}
          onClick={() => handleColorChange(option.name as ColorTheme)}
          aria-label={`Select ${option.name} theme`}
          title={`${option.name.charAt(0).toUpperCase() + option.name.slice(1)} theme`}
        />
      ))}
    </div>
  );
};

export default ColorPicker;
