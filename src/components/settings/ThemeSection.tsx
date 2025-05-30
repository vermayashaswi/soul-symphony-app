
import React from 'react';
import { Label } from '@/components/ui/label';
import { 
  Moon, 
  Sun, 
  Palette
} from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';
import { TranslatableText } from '@/components/translation/TranslatableText';

export const ThemeSection: React.FC = () => {
  const { theme, setTheme } = useTheme();

  const themes = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Palette },
  ];

  return (
    <div>
      <Label className="text-sm font-medium mb-3 block">
        <TranslatableText text="Theme" forceTranslate={true} />
      </Label>
      <div className="flex flex-wrap gap-3">
        {themes.map((themeOption) => {
          const Icon = themeOption.icon;
          const isSelected = theme === themeOption.value;
          
          return (
            <button
              key={themeOption.value}
              onClick={() => setTheme(themeOption.value as any)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-colors ${
                isSelected 
                  ? 'border-primary bg-primary/5 text-primary' 
                  : 'border-muted hover:border-primary/50'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">
                <TranslatableText text={themeOption.label} forceTranslate={true} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
