
import React, { useState, useEffect, useRef } from 'react';
import { Slider } from "@/components/ui/slider";
import { cn } from '@/lib/utils';
import { Check as CheckIcon } from 'lucide-react';

interface ColorPickerProps {
  value: string;
  onChange: (hexColor: string) => void;
  className?: string;
}

export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  const [hue, setHue] = useState(0);
  const [currentColor, setCurrentColor] = useState(value || '#3b82f6');
  const colorCircleRef = useRef<HTMLDivElement>(null);

  // Initialize hue from input value
  useEffect(() => {
    if (value) {
      const rgb = hexToRgb(value);
      if (rgb) {
        const [h] = rgbToHsl(rgb.r, rgb.g, rgb.b);
        setHue(h);
      }
    }
  }, [value]);

  // Update color when hue changes
  useEffect(() => {
    const hslColor = `hsl(${hue}, 80%, 60%)`;
    const hexColor = hslToHex(hue, 80, 60);
    setCurrentColor(hexColor);
  }, [hue]);

  const handleHueChange = (newHue: number[]) => {
    setHue(newHue[0]);
    const hexColor = hslToHex(newHue[0], 80, 60);
    onChange(hexColor);
  };

  // Convert HSL to Hex
  const hslToHex = (h: number, s: number, l: number): string => {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  // Utility function to convert hex to RGB
  const hexToRgb = (hex: string): { r: number, g: number, b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };
  
  // Utility function to convert RGB to HSL
  const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      
      h /= 6;
    }
    
    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
  };

  // Generate background with color spectrum
  const generateSpectrumBackground = () => {
    let gradient = 'linear-gradient(to right, ';
    for (let i = 0; i <= 360; i += 30) {
      gradient += `hsl(${i}, 80%, 60%) ${i/3.6}%, `;
    }
    // Remove trailing comma and space
    gradient = gradient.slice(0, -2);
    gradient += ')';
    return gradient;
  };

  return (
    <div className={cn("flex flex-col space-y-4", className)}>
      <div 
        className="w-full h-24 rounded-xl overflow-hidden relative cursor-pointer"
        style={{ background: generateSpectrumBackground() }}
        onClick={(e) => {
          if (colorCircleRef.current) {
            const rect = colorCircleRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const width = rect.width;
            const newHue = Math.round((x / width) * 360);
            setHue(newHue);
            handleHueChange([newHue]);
          }
        }}
        ref={colorCircleRef}
      >
        <div 
          className="absolute top-0 bottom-0 w-1 bg-white border-2 border-gray-800 transform -translate-x-1/2"
          style={{ 
            left: `${hue / 3.6}%`,
            boxShadow: '0 0 0 2px rgba(255,255,255,0.5)'
          }}
        />
      </div>
      
      <Slider
        value={[hue]}
        min={0}
        max={360}
        step={1}
        onValueChange={handleHueChange}
        className="w-full"
      />

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          <div 
            className="h-8 w-8 rounded-full border-2 border-gray-200"
            style={{ backgroundColor: currentColor }}
          />
          <span className="text-sm font-medium text-foreground">{currentColor.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}
