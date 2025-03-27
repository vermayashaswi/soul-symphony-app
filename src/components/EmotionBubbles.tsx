
import React, { useEffect, useRef, useState } from 'react';
import { Engine, Render, World, Bodies, Body, Mouse, MouseConstraint, Events, Composite } from 'matter-js';

interface EmotionBubblesProps {
  emotions?: Record<string, number>;
  themes?: string[];
}

// Vibrant color mapping for emotions
const EMOTION_COLORS: Record<string, string> = {
  joy: '#4299E1',           // Bright Blue
  happiness: '#48BB78',     // Bright Green
  gratitude: '#0EA5E9',     // Ocean Blue
  calm: '#8B5CF6',          // Vivid Purple
  anxiety: '#F56565',       // Bright Red
  sadness: '#3B82F6',       // Bright Blue
  anger: '#F97316',         // Bright Orange
  fear: '#EF4444',          // Bright Red
  excitement: '#FBBF24',    // Vibrant Yellow
  love: '#EC4899',          // Magenta Pink
  stress: '#F97316',        // Bright Orange
  surprise: '#F59E0B',      // Amber
  confusion: '#8B5CF6',     // Vivid Purple
  disappointment: '#6366F1', // Indigo
  pride: '#3B82F6',         // Blue
  shame: '#DC2626',         // Red
  guilt: '#B45309',         // Amber
  hope: '#2563EB',          // Blue
  boredom: '#4B5563',       // Gray
  disgust: '#65A30D',       // Lime
  contentment: '#0D9488'    // Teal
};

// Get color for an emotion, with fallback
const getEmotionColor = (emotion: string): string => {
  const normalized = emotion.toLowerCase();
  return EMOTION_COLORS[normalized] || '#A3A3A3';
};

