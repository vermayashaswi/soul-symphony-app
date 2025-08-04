import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLocation } from 'react-router-dom';
import Matter, { 
  Engine, 
  Render, 
  World, 
  Bodies, 
  Mouse, 
  MouseConstraint,
  Body,
  Composite,
  Events,
  Runner,
  Vector
} from 'matter-js';
import EmotionBubbleDetail from './EmotionBubbleDetail';
import { useToast } from '@/hooks/use-toast';

interface EmotionBubblesProps {
  emotions?: Record<string, number>;
  themes?: string[];
  className?: string;
  onEmotionClick?: (emotion: string) => void;
  preventOverlap?: boolean;
  isDisturbed?: boolean;
}

const EmotionBubbles: React.FC<EmotionBubblesProps> = ({ 
  emotions, 
  themes, 
  className,
  onEmotionClick,
  preventOverlap = true,
  isDisturbed = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const renderRef = useRef<Matter.Render | null>(null);
  const worldRef = useRef<Matter.World | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const bubblesRef = useRef<{
    body: Matter.Body;
    name: string;
    size: number;
    color: string;
    value?: number;
    percentage?: number;
  }[]>([]);
  const mouseConstraintRef = useRef<Matter.MouseConstraint | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastDisturbTimeRef = useRef<number>(0);
  
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [items, setItems] = useState<Array<{ 
    name: string; 
    size: number; 
    color: string; 
    position: { x: number; y: number };
    value?: number;
    percentage?: number;
  }>>([]);
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
  const [physicsInitialized, setPhysicsInitialized] = useState(false);
  const [isCurrentlyDisturbed, setIsCurrentlyDisturbed] = useState(false);
  const [draggingBubble, setDraggingBubble] = useState<string | null>(null);
  
  const location = useLocation();
  const isInsightsPage = location.pathname.includes('insights');
  const isJournalPage = location.pathname.includes('journal');
  const { toast } = useToast();
  
  const colorPalette = [
    'bg-blue-100 text-blue-800', 
    'bg-green-100 text-green-800',
    'bg-yellow-100 text-yellow-800',
    'bg-purple-100 text-purple-800',
    'bg-pink-100 text-pink-800',
    'bg-indigo-100 text-indigo-800',
    'bg-red-100 text-red-800',
    'bg-orange-100 text-orange-800',
    'bg-teal-100 text-teal-800',
  ];

  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };

    updateSize();
    
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(containerRef.current);
    
    return () => {
      if (containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isDisturbed) {
      setIsCurrentlyDisturbed(true);
      lastDisturbTimeRef.current = Date.now();
      
      if (bubblesRef.current.length > 0) {
        bubblesRef.current.forEach(bubble => {
          const forceX = (Math.random() - 0.5) * 0.02; // Increased force
          const forceY = (Math.random() - 0.5) * 0.02; // Increased force
          Body.applyForce(bubble.body, bubble.body.position, { x: forceX, y: forceY });
        });
      }
      
      setTimeout(() => {
        setIsCurrentlyDisturbed(false);
      }, 3000);
    }
  }, [isDisturbed]);

  const handleEmotionClick = (emotion: string) => {
    if (emotion === '•' || !emotion) return;
    
    const selectedBubbleData = items.find(item => item.name === emotion);
    
    setSelectedEmotion(selectedBubbleData ? 
      String(selectedBubbleData.percentage?.toFixed(1)) : 
      null
    );
    
    // Reset after 2 seconds
    setTimeout(() => {
      setSelectedEmotion(null);
    }, 2000);
    
    if (onEmotionClick) {
      onEmotionClick(emotion);
    }
  };

  const applyRandomForces = () => {
    if (!engineRef.current || !bubblesRef.current.length) return;
    
    const now = Date.now();
    const forceFactor = isCurrentlyDisturbed ? 0.008 : 0.002; // Increased force factor
    const timeSinceLastDisturb = now - lastDisturbTimeRef.current;
    const disturbanceFadeFactor = Math.max(0, Math.min(1, 1 - (timeSinceLastDisturb / 3000)));
    
    bubblesRef.current.forEach((bubble) => {
      if (Math.random() > 0.90) {
        const randomFactor = isCurrentlyDisturbed ? 0.5 : 0.2;
        const forceX = (Math.random() - 0.5) * forceFactor * (1 + disturbanceFadeFactor * 5);
        const forceY = (Math.random() - 0.5) * forceFactor * (1 + disturbanceFadeFactor * 5);
        Body.applyForce(bubble.body, bubble.body.position, { x: forceX, y: forceY });
      }
      
      const pos = bubble.body.position;
      const radius = bubble.size / 2;
      const bounds = {
        min: { x: radius, y: radius },
        max: { x: containerSize.width - radius, y: containerSize.height - radius }
      };
      
      if (pos.x < bounds.min.x + 10) {
        Body.applyForce(bubble.body, pos, { x: 0.001, y: 0 });
      } else if (pos.x > bounds.max.x - 10) {
        Body.applyForce(bubble.body, pos, { x: -0.001, y: 0 });
      }
      
      if (pos.y < bounds.min.y + 10) {
        Body.applyForce(bubble.body, pos, { x: 0, y: 0.001 });
      } else if (pos.y > bounds.max.y - 10) {
        Body.applyForce(bubble.body, pos, { x: 0, y: -0.001 });
      }
      
      if (Math.random() > 0.95) {
        const tinyForceX = (Math.random() - 0.5) * 0.0008;
        const tinyForceY = (Math.random() - 0.5) * 0.0008;
        Body.applyForce(bubble.body, pos, { x: tinyForceX, y: tinyForceY });
      }
    });
    
    animationFrameRef.current = requestAnimationFrame(applyRandomForces);
  };

  useEffect(() => {
    if ((isInsightsPage || isJournalPage) && containerSize.width > 0 && containerSize.height > 0 && canvasRef.current) {
      // Clean up previous physics engine if it exists
      if (engineRef.current) {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        
        if (runnerRef.current) {
          Runner.stop(runnerRef.current);
        }
        
        World.clear(engineRef.current.world, false);
        Engine.clear(engineRef.current);
        
        if (renderRef.current && renderRef.current.canvas) {
          Render.stop(renderRef.current);
          renderRef.current.canvas.remove();
        }
      }
      
      // Create engine with zero gravity
      const engine = Engine.create({
        enableSleeping: false,
        gravity: { x: 0, y: 0, scale: 0 }
      });
      
      // Increase collision iterations for better separation
      engine.constraintIterations = 6;
      engine.positionIterations = 6;
      engine.velocityIterations = 6;
      
      engineRef.current = engine;
      worldRef.current = engine.world;
      
      // Create renderer
      const render = Render.create({
        canvas: canvasRef.current,
        engine: engine,
        options: {
          width: containerSize.width,
          height: containerSize.height,
          wireframes: false,
          background: 'transparent',
        }
      });
      renderRef.current = render;
      
      // Create boundaries
      const wallThickness = 50;
      const walls = [
        Bodies.rectangle(
          containerSize.width / 2, 
          containerSize.height + wallThickness / 2, 
          containerSize.width + 100, 
          wallThickness, 
          { isStatic: true, render: { visible: false }, friction: 0.2, restitution: 0.8 }
        ),
        Bodies.rectangle(
          containerSize.width / 2, 
          -wallThickness / 2, 
          containerSize.width + 100, 
          wallThickness, 
          { isStatic: true, render: { visible: false }, friction: 0.2, restitution: 0.8 }
        ),
        Bodies.rectangle(
          -wallThickness / 2, 
          containerSize.height / 2, 
          wallThickness, 
          containerSize.height + 100, 
          { isStatic: true, render: { visible: false }, friction: 0.2, restitution: 0.8 }
        ),
        Bodies.rectangle(
          containerSize.width + wallThickness / 2, 
          containerSize.height / 2, 
          wallThickness, 
          containerSize.height + 100, 
          { isStatic: true, render: { visible: false }, friction: 0.2, restitution: 0.8 }
        ),
      ];
      
      World.add(engine.world, walls);
      
      let bubbleBodies: {
        body: Matter.Body;
        name: string;
        size: number;
        color: string;
        value?: number;
        percentage?: number;
      }[] = [];
      
      if (items.length > 0) {
        bubbleBodies = items.map((item) => {
          // Improved physics parameters for more dynamic movement
          const friction = 0.01 + Math.random() * 0.02;
          const frictionAir = 0.02 + Math.random() * 0.03; // Reduced air friction for better sliding
          const restitution = 0.7 + Math.random() * 0.25; // Increased bounciness
          
          const body = Bodies.circle(
            item.position.x,
            item.position.y,
            item.size / 2,
            {
              restitution: restitution,
              friction: friction,
              frictionAir: frictionAir,
              render: {
                fillStyle: 'transparent',
                strokeStyle: 'transparent',
                lineWidth: 0
              },
              density: 0.001 * (1 + Math.random() * 0.2),
              label: item.name, // Add label for identification
              collisionFilter: {
                group: 0,
                category: 0x0002,
                mask: 0xFFFFFFFF
              }
            }
          );
          
          return {
            body,
            name: item.name,
            size: item.size,
            color: item.color,
            value: item.value,
            percentage: item.percentage
          };
        });
        
        World.add(engine.world, bubbleBodies.map(b => b.body));
        bubblesRef.current = bubbleBodies;
      }
      
      // Create and configure mouse constraint for desktop interaction
      const mouse = Mouse.create(canvasRef.current);
      const mouseConstraint = MouseConstraint.create(engine, {
        mouse: mouse,
        constraint: {
          stiffness: 0.1, // Lower stiffness for more natural dragging
          damping: 0.1,   // Lower damping for more momentum
          render: {
            visible: false
          }
        }
      });
      
      // Enhanced drag events for better interaction
      let isDragging = false;
      let draggedBody: Matter.Body | null = null;
      let dragStartTime = 0;
      let previousPosition = { x: 0, y: 0 };
      let lastDragTime = 0;
      let velocity = { x: 0, y: 0 };
      
      // Variables for touch interaction
      let touchId: number | null = null;
      
      // Function to find bubble at position
      const findBubbleAtPosition = (position: { x: number, y: number }) => {
        return bubblesRef.current.find(bubble => {
          const distance = Vector.magnitude(
            Vector.sub(bubble.body.position, position)
          );
          return distance <= bubble.size / 2;
        });
      };
      
      // Mouse events for desktop
      Events.on(mouseConstraint, 'mousedown', (event) => {
        const mousePosition = mouseConstraint.mouse.position;
        const foundBody = findBubbleAtPosition(mousePosition);
        
        if (foundBody) {
          draggedBody = foundBody.body;
          setDraggingBubble(foundBody.name);
          isDragging = true;
          dragStartTime = Date.now();
          previousPosition = { ...mousePosition };
          setIsCurrentlyDisturbed(true);
        }
      });

      Events.on(mouseConstraint, 'mousemove', (event) => {
        if (isDragging && draggedBody) {
          const now = Date.now();
          const dt = now - lastDragTime;
          
          if (dt > 0) {
            const currentPosition = mouseConstraint.mouse.position;
            velocity = {
              x: (currentPosition.x - previousPosition.x) / dt * 15, // Scale velocity
              y: (currentPosition.y - previousPosition.y) / dt * 15
            };
            previousPosition = { ...currentPosition };
            lastDragTime = now;
          }
        }
      });

      Events.on(mouseConstraint, 'mouseup', () => {
        if (isDragging && draggedBody) {
          isDragging = false;
          
          // Apply velocity on release for throwing effect
          Body.setVelocity(draggedBody, velocity);
          
          // Apply an additional impulse in the direction of movement
          const impulseMultiplier = 0.005;
          Body.applyForce(
            draggedBody,
            draggedBody.position,
            {
              x: velocity.x * impulseMultiplier,
              y: velocity.y * impulseMultiplier
            }
          );
          
          draggedBody = null;
          setDraggingBubble(null);
          
          // Disturb other bubbles
          bubblesRef.current.forEach(bubble => {
            if (bubble.body !== draggedBody) {
              const forceX = (Math.random() - 0.5) * 0.002;
              const forceY = (Math.random() - 0.5) * 0.002;
              Body.applyForce(bubble.body, bubble.body.position, { x: forceX, y: forceY });
            }
          });
          
          setTimeout(() => {
            setIsCurrentlyDisturbed(false);
          }, 3000);
        }
      });
      
      // Handle click events for desktop
      Events.on(mouseConstraint, 'click', (event) => {
        const clickTime = Date.now();
        // Only count as click if it's a short interaction
        if (dragStartTime && clickTime - dragStartTime < 200) {
          const mousePosition = mouseConstraint.mouse.position;
          
          bubblesRef.current.forEach(bubble => {
            const distance = Vector.magnitude(
              Vector.sub(bubble.body.position, mousePosition)
            );
            
            if (distance <= bubble.size / 2) {
              handleEmotionClick(bubble.name);
            }
          });
        }
      });
      
      // ===== TOUCH INTERACTION HANDLERS =====
      if (canvasRef.current) {
        // Touch start - similar to mousedown
        canvasRef.current.addEventListener('touchstart', (e) => {
          if (e.touches.length > 0 && touchId === null) {
            e.preventDefault(); // Prevent scrolling
            
            const touch = e.touches[0];
            touchId = touch.identifier;
            
            // Convert touch coordinates to canvas coordinates
            const canvasRect = canvasRef.current!.getBoundingClientRect();
            const touchPosition = {
              x: touch.clientX - canvasRect.left,
              y: touch.clientY - canvasRect.top
            };
            
            const foundBody = findBubbleAtPosition(touchPosition);
            
            if (foundBody) {
              draggedBody = foundBody.body;
              setDraggingBubble(foundBody.name);
              isDragging = true;
              dragStartTime = Date.now();
              previousPosition = { ...touchPosition };
              lastDragTime = Date.now();
              setIsCurrentlyDisturbed(true);
              
              // Move the body to the touch position
              Body.setPosition(draggedBody, touchPosition);
            }
          }
        }, { passive: false });
        
        // Touch move - similar to mousemove
        canvasRef.current.addEventListener('touchmove', (e) => {
          if (isDragging && draggedBody && touchId !== null) {
            e.preventDefault(); // Prevent scrolling
            
            // Find the touch with the correct identifier
            const touchList = Array.from(e.touches);
            const touch = touchList.find(t => t.identifier === touchId);
            
            if (touch) {
              const now = Date.now();
              const dt = now - lastDragTime;
              
              // Convert touch coordinates to canvas coordinates
              const canvasRect = canvasRef.current!.getBoundingClientRect();
              const currentPosition = {
                x: touch.clientX - canvasRect.left,
                y: touch.clientY - canvasRect.top
              };
              
              // Move the body directly to follow the finger precisely on touch devices
              Body.setPosition(draggedBody, currentPosition);
              
              if (dt > 0) {
                velocity = {
                  x: (currentPosition.x - previousPosition.x) / dt * 15,
                  y: (currentPosition.y - previousPosition.y) / dt * 15
                };
                previousPosition = { ...currentPosition };
                lastDragTime = now;
              }
            }
          }
        }, { passive: false });
        
        // Touch end & cancel - similar to mouseup
        const handleTouchEnd = (e: TouchEvent) => {
          if (isDragging && draggedBody && touchId !== null) {
            // Check if our touch has ended
            const isOurTouchEnded = Array.from(e.changedTouches).some(
              t => t.identifier === touchId
            );
            
            if (isOurTouchEnded) {
              e.preventDefault(); // Prevent any default behavior
              
              isDragging = false;
              touchId = null;
              
              // Apply velocity for throwing effect
              Body.setVelocity(draggedBody, velocity);
              
              // Apply additional impulse for more realistic physics
              const impulseMultiplier = 0.005;
              Body.applyForce(
                draggedBody,
                draggedBody.position,
                {
                  x: velocity.x * impulseMultiplier,
                  y: velocity.y * impulseMultiplier
                }
              );
              
              // Check if this was a tap/click (short duration interaction)
              const touchEndTime = Date.now();
              if (touchEndTime - dragStartTime < 200 && 
                  Math.abs(velocity.x) < 5 && 
                  Math.abs(velocity.y) < 5) {
                handleEmotionClick(draggedBody.label as string);
              }
              
              // Apply random forces to other bubbles for interactive feel
              bubblesRef.current.forEach(bubble => {
                if (bubble.body !== draggedBody) {
                  const forceX = (Math.random() - 0.5) * 0.002;
                  const forceY = (Math.random() - 0.5) * 0.002;
                  Body.applyForce(bubble.body, bubble.body.position, { x: forceX, y: forceY });
                }
              });
              
              draggedBody = null;
              setDraggingBubble(null);
              
              setTimeout(() => {
                setIsCurrentlyDisturbed(false);
              }, 3000);
            }
          }
        };
        
        canvasRef.current.addEventListener('touchend', handleTouchEnd, { passive: false });
        canvasRef.current.addEventListener('touchcancel', handleTouchEnd, { passive: false });
      }
      
      World.add(engine.world, mouseConstraint);
      mouseConstraintRef.current = mouseConstraint;
      render.mouse = mouse;
      
      // Run the engine with higher speed for more dynamic simulation
      const runner = Runner.create({
        isFixed: true,
        delta: 1000 / 60, // Lock at 60 FPS for consistent physics
      });
      Runner.run(runner, engine);
      runnerRef.current = runner;
      
      Render.run(render);
      
      // Start applying small random forces to keep bubbles moving
      animationFrameRef.current = requestAnimationFrame(applyRandomForces);
      
      setPhysicsInitialized(true);
      
      return () => {
        // Clean up all event listeners for touch events
        if (canvasRef.current) {
          canvasRef.current.removeEventListener('touchstart', () => {});
          canvasRef.current.removeEventListener('touchmove', () => {});
          canvasRef.current.removeEventListener('touchend', () => {});
          canvasRef.current.removeEventListener('touchcancel', () => {});
        }
        
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        
        if (runnerRef.current) {
          Runner.stop(runnerRef.current);
        }
        
        if (engineRef.current) {
          World.clear(engineRef.current.world, false);
          Engine.clear(engineRef.current);
        }
        
        if (renderRef.current) {
          Render.stop(renderRef.current);
          if (renderRef.current.canvas) {
            renderRef.current.canvas.remove();
          }
        }
        
        bubblesRef.current = [];
        setPhysicsInitialized(false);
      };
    }
  }, [isInsightsPage, isJournalPage, containerSize, items]);

  useEffect(() => {
    if ((isInsightsPage || isJournalPage) && bubblesRef.current.length > 0 && items.length > 0) {
      bubblesRef.current.forEach((bubble, index) => {
        if (index < items.length) {
          // Initialize positions when items change
          Body.setPosition(bubble.body, {
            x: items[index].position.x,
            y: items[index].position.y
          });
          
          // Add slight initial velocities for more life-like behavior
          Body.setVelocity(bubble.body, {
            x: (Math.random() - 0.5) * 1,
            y: (Math.random() - 0.5) * 1
          });
        }
      });
    }
  }, [isInsightsPage, isJournalPage, items]);

  useEffect(() => {
    if (containerSize.width === 0 || containerSize.height === 0) return;
    
    const padding = Math.min(containerSize.width, containerSize.height) * 0.10;
    const availableWidth = containerSize.width - padding * 2;
    const availableHeight = containerSize.height - padding * 2;
    
    let newItems: Array<{ 
      name: string; 
      size: number; 
      color: string; 
      position: { x: number; y: number };
      value?: number;
      percentage?: number;
    }> = [];
    
    const calculateMinBubbleSize = (text: string): number => {
      const textLength = text.length;
      
      if (textLength <= 5) {
        return Math.min(availableWidth, availableHeight) * 0.18; // Reduced sizes for better physics
      } else if (textLength <= 10) {
        return Math.min(availableWidth, availableHeight) * 0.24;
      } else if (textLength <= 15) {
        return Math.min(availableWidth, availableHeight) * 0.28;
      } else {
        return Math.min(availableWidth, availableHeight) * 0.32;
      }
    };
    
    if (emotions && Object.keys(emotions).length > 0) {
      // Filter out any invalid or empty emotions
      const filteredEmotions = Object.entries(emotions).filter(([emotion, value]) => 
        emotion && emotion.trim() !== '' && emotion !== '•' && value > 0
      );
      
      if (filteredEmotions.length === 0) return;
      
      // Fixed: Correct the reduce function to properly handle [string, number] tuples
      const totalValue = filteredEmotions.reduce((sum, [value]) => sum + Number(value), 0);
      
      const values = filteredEmotions.map(([_, value]) => value);
      const maxValue = Math.max(...values);
      const minValue = Math.min(...values);
      const valueRange = maxValue - minValue;
      
      const totalArea = availableWidth * availableHeight * 0.7;
      const itemCount = filteredEmotions.length;
      
      const baseMinSizes = filteredEmotions.map(([emotion, _]) => ({
        emotion,
        minSize: calculateMinBubbleSize(emotion)
      }));
      
      const maxBubbleSize = Math.min(
        Math.min(availableWidth, availableHeight) * 0.32, // Reduced for better physics
        Math.sqrt((totalArea) / (itemCount * Math.PI)) * 1.3
      );
      
      newItems = filteredEmotions.map(([emotion, value], index) => {
        const minSize = baseMinSizes.find(item => item.emotion === emotion)?.minSize || 
                       Math.min(availableWidth, availableHeight) * 0.18;
        
        let size;
        if (valueRange === 0) {
          size = minSize;
        } else {
          const normalizedValue = (value - minValue) / valueRange;
          size = minSize + (normalizedValue * (maxBubbleSize - minSize) * 0.8);
        }
        
        // Fixed: Ensure value is treated as a number for calculation
        const percentage = (Number(value) / totalValue) * 100;
        
        return {
          name: emotion,
          size,
          color: colorPalette[index % colorPalette.length],
          position: { x: 0, y: 0 },
          value,
          percentage
        };
      });
      
      // Sort by size (value) for better visualization
      newItems.sort((a, b) => (b.value || 0) - (a.value || 0));
    } else if (themes && themes.length > 0) {
      // Filter out any empty themes
      const filteredThemes = themes.filter(theme => theme && theme.trim() !== '' && theme !== '•');
      
      if (filteredThemes.length === 0) return;
      
      const itemCount = filteredThemes.length;
      
      const bubbleSize = Math.min(
        Math.min(availableWidth, availableHeight) * 0.25,
        Math.sqrt((availableWidth * availableHeight * 0.8) / itemCount) * 1.2
      );
      
      newItems = filteredThemes.map((theme, index) => {
        // Calculate equal percentages for themes
        const percentage = 100 / filteredThemes.length;
        
        return {
          name: theme,
          size: bubbleSize,
          color: colorPalette[index % colorPalette.length],
          position: { x: 0, y: 0 },
          value: 1,
          percentage
        };
      });
    }
    
    if (newItems.length > 0) {
      // Position items using a spiral pattern for better initial placement
      const spiralPositioning = (items: typeof newItems) => {
        const centerX = availableWidth / 2;
        const centerY = availableHeight / 2;
        const a = Math.min(availableWidth, availableHeight) * 0.15; // Controls spiral spread
        const b = 0.5; // Controls spiral tightness
        
        return items.map((item, i) => {
          const angle = b * i;
          const x = centerX + a * angle * Math.cos(angle);
          const y = centerY + a * angle * Math.sin(angle);
          
          // Add slight randomness to prevent perfect symmetry
          const randomOffset = Math.min(availableWidth, availableHeight) * 0.01;
          const randomX = (Math.random() - 0.5) * randomOffset;
          const randomY = (Math.random() - 0.5) * randomOffset;
          
          const safeBubblePlacement = (pos: {x: number, y: number}, size: number) => {
            const halfSize = size / 2;
            const minX = padding + halfSize + 5;
            const maxX = padding + availableWidth - halfSize - 5;
            const minY = padding + halfSize + 5;
            const maxY = padding + availableHeight - halfSize - 5;
            
            return {
              x: Math.min(maxX, Math.max(minX, pos.x + randomX)),
              y: Math.min(maxY, Math.max(minY, pos.y + randomY))
            };
          };
          
          return {
            ...item,
            position: safeBubblePlacement({x: padding + x, y: padding + y}, item.size)
          };
        });
      };
      
      newItems = spiralPositioning(newItems);
    }
    
    setItems(newItems);
  }, [containerSize, emotions, themes, preventOverlap]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.3
      }
    }
  };

  const bubbleVariants = {
    hidden: { 
      opacity: 0, 
      scale: 0,
      x: containerSize.width / 2,
      y: containerSize.height / 2
    },
    show: {
      opacity: 1, 
      scale: 1,
      transition: { 
        type: "spring" as const,
        damping: 12,
        stiffness: 100,
        duration: 0.8
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0,
      x: containerSize.width / 2,
      y: containerSize.height / 2,
      transition: { duration: 0.5 }
    },
    hover: {
      scale: 1.05,
      transition: { duration: 0.3 }
    }
  };

  const getFloatingAnimation = (index: number) => {
    return isDisturbed ? {
      y: [0, (Math.random() - 0.5) * 30, 0, (Math.random() - 0.5) * 30, 0],
      x: [0, (Math.random() - 0.5) * 30, 0, (Math.random() - 0.5) * 30, 0],
      rotate: [0, (Math.random() - 0.5) * 40, 0, (Math.random() - 0.5) * 40, 0],
      transition: {
        duration: 3,
        ease: [0.4, 0, 0.2, 1] as const
      }
    } : {
      y: [0, -5, 0, 5, 0],
      transition: {
        duration: 3 + Math.random() * 2,
        repeat: Infinity,
        ease: [0.4, 0, 0.2, 1] as const,
        delay: index * 0.1
      }
    };
  };

  return (
    <div 
      ref={containerRef} 
      className={cn(
        "relative w-full h-full overflow-hidden rounded-md",
        className
      )}
    >
      {(isInsightsPage || isJournalPage) ? (
        <>
          <canvas 
            ref={canvasRef} 
            className="absolute top-0 left-0 w-full h-full z-10"
            style={{ touchAction: 'none' }}
          />
          {bubblesRef.current.map((bubble, index) => (
            <div
              key={bubble.name + index}
              className="absolute pointer-events-auto z-20"
              style={{
                width: bubble.size,
                height: bubble.size,
                transform: `translate(${bubble.body.position.x - bubble.size/2}px, ${bubble.body.position.y - bubble.size/2}px)`,
              }}
            >
              <EmotionBubbleDetail
                name={bubble.name}
                size={bubble.size}
                color={items[index]?.color}
                isDisturbed={isCurrentlyDisturbed}
                isDragging={draggingBubble === bubble.name}
                isHighlighted={selectedEmotion === bubble.name}
                percentage={bubble.percentage}
                onClick={handleEmotionClick}
              />
            </div>
          ))}
        </>
      ) : (
        <AnimatePresence>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="w-full h-full"
          >
            {items.map((item, index) => (
              <motion.div
                key={item.name + index}
                className="absolute"
                variants={bubbleVariants}
                initial="hidden"
                animate="show"
                exit="exit"
                style={{
                  x: item.position.x - item.size / 2,
                  y: item.position.y - item.size / 2,
                  transition: `all 0.3s ${index * 0.05}s`
                }}
                {...getFloatingAnimation(index)}
              >
                <EmotionBubbleDetail
                  name={item.name}
                  size={item.size}
                  color={item.color}
                  isDisturbed={isDisturbed}
                  isHighlighted={selectedEmotion === item.name}
                  percentage={item.percentage}
                  onClick={handleEmotionClick}
                />
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
};

export default EmotionBubbles;
