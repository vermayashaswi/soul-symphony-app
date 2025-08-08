
import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/hooks/use-theme';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  size: number;
  opacity: number;
  color: string;
}

interface ParticleAvatarProps {
  className?: string;
  size?: number;
}

const ParticleAvatar: React.FC<ParticleAvatarProps> = ({ 
  className = "h-8 w-8", 
  size = 32 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);
  // Defensive hook usage to prevent runtime errors during app initialization
  let colorTheme = 'Default';
  let customColor = '#3b82f6';
  
  try {
    const themeData = useTheme();
    colorTheme = themeData.colorTheme;
    customColor = themeData.customColor || '#3b82f6';
  } catch (error) {
    console.warn('ParticleAvatar: ThemeProvider not ready, using defaults');
  }
  const [themeColor, setThemeColor] = useState('#8b5cf6');

  // Get theme color
  useEffect(() => {
    const getThemeColor = () => {
      switch (colorTheme) {
        case 'Default': return '#3b82f6';
        case 'Calm': return '#8b5cf6';
        case 'Soothing': return '#FFDEE2';
        case 'Energy': return '#f59e0b';
        case 'Focus': return '#10b981';
        case 'Custom': return customColor;
        default: return '#8b5cf6';
      }
    };
    setThemeColor(getThemeColor());
  }, [colorTheme, customColor]);

  // Convert hex to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 139, g: 92, b: 246 };
  };

  // Create human silhouette points
  const createHumanSilhouette = (width: number, height: number) => {
    const points: { x: number; y: number }[] = [];
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Head (circle)
    const headRadius = width * 0.15;
    const headY = height * 0.25;
    for (let angle = 0; angle < Math.PI * 2; angle += 0.2) {
      points.push({
        x: centerX + Math.cos(angle) * headRadius,
        y: headY + Math.sin(angle) * headRadius
      });
    }
    
    // Torso (rectangle)
    const torsoWidth = width * 0.25;
    const torsoHeight = height * 0.4;
    const torsoY = height * 0.45;
    for (let y = 0; y < torsoHeight; y += 3) {
      for (let x = -torsoWidth/2; x <= torsoWidth/2; x += 3) {
        points.push({
          x: centerX + x,
          y: torsoY + y
        });
      }
    }
    
    // Arms (lines)
    const armLength = width * 0.2;
    const armY = height * 0.5;
    // Left arm
    for (let x = 0; x < armLength; x += 3) {
      points.push({
        x: centerX - torsoWidth/2 - x,
        y: armY + x * 0.3
      });
    }
    // Right arm
    for (let x = 0; x < armLength; x += 3) {
      points.push({
        x: centerX + torsoWidth/2 + x,
        y: armY + x * 0.3
      });
    }
    
    return points;
  };

  // Initialize particles
  const initParticles = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const silhouettePoints = createHumanSilhouette(canvas.width, canvas.height);
    const particles: Particle[] = [];
    const rgb = hexToRgb(themeColor);
    
    // Create particles based on silhouette points
    silhouettePoints.forEach((point, index) => {
      const particle: Particle = {
        x: point.x + (Math.random() - 0.5) * 4,
        y: point.y + (Math.random() - 0.5) * 4,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        targetX: point.x,
        targetY: point.y,
        size: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.6 + 0.4,
        color: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.random() * 0.6 + 0.4})`
      };
      particles.push(particle);
    });
    
    // Add some random floating particles for effect
    for (let i = 0; i < 50; i++) {
      const particle: Particle = {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 1,
        vy: (Math.random() - 0.5) * 1,
        targetX: Math.random() * canvas.width,
        targetY: Math.random() * canvas.height,
        size: Math.random() * 1 + 0.3,
        opacity: Math.random() * 0.3 + 0.1,
        color: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.random() * 0.3 + 0.1})`
      };
      particles.push(particle);
    }
    
    particlesRef.current = particles;
  };

  // Animation loop
  const animate = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const time = Date.now() * 0.001;
    const breathingEffect = Math.sin(time * 2) * 0.02 + 1;
    
    particlesRef.current.forEach((particle) => {
      // Apply gentle movement towards target with breathing effect
      const dx = (particle.targetX - particle.x) * 0.05;
      const dy = (particle.targetY - particle.y) * 0.05;
      
      particle.vx += dx;
      particle.vy += dy;
      
      // Add some random drift
      particle.vx += (Math.random() - 0.5) * 0.02;
      particle.vy += (Math.random() - 0.5) * 0.02;
      
      // Apply damping
      particle.vx *= 0.98;
      particle.vy *= 0.98;
      
      // Update position
      particle.x += particle.vx;
      particle.y += particle.vy;
      
      // Apply breathing effect
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const offsetX = (particle.x - centerX) * (breathingEffect - 1) * 0.1;
      const offsetY = (particle.y - centerY) * (breathingEffect - 1) * 0.1;
      
      // Draw particle
      ctx.globalAlpha = particle.opacity;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(
        particle.x + offsetX, 
        particle.y + offsetY, 
        particle.size * breathingEffect, 
        0, 
        Math.PI * 2
      );
      ctx.fill();
    });
    
    animationRef.current = requestAnimationFrame(animate);
  };

  // Setup canvas and start animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Set canvas size
    canvas.width = size;
    canvas.height = size;
    
    // Initialize particles
    initParticles();
    
    // Start animation
    animate();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [size, themeColor]);

  // Update particle colors when theme changes
  useEffect(() => {
    const rgb = hexToRgb(themeColor);
    particlesRef.current.forEach((particle) => {
      particle.color = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${particle.opacity})`;
    });
  }, [themeColor]);

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-full"
        style={{ imageRendering: 'auto' }}
      />
    </div>
  );
};

export default ParticleAvatar;
