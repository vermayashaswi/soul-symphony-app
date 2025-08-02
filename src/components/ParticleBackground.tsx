
import React, { useEffect, useRef } from 'react';
import { useTheme } from '@/hooks/use-theme';

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  color: string;
  opacity: number;
  life: number;
  maxLife: number;
}

export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const animationRef = useRef<number>();
  const mousePos = useRef<{ x: number, y: number } | null>(null);
  const lastTouchTime = useRef<number>(0);
  // Defensive hook usage to prevent runtime errors during app initialization
  let theme = 'light';
  let systemTheme = 'light';
  
  try {
    const themeData = useTheme();
    theme = themeData.theme;
    systemTheme = themeData.systemTheme;
  } catch (error) {
    // ThemeProvider not ready, using defaults
  }
  
  // Golden color palette for particles
  const goldenColors = [
    '#FFD700', // Gold
    '#FFC125', // Golden yellow
    '#F1C232', // Soft gold
    '#DAA520', // Goldenrod
    '#F7DC6F', // Light gold
    '#FFE082', // Light golden
    '#FEF7CD', // Very light gold
    '#FFF4B2', // Pale gold
    '#F97316', // Bright orange with gold tint
    '#FFBD17', // Amber gold
  ];
  
  const getRandomGoldenColor = () => goldenColors[Math.floor(Math.random() * goldenColors.length)];
  
  const createRipple = (x: number, y: number, count = 15) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.8 + Math.random() * 2.5;
      
      particles.current.push({
        x,
        y,
        size: 2 + Math.random() * 5,
        speedX: Math.cos(angle) * speed,
        speedY: Math.sin(angle) * speed,
        color: getRandomGoldenColor(),
        opacity: 0.8,
        life: 0,
        maxLife: 50 + Math.random() * 100
      });
    }
  };
  
  const createFloatingParticles = (canvas: HTMLCanvasElement, count = 50) => {
    const { width, height } = canvas;
    
    for (let i = 0; i < count; i++) {
      particles.current.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: 1.5 + Math.random() * 3,
        speedX: (Math.random() - 0.5) * 0.8,
        speedY: (Math.random() - 0.5) * 0.8,
        color: getRandomGoldenColor(),
        opacity: 0.4 + Math.random() * 0.4,
        life: 0,
        maxLife: 200 + Math.random() * 200
      });
    }
  };
  
  const drawParticles = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const now = Date.now();
    if (mousePos.current && now - lastTouchTime.current > 40) {
      createRipple(mousePos.current.x, mousePos.current.y, 6);
      lastTouchTime.current = now;
    }
    
    if (particles.current.length < 120) {
      createFloatingParticles(canvas, 8);
    }
    
    const liveParticles: Particle[] = [];
    
    particles.current.forEach(particle => {
      particle.life += 1;
      
      if (particle.life < particle.maxLife) {
        const fadeInPhase = Math.min(1, particle.life / 20);
        const fadeOutPhase = Math.max(0, 1 - (particle.life - (particle.maxLife * 0.7)) / (particle.maxLife * 0.3));
        particle.opacity = 0.9 * fadeInPhase * fadeOutPhase;
        
        particle.x += particle.speedX;
        particle.y += particle.speedY;
        
        particle.speedX *= 0.991;
        particle.speedY *= 0.991;
        
        // Add a glow effect to the golden particles
        const currentTheme = theme === 'system' ? systemTheme : theme;
        
        // Draw glow
        ctx.shadowBlur = 6;
        ctx.shadowColor = particle.color;
        ctx.globalAlpha = particle.opacity * 0.6;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size + 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw particle
        ctx.shadowBlur = 0;
        ctx.globalAlpha = particle.opacity;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
        
        liveParticles.push(particle);
      }
    });
    
    particles.current = liveParticles;
    
    animationRef.current = requestAnimationFrame(() => drawParticles(ctx, canvas));
  };
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const updateCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    
    // Increase initial particles for more visible effect
    createFloatingParticles(canvas, 150);
    
    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = {
        x: e.clientX,
        y: e.clientY
      };
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        mousePos.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY
        };
      }
    };
    
    const handleClick = (e: MouseEvent) => {
      createRipple(e.clientX, e.clientY, 40);
    };
    
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        createRipple(e.touches[0].clientX, e.touches[0].clientY, 40);
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('click', handleClick);
    window.addEventListener('touchstart', handleTouchStart);
    
    animationRef.current = requestAnimationFrame(() => drawParticles(ctx, canvas));
    
    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('touchstart', handleTouchStart);
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [theme, systemTheme]);
  
  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }} // Ensure it has a z-index of 0
    />
  );
}

export default ParticleBackground;
