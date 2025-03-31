
import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  radius: number;
  color: string;
  vx: number;
  vy: number;
  alpha: number;
}

// Increase particle count and make them more visible
const PARTICLE_COUNT = 100;
const PARTICLE_MIN_RADIUS = 1.5;
const PARTICLE_MAX_RADIUS = 4;
const PARTICLE_COLOR = 'rgba(255, 255, 255, 0.7)'; // Increased opacity
const PARTICLE_SPEED = 0.7; // Slightly faster movement

const initializeParticles = (canvas: HTMLCanvasElement, particles: Particle[]) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  particles.length = 0; // Clear existing particles
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const radius = PARTICLE_MIN_RADIUS + Math.random() * (PARTICLE_MAX_RADIUS - PARTICLE_MIN_RADIUS);
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const color = PARTICLE_COLOR;
    const vx = (Math.random() - 0.5) * PARTICLE_SPEED;
    const vy = (Math.random() - 0.5) * PARTICLE_SPEED;
    const alpha = 0.7; // Increased base opacity

    particles.push({ x, y, radius, color, vx, vy, alpha });
  }
};

const animateParticles = (canvas: HTMLCanvasElement, particles: Particle[]) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  particles.forEach((particle) => {
    particle.x += particle.vx;
    particle.y += particle.vy;

    // Bounce off the walls
    if (particle.x + particle.radius > canvas.width || particle.x - particle.radius < 0) {
      particle.vx = -particle.vx;
    }
    if (particle.y + particle.radius > canvas.height || particle.y - particle.radius < 0) {
      particle.vy = -particle.vy;
    }

    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fillStyle = particle.color;
    ctx.globalAlpha = particle.alpha;
    ctx.fill();
    ctx.closePath();
  });
};

const ParticleBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const requestIdRef = useRef<number | null>(null);
  const isInitializedRef = useRef<boolean>(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    console.log("ParticleBackground mounted and canvas found");
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error("Could not get canvas context");
      return;
    }

    const resizeCanvas = () => {
      console.log("Resizing canvas to window dimensions");
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initializeParticles(canvas, particlesRef.current);
    };

    // Initial resize and particle initialization
    resizeCanvas();
    isInitializedRef.current = true;
    console.log("Particles initialized:", particlesRef.current.length);

    // Animation function
    const animate = () => {
      if (!isInitializedRef.current) return;
      animateParticles(canvas, particlesRef.current);
      requestIdRef.current = requestAnimationFrame(animate);
    };

    // Start animation
    animate();
    console.log("Animation started");

    // Handle window resize
    window.addEventListener('resize', resizeCanvas);

    // Cleanup function
    return () => {
      console.log("ParticleBackground unmounting");
      isInitializedRef.current = false;
      window.removeEventListener('resize', resizeCanvas);
      if (requestIdRef.current !== null) {
        cancelAnimationFrame(requestIdRef.current);
      }
    };
  }, []);

  // Debugging check to verify element is in DOM
  useEffect(() => {
    console.log("Canvas element:", canvasRef.current);
    if (canvasRef.current) {
      console.log("Canvas dimensions:", {
        width: canvasRef.current.width,
        height: canvasRef.current.height,
        clientWidth: canvasRef.current.clientWidth,
        clientHeight: canvasRef.current.clientHeight
      });
    }
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        zIndex: -1, 
        opacity: 1,
        backgroundColor: 'transparent'
      }}
      data-testid="particle-background"
    />
  );
}

export default ParticleBackground;
