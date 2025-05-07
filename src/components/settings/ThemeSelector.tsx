
import React from 'react';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';

const ThemeSelector: React.FC = () => {
  const { colorTheme, setColorTheme } = useTheme();

  const themeOptions = [
    { name: 'Default', color: '#3b82f6' }, // Blue
    { name: 'Calm', color: '#8b5cf6' },    // Purple
    { name: 'Soothing', color: '#FFDEE2' }, // Soft pink
    { name: 'Energy', color: '#f59e0b' },  // Amber
    { name: 'Focus', color: '#10b981' },   // Emerald
  ];

  return (
    <div className="grid grid-cols-5 gap-2">
      {themeOptions.map((theme) => (
        <button
          key={theme.name}
          className={cn(
            "flex flex-col items-center p-2 rounded-md transition-all",
            colorTheme === theme.name 
              ? "ring-2 ring-primary ring-offset-2 ring-offset-background" 
              : "hover:bg-accent"
          )}
          onClick={() => setColorTheme(theme.name as any)}
          aria-label={`Select ${theme.name} theme`}
        >
          <div 
            className="h-8 w-8 rounded-full mb-1"
            style={{ backgroundColor: theme.color }}
          />
          <span className="text-xs">{theme.name}</span>
        </button>
      ))}
    </div>
  );
};

export default ThemeSelector;
