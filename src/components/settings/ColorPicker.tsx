import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Slider } from "@/components/ui/slider";
import { cn } from '@/lib/utils';
import { Check as CheckIcon } from 'lucide-react';

interface ColorPickerProps {
  value: string;
  onChange: (hexColor: string) => void;
  className?: string;
  applyImmediately?: boolean;
}

export function ColorPicker({ value, onChange, className, applyImmediately = false }: ColorPickerProps) {
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(80);
  const [lightness, setLightness] = useState(60);
  const [currentColor, setCurrentColor] = useState(value || '#3b82f6');
  const colorCircleRef = useRef<HTMLDivElement>(null);
  const spectrumRef = useRef<HTMLDivElement>(null);
  
  // Initialize hue from input value - only run once when value initially changes
  useEffect(() => {
    if (value) {
      const rgb = hexToRgb(value);
      if (rgb) {
        const [h, s, l] = rgbToHsl(rgb.r, rgb.g, rgb.b);
        setHue(h);
        setSaturation(s);
        setLightness(l);
      }
    }
  }, [value]);

  // Memoize color conversions to reduce calculations
  const hslToHex = useMemo(() => {
    return (h: number, s: number, l: number): string => {
      l /= 100;
      const a = s * Math.min(l, 1 - l) / 100;
      const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
      };
      return `#${f(0)}${f(8)}${f(4)}`;
    };
  }, []);

  // Use debounced effect for color updates to reduce render frequency
  useEffect(() => {
    const hexColor = hslToHex(hue, saturation, lightness);
    
    // Use RAF to throttle updates and reduce flickering
    requestAnimationFrame(() => {
      setCurrentColor(hexColor);
      
      // If applyImmediately is true, call onChange with every change
      if (applyImmediately) {
        onChange(hexColor);
      }
    });
  }, [hue, saturation, lightness, applyImmediately, onChange, hslToHex]);

  // Handlers with performance optimizations
  const handleHueChange = (newHue: number[]) => {
    setHue(newHue[0]);
  };

  const handleSaturationChange = (newSaturation: number[]) => {
    setSaturation(newSaturation[0]);
  };

  const handleLightnessChange = (newLightness: number[]) => {
    setLightness(newLightness[0]);
  };
  
  // This function explicitly triggers the onChange callback
  const applyColor = () => {
    onChange(currentColor);
  };

  const handleSpectrumClick = (e: React.MouseEvent) => {
    if (spectrumRef.current) {
      const rect = spectrumRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;
      const newHue = Math.round((x / width) * 360);
      setHue(newHue);
    }
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

  // Memoize background gradients to prevent recalculation on every render
  const spectrumBackground = useMemo(() => {
    let gradient = 'linear-gradient(to right, ';
    for (let i = 0; i <= 360; i += 30) {
      gradient += `hsl(${i}, ${saturation}%, ${lightness}%) ${i/3.6}%, `;
    }
    gradient = gradient.slice(0, -2);
    gradient += ')';
    return gradient;
  }, [saturation, lightness]);

  const saturationBackground = useMemo(() => {
    return `linear-gradient(to right, hsl(${hue}, 0%, ${lightness}%), hsl(${hue}, 100%, ${lightness}%))`;
  }, [hue, lightness]);

  const lightnessBackground = useMemo(() => {
    return `linear-gradient(to right, hsl(${hue}, ${saturation}%, 0%), hsl(${hue}, ${saturation}%, 50%), hsl(${hue}, ${saturation}%, 100%))`;
  }, [hue, saturation]);

  return (
    <div className={cn("flex flex-col space-y-4", className)}>
      {/* Color preview */}
      <div className="flex items-center justify-center mb-2">
        <div 
          ref={colorCircleRef}
          className="h-16 w-16 rounded-full border-2 border-gray-200 shadow-md"
          style={{ backgroundColor: currentColor }}
        />
      </div>
      
      {/* Hue spectrum slider */}
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Hue</label>
        <div 
          className="w-full h-8 rounded-lg overflow-hidden relative cursor-pointer mb-2"
          style={{ background: spectrumBackground }}
          onClick={handleSpectrumClick}
          ref={spectrumRef}
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
      </div>
      
      {/* Saturation slider */}
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Saturation</label>
        <div 
          className="w-full h-8 rounded-lg overflow-hidden relative mb-2"
          style={{ background: saturationBackground }}
        />
        <Slider
          value={[saturation]}
          min={0}
          max={100}
          step={1}
          onValueChange={handleSaturationChange}
          className="w-full"
        />
      </div>
      
      {/* Lightness slider */}
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Lightness</label>
        <div 
          className="w-full h-8 rounded-lg overflow-hidden relative mb-2"
          style={{ background: lightnessBackground }}
        />
        <Slider
          value={[lightness]}
          min={10}
          max={90}
          step={1}
          onValueChange={handleLightnessChange}
          className="w-full"
        />
      </div>
      
      {/* Only show apply button if not applying immediately */}
      {!applyImmediately && (
        <button
          onClick={applyColor}
          className="mt-4 px-4 py-2 bg-theme text-white rounded-md flex items-center justify-center gap-2 hover:bg-theme-dark transition-colors"
        >
          <CheckIcon className="h-4 w-4" />
          Apply Color
        </button>
      )}
    </div>
  );
}
