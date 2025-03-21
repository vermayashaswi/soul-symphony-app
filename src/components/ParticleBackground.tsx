
import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

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
  
  const colors = [
    '#9b87f5', '#7E69AB', '#FDE1D3', '#D3E4FD', '#E5DEFF', 
    '#FFDEE2', '#D6BCFA', '#33C3F0'
  ];
  
  const getRandomColor = () => colors[Math.floor(Math.random() * colors.length)];
  
  const createRipple = (x: number, y: number, count = 15) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 2;
      
      particles.current.push({
        x,
        y,
        size: 1 + Math.random() * 4,
        speedX: Math.cos(angle) * speed,
        speedY: Math.sin(angle) * speed,
        color: getRandomColor(),
        opacity: 0.7,
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
        size: 1 + Math.random() * 2,
        speedX: (Math.random() - 0.5) * 0.5,
        speedY: (Math.random() - 0.5) * 0.5,
        color: getRandomColor(),
        opacity: 0.3 + Math.random() * 0.3,
        life: 0,
        maxLife: 200 + Math.random() * 200
      });
    }
  };
  
  const drawParticles = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const now = Date.now();
    if (mousePos.current && now - lastTouchTime.current > 50) {
      createRipple(mousePos.current.x, mousePos.current.y, 5);
      lastTouchTime.current = now;
    }
    
    if (particles.current.length < 100) {
      createFloatingParticles(canvas, 5);
    }
    
    const liveParticles: Particle[] = [];
    
    particles.current.forEach(particle => {
      particle.life += 1;
      
      // Check if particle is still alive
      if (particle.life < particle.maxLife) {
        // Calculate fade based on life
        const fadeInPhase = Math.min(1, particle.life / 20);
        const fadeOutPhase = Math.max(0, 1 - (particle.life - (particle.maxLife * 0.7)) / (particle.maxLife * 0.3));
        particle.opacity = 0.8 * fadeInPhase * fadeOutPhase;
        
        // Move the particle
        particle.x += particle.speedX;
        particle.y += particle.speedY;
        
        // Slow down over time
        particle.speedX *= 0.99;
        particle.speedY *= 0.99;
        
        // Draw the particle
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
    
    // Set canvas size
    const updateCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    
    // Create initial floating particles
    createFloatingParticles(canvas, 100);
    
    // Track mouse/touch position
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
      createRipple(e.clientX, e.clientY, 30);
    };
    
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        createRipple(e.touches[0].clientX, e.touches[0].clientY, 30);
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('click', handleClick);
    window.addEventListener('touchstart', handleTouchStart);
    
    // Start animation loop
    animationRef.current = requestAnimationFrame(() => drawParticles(ctx, canvas));
    
    // Cleanup
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
  }, []);
  
  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full -z-10 pointer-events-none"
    />
  );
}

export default ParticleBackground;