const EmotionBubbles: React.FC<EmotionBubblesProps> = ({ emotions = {}, themes = [] }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const renderRef = useRef<Matter.Render | null>(null);
  const mouseConstraintRef = useRef<Matter.MouseConstraint | null>(null);
  const bodiesRef = useRef<Map<string, Matter.Body>>(new Map());
  const worldBoundaries = useRef<Matter.Body[]>([]);
  
  // Track resize observer
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Initialize physics engine
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;
    
    // Get the initial container size
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    setContainerSize({ width: containerWidth, height: containerHeight });
    
    // Create engine
    const engine = Engine.create({
      gravity: { x: 0, y: 0 }, // No gravity
      positionIterations: 6,
      velocityIterations: 4,
    });
    engineRef.current = engine;
    
    // Create renderer
    const render = Render.create({
      canvas: canvasRef.current,
      engine: engine,
      options: {
        width: containerWidth,
        height: containerHeight,
        wireframes: false,
        background: 'transparent',
        pixelRatio: window.devicePixelRatio || 1,
      },
    });
    renderRef.current = render;
    
    // Add mouse control
    const mouse = Mouse.create(render.canvas);
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse: mouse,
      constraint: {
        stiffness: 0.2,
        render: { visible: false }
      }
    });
    mouseConstraintRef.current = mouseConstraint;

    // Adjust mouse position calculation - fix TypeScript errors
    // Use type assertion to access the event handlers that exist at runtime but not in types
    const mouseAny = mouse as any;
    if (mouseAny.element && mouseAny.mousewheel) {
      mouseAny.element.removeEventListener('mousewheel', mouseAny.mousewheel);
      mouseAny.element.removeEventListener('DOMMouseScroll', mouseAny.mousewheel);
    }
    
    if (mouseAny.element && mouseAny.touchstart) {
      mouseAny.element.removeEventListener('touchstart', mouseAny.touchstart);
      mouseAny.element.removeEventListener('touchmove', mouseAny.touchmove);
      mouseAny.element.removeEventListener('touchend', mouseAny.touchend);
    }
    
    // Add custom touch events to properly calculate the position
    mouse.element.addEventListener('touchstart', (event) => {
      const rect = mouse.element.getBoundingClientRect();
      const touch = event.touches[0];
      
      // Adjust touch position to be relative to canvas
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      
      mouse.position.x = x;
      mouse.position.y = y;
      
      // Use type assertion to set mousedown property
      (mouse as any).mousedown = true;
      
      event.preventDefault();
    }, { passive: false });
    
    mouse.element.addEventListener('touchmove', (event) => {
      const rect = mouse.element.getBoundingClientRect();
      const touch = event.touches[0];
      
      // Adjust touch position to be relative to canvas
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      
      mouse.position.x = x;
      mouse.position.y = y;
      
      event.preventDefault();
    }, { passive: false });
    
    mouse.element.addEventListener('touchend', () => {
      // Use type assertion to set mousedown property
      (mouse as any).mousedown = false;
    }, { passive: false });
    
    // Create world boundaries (invisible walls) with sufficient padding
    // Increase padding to ensure bubbles don't touch the visible edge
    const padding = 15; // Increased padding to keep bubbles away from edges
    const wallThickness = 50; // Thick enough to prevent bubbles from escaping
    
    // Create invisible walls around the container
    const topWall = Bodies.rectangle(
      containerWidth / 2, // x position
      -wallThickness / 2 + padding, // y position (half above the container)
      containerWidth, // width
      wallThickness, // height
      { isStatic: true, render: { visible: false }, friction: 0.1, restitution: 0.7 }
    );
    
    const bottomWall = Bodies.rectangle(
      containerWidth / 2,
      containerHeight + wallThickness / 2 - padding,
      containerWidth,
      wallThickness,
      { isStatic: true, render: { visible: false }, friction: 0.1, restitution: 0.7 }
    );
    
    const leftWall = Bodies.rectangle(
      -wallThickness / 2 + padding,
      containerHeight / 2,
      wallThickness,
      containerHeight,
      { isStatic: true, render: { visible: false }, friction: 0.1, restitution: 0.7 }
    );
    
    const rightWall = Bodies.rectangle(
      containerWidth + wallThickness / 2 - padding,
      containerHeight / 2,
      wallThickness,
      containerHeight,
      { isStatic: true, render: { visible: false }, friction: 0.1, restitution: 0.7 }
    );
    
    worldBoundaries.current = [topWall, bottomWall, leftWall, rightWall];
    
    // Add boundaries to the world
    World.add(engine.world, [
      topWall, 
      bottomWall, 
      leftWall, 
      rightWall,
      mouseConstraint
    ]);
    
    // Start the engine and renderer
    Engine.run(engine);
    Render.run(render);
    
    // Create resize observer to handle window resizing
    const resizeObserver = new ResizeObserver(() => {
      if (!containerRef.current || !renderRef.current || !engineRef.current) return;
      
      const newWidth = containerRef.current.clientWidth;
      const newHeight = containerRef.current.clientHeight;
      
      // Update container size state
      setContainerSize({ width: newWidth, height: newHeight });
      
      // Resize the renderer - fix TypeScript error
      Render.setPixelRatio(renderRef.current, window.devicePixelRatio || 1);
      
      // Use type assertion for setSize method that exists at runtime but not in types
      const renderAny = Render as any;
      if (renderAny.setSize && renderRef.current) {
        renderAny.setSize(renderRef.current, newWidth, newHeight);
      } else {
        // Fallback: manually adjust canvas dimensions
        if (renderRef.current.canvas) {
          renderRef.current.canvas.width = newWidth;
          renderRef.current.canvas.height = newHeight;
          renderRef.current.options.width = newWidth;
          renderRef.current.options.height = newHeight;
        }
      }
      
      // Update wall positions
      const [topWall, bottomWall, leftWall, rightWall] = worldBoundaries.current;
      
      Body.setPosition(topWall, { x: newWidth / 2, y: -wallThickness / 2 + padding });
      Body.setPosition(bottomWall, { x: newWidth / 2, y: newHeight + wallThickness / 2 - padding });
      Body.setPosition(leftWall, { x: -wallThickness / 2 + padding, y: newHeight / 2 });
      Body.setPosition(rightWall, { x: newWidth + wallThickness / 2 - padding, y: newHeight / 2 });
      
      // Update wall sizes
      Body.setVertices(topWall, Bodies.rectangle(newWidth / 2, -wallThickness / 2 + padding, newWidth, wallThickness, { isStatic: true }).vertices);
      Body.setVertices(bottomWall, Bodies.rectangle(newWidth / 2, newHeight + wallThickness / 2 - padding, newWidth, wallThickness, { isStatic: true }).vertices);
      Body.setVertices(leftWall, Bodies.rectangle(-wallThickness / 2 + padding, newHeight / 2, wallThickness, newHeight, { isStatic: true }).vertices);
      Body.setVertices(rightWall, Bodies.rectangle(newWidth + wallThickness / 2 - padding, newHeight / 2, wallThickness, newHeight, { isStatic: true }).vertices);
    });
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
      resizeObserverRef.current = resizeObserver;
    }
    
    // Cleanup function
    return () => {
      if (resizeObserverRef.current && containerRef.current) {
        resizeObserverRef.current.unobserve(containerRef.current);
      }
      
      if (renderRef.current) {
        Render.stop(renderRef.current);
        renderRef.current.canvas.remove();
        renderRef.current = null;
      }
      
      if (engineRef.current) {
        World.clear(engineRef.current.world, false);
        Engine.clear(engineRef.current);
        engineRef.current = null;
      }
    };
  }, []);
  
  // Update bubbles when emotions or themes change
  useEffect(() => {
    if (!engineRef.current || !containerRef.current) return;
    
    // Clear existing bubbles first
    const existingBodies = Array.from(bodiesRef.current.values());
    if (existingBodies.length > 0) {
      World.remove(engineRef.current.world, existingBodies);
      bodiesRef.current.clear();
    }
    
    // Determine data source
    const usingEmotions = Object.keys(emotions).length > 0;
    const dataSource = usingEmotions 
      ? Object.entries(emotions).map(([key, value]) => ({ label: key, value }))
      : themes.map(theme => ({ label: theme, value: 1 }));
    
    // Find max value for scaling
    const maxValue = usingEmotions 
      ? Math.max(...Object.values(emotions))
      : 1;
    
    // Calculate available space
    const containerWidth = containerSize.width;
    const containerHeight = containerSize.height;
    
    // Add padding to ensure bubbles don't touch edges
    const safetyPadding = 25; // Increased safety padding for bubble positions
    
    // Calculate the usable area with padding
    const usableWidth = containerWidth - (safetyPadding * 2);
    const usableHeight = containerHeight - (safetyPadding * 2);
    
    // Make bubbles slightly smaller to ensure they fit within the container
    const maxSize = Math.min(usableWidth, usableHeight) * 0.25; // Reduced max size from 30% to 25%
    const minSize = Math.max(30, maxSize * 0.2); // Min bubble size with a minimum of 30px
    
    // Calculate positions to avoid overlaps
    const bubbles: Array<{ x: number, y: number, radius: number, label: string, color: string }> = [];
    
    // First sort by value to place larger bubbles first
    const sortedData = [...dataSource].sort((a, b) => (b.value || 0) - (a.value || 0));
    
    // Process each emotion/theme
    for (const item of sortedData) {
      // Use score to determine size, with a minimum size
      const score = usingEmotions ? item.value : 1;
      const radius = minSize + ((score / maxValue) * (maxSize - minSize)) / 2;
      
      // Make sure the radius isn't too large for the container
      const effectiveRadius = Math.min(radius, Math.min(usableWidth, usableHeight) / 3);
      
      // Try to find a suitable position
      let attempts = 0;
      let validPosition = false;
      let x = 0, y = 0;
      
      // Keep trying positions until we find one that doesn't overlap
      while (!validPosition && attempts < 50) {
        // Generate a position that ensures the bubble is fully within the usable area
        x = safetyPadding + effectiveRadius + Math.random() * (usableWidth - 2 * effectiveRadius);
        y = safetyPadding + effectiveRadius + Math.random() * (usableHeight - 2 * effectiveRadius);
        
        // Check for overlaps with existing bubbles
        validPosition = true;
        for (const bubble of bubbles) {
          const dx = x - bubble.x;
          const dy = y - bubble.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // If bubbles touch or overlap, position is invalid
          if (distance < effectiveRadius + bubble.radius + 5) { // Add a small gap between bubbles
            validPosition = false;
            break;
          }
        }
        
        attempts++;
      }
      
      // If we couldn't find a non-overlapping position, place it anyway (will adjust with physics)
      if (!validPosition) {
        x = containerWidth / 2;
        y = containerHeight / 2;
      }
      
      // Get color based on emotion label
      const color = getEmotionColor(item.label);
      
      // Store bubble data
      bubbles.push({ x, y, radius: effectiveRadius, label: item.label, color });
    }
    
    // Create Matter.js bodies for each bubble
    bubbles.forEach(bubble => {
      // Create a circular body
      const body = Bodies.circle(bubble.x, bubble.y, bubble.radius, {
        restitution: 0.9, // Bounciness
        friction: 0.001, // Low friction
        frictionAir: 0.02, // Air resistance
        frictionStatic: 0.1, // Low static friction
        density: 0.02, // Low density to make bubbles feel light
        // Custom render with label
        render: {
          fillStyle: bubble.color,
          strokeStyle: 'rgba(255, 255, 255, 0.3)',
          lineWidth: 1,
        },
        // Store label for reference
        label: bubble.label
      });
      
      // Add to world
      World.add(engineRef.current!.world, body);
      
      // Store reference
      bodiesRef.current.set(bubble.label, body);
    });
    
    // Render text labels for each bubble after physics bodies are added
    const renderLabels = () => {
      const context = canvasRef.current?.getContext('2d');
      if (!context || !canvasRef.current) return;
      
      // Clear any existing text (this is handled by Matter.js render)
      
      // Draw text on each bubble
      for (const [label, body] of bodiesRef.current.entries()) {
        const { x, y } = body.position;
        const radius = body.circleRadius as number;
        
        // Setup text style
        context.font = `bold ${Math.max(12, radius * 0.5)}px sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = 'white';
        
        // Capitalize first letter
        const displayLabel = label.charAt(0).toUpperCase() + label.slice(1);
        
        // Draw text
        context.fillText(displayLabel, x, y);
      }
    };
    
    // Add after update event listener to draw labels
    const afterUpdateEvent = () => {
      if (renderRef.current) {
        renderLabels();
      }
    };
    
    Events.on(renderRef.current!, 'afterRender', afterUpdateEvent);
    
    // Clean up event listener
    return () => {
      if (renderRef.current) {
        Events.off(renderRef.current, 'afterRender', afterUpdateEvent);
      }
    };
  }, [emotions, themes, containerSize]);
  
  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full rounded-lg overflow-hidden"
      style={{ padding: '10px' }} // Add padding to the container
    >
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className="absolute top-2 right-2 text-xs text-muted-foreground">
        * Size of bubble represents intensity
      </div>
    </div>
  );
};

export default EmotionBubbles;
