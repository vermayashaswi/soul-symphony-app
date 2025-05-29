
import React, { useEffect, useRef } from 'react';
import { useTutorial } from '@/contexts/TutorialContext';

interface ThemeData {
  theme: string;
  sentiment: number;
}

interface FloatingThemeStripsProps {
  themesData: ThemeData[];
  themeColor: string;
}

const FloatingThemeStrips: React.FC<FloatingThemeStripsProps> = ({ 
  themesData, 
  themeColor 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isActive, currentStep, steps } = useTutorial();
  
  // Check if we're in tutorial step 3 (theme strips step)
  const isInThemeStripsStep = isActive && steps[currentStep]?.id === 3;

  useEffect(() => {
    if (!containerRef.current || themesData.length === 0) return;

    // Clear existing strips
    containerRef.current.innerHTML = '';

    // Create theme strips with enhanced animation
    themesData.forEach((themeItem, index) => {
      const strip = document.createElement('div');
      strip.className = 'theme-strip absolute opacity-20 rounded-lg';
      strip.textContent = themeItem.theme;
      
      // Position and styling
      const width = Math.random() * 200 + 100; // 100-300px
      const height = 30 + Math.random() * 20; // 30-50px
      const initialX = Math.random() * (window.innerWidth - width);
      const initialY = Math.random() * (window.innerHeight - height);
      
      // Color based on sentiment with theme color influence
      const sentimentFactor = (themeItem.sentiment + 1) / 2; // Normalize to 0-1
      const opacity = 0.1 + sentimentFactor * 0.3; // 0.1 to 0.4 opacity
      
      strip.style.cssText = `
        left: ${initialX}px;
        top: ${initialY}px;
        width: ${width}px;
        height: ${height}px;
        background: linear-gradient(45deg, ${themeColor}${Math.floor(opacity * 255).toString(16).padStart(2, '0')}, transparent);
        border: 1px solid ${themeColor}${Math.floor(opacity * 128).toString(16).padStart(2, '0')};
        color: ${themeColor};
        font-size: ${12 + Math.random() * 8}px;
        font-weight: 500;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        z-index: ${isInThemeStripsStep ? '9998' : '1'};
        pointer-events: ${isInThemeStripsStep ? 'none' : 'auto'};
        animation: float-${index % 4} ${15 + Math.random() * 10}s linear infinite;
      `;

      containerRef.current?.appendChild(strip);
    });

    // Create CSS animations dynamically
    const style = document.createElement('style');
    style.textContent = `
      @keyframes float-0 {
        0% { transform: translateX(0) translateY(0) rotate(0deg); }
        25% { transform: translateX(50px) translateY(-30px) rotate(2deg); }
        50% { transform: translateX(-20px) translateY(-60px) rotate(-1deg); }
        75% { transform: translateX(30px) translateY(-30px) rotate(1deg); }
        100% { transform: translateX(0) translateY(0) rotate(0deg); }
      }
      @keyframes float-1 {
        0% { transform: translateX(0) translateY(0) rotate(0deg); }
        25% { transform: translateX(-40px) translateY(20px) rotate(-2deg); }
        50% { transform: translateX(60px) translateY(40px) rotate(1deg); }
        75% { transform: translateX(-30px) translateY(20px) rotate(-1deg); }
        100% { transform: translateX(0) translateY(0) rotate(0deg); }
      }
      @keyframes float-2 {
        0% { transform: translateX(0) translateY(0) rotate(0deg); }
        25% { transform: translateX(70px) translateY(10px) rotate(1deg); }
        50% { transform: translateX(-50px) translateY(30px) rotate(-2deg); }
        75% { transform: translateX(20px) translateY(10px) rotate(1deg); }
        100% { transform: translateX(0) translateY(0) rotate(0deg); }
      }
      @keyframes float-3 {
        0% { transform: translateX(0) translateY(0) rotate(0deg); }
        25% { transform: translateX(-60px) translateY(-20px) rotate(-1deg); }
        50% { transform: translateX(40px) translateY(-40px) rotate(2deg); }
        75% { transform: translateX(-20px) translateY(-20px) rotate(-1deg); }
        100% { transform: translateX(0) translateY(0) rotate(0deg); }
      }
    `;

    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, [themesData, themeColor, isInThemeStripsStep]);

  return (
    <div 
      ref={containerRef}
      className="floating-theme-strips fixed inset-0 pointer-events-none overflow-hidden"
      data-tutorial-target="theme-strips"
      style={{
        zIndex: isInThemeStripsStep ? '9998' : '1'
      }}
    />
  );
};

export default FloatingThemeStrips;
