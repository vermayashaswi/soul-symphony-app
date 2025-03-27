import React, { useEffect, useRef, useState } from 'react';
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
  Runner
} from 'matter-js';
import EmotionBubbleDetail from './EmotionBubbleDetail';
import { useToast } from '@/components/ui/use-toast';

interface EmotionBubblesProps {
  emotions?: Record<string, number>;
  themes?: string[];
  className?: string;
  onEmotionClick?: (emotion: string) => void;
  preventOverlap?: boolean;
}

const EmotionBubbles: React.FC<EmotionBubblesProps> = ({ 
  emotions, 
  themes, 
  className,
  onEmotionClick,
  preventOverlap = false
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
  }[]>([]);
  const mouseConstraintRef = useRef<Matter.MouseConstraint | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [items, setItems] = useState<Array<{ 
    name: string; 
    size: number; 
    color: string; 
    position: { x: number; y: number };
    value?: number;
  }>>([]);
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
  const [physicsInitialized, setPhysicsInitialized] = useState(false);
  
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

  const applyRandomForces = () => {
    if (!engineRef.current || !bubblesRef.current.length) return;
    
    bubblesRef.current.forEach((bubble) => {
      if (Math.random() > 0.95) {
        const forceX = (Math.random() - 0.5) * 0.001;
        const forceY = (Math.random() - 0.5) * 0.001;
        Body.applyForce(bubble.body, bubble.body.position, { x: forceX, y: forceY });
      }
    });
    
    animationFrameRef.current = requestAnimationFrame(applyRandomForces);
  };

  useEffect(() => {
    if (isInsightsPage && containerSize.width > 0 && containerSize.height > 0 && canvasRef.current) {
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
      
      const engine = Engine.create({
        enableSleeping: false,
        gravity: { x: 0, y: 0, scale: 0 }
      });
      engineRef.current = engine;
      worldRef.current = engine.world;
      
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
      
      const wallThickness = 50;
      const containerPadding = 20;
      const walls = [
        Bodies.rectangle(
          containerSize.width / 2, 
          containerSize.height + wallThickness / 2 + containerPadding, 
          containerSize.width + containerPadding * 2, 
          wallThickness, 
          { isStatic: true, render: { visible: false } }
        ),
        Bodies.rectangle(
          containerSize.width / 2, 
          -wallThickness / 2 - containerPadding, 
          containerSize.width + containerPadding * 2, 
          wallThickness, 
          { isStatic: true, render: { visible: false } }
        ),
        Bodies.rectangle(
          -wallThickness / 2 - containerPadding, 
          containerSize.height / 2, 
          wallThickness, 
          containerSize.height + containerPadding * 2, 
          { isStatic: true, render: { visible: false } }
        ),
        Bodies.rectangle(
          containerSize.width + wallThickness / 2 + containerPadding, 
          containerSize.height / 2, 
          wallThickness, 
          containerSize.height + containerPadding * 2, 
          { isStatic: true, render: { visible: false } }
        ),
      ];
      
      World.add(engine.world, walls);
      
      let bubbleBodies: {
        body: Matter.Body;
        name: string;
        size: number;
        color: string;
      }[] = [];
      
      if (items.length > 0) {
        bubbleBodies = items.map((item) => {
          const friction = 0.005 + Math.random() * 0.005;
          const frictionAir = 0.01 + Math.random() * 0.01;
          const restitution = 0.7 + Math.random() * 0.2; 
          
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
              density: 0.001 * (1 + Math.random() * 0.2)
            }
          );
          
          return {
            body,
            name: item.name,
            size: item.size,
            color: item.color
          };
        });
        
        World.add(engine.world, bubbleBodies.map(b => b.body));
        bubblesRef.current = bubbleBodies;
      }
      
      const mouse = Mouse.create(canvasRef.current);
      const mouseConstraint = MouseConstraint.create(engine, {
        mouse: mouse,
        constraint: {
          stiffness: 0.2,
          render: {
            visible: false
          }
        }
      });
      
      World.add(engine.world, mouseConstraint);
      mouseConstraintRef.current = mouseConstraint;
      render.mouse = mouse;
      
      const runner = Runner.create({
        isFixed: true,
      });
      Runner.run(runner, engine);
      runnerRef.current = runner;
      
      Render.run(render);
      
      animationFrameRef.current = requestAnimationFrame(applyRandomForces);
      
      setPhysicsInitialized(true);
      
      return () => {
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
  }, [isInsightsPage, containerSize, items]);

  useEffect(() => {
    if (isInsightsPage && bubblesRef.current.length > 0 && items.length > 0) {
      bubblesRef.current.forEach((bubble, index) => {
        if (index < items.length) {
          Body.setPosition(bubble.body, {
            x: items[index].position.x,
            y: items[index].position.y
          });
          
          Body.setVelocity(bubble.body, {
            x: (Math.random() - 0.5) * 0.5,
            y: (Math.random() - 0.5) * 0.5
          });
        }
      });
    }
  }, [isInsightsPage, items]);

  useEffect(() => {
    if (containerSize.width === 0 || containerSize.height === 0) return;
    
    const padding = Math.min(containerSize.width, containerSize.height) * 0.1;
    const availableWidth = containerSize.width - padding * 2;
    const availableHeight = containerSize.height - padding * 2;
    
    let newItems: Array<{ 
      name: string; 
      size: number; 
      color: string; 
      position: { x: number; y: number };
      value?: number;
    }> = [];
    
    const calculateMinBubbleSize = (text: string): number => {
      const textLength = text.length;
      
      if (textLength <= 5) {
        return Math.min(availableWidth, availableHeight) * 0.15;
      } else if (textLength <= 10) {
        return Math.min(availableWidth, availableHeight) * 0.20;
      } else if (textLength <= 15) {
        return Math.min(availableWidth, availableHeight) * 0.25;
      } else {
        return Math.min(availableWidth, availableHeight) * 0.30;
      }
    };
    
    if (emotions && Object.keys(emotions).length > 0) {
      const values = Object.values(emotions);
      const maxValue = Math.max(...values);
      const minValue = Math.min(...values);
      const valueRange = maxValue - minValue;
      
      const totalArea = availableWidth * availableHeight * 0.7;
      const itemCount = Object.keys(emotions).length;
      
      const emotionEntries = Object.entries(emotions);
      const baseMinSizes = emotionEntries.map(([emotion, _]) => ({
        emotion,
        minSize: calculateMinBubbleSize(emotion)
      }));
      
      const maxBubbleSize = Math.min(
        Math.min(availableWidth, availableHeight) * 0.4,
        Math.sqrt((totalArea) / (itemCount * Math.PI)) * 1.8
      );
      
      newItems = emotionEntries.map(([emotion, value], index) => {
        const minSize = baseMinSizes.find(item => item.emotion === emotion)?.minSize || 
                       Math.min(availableWidth, availableHeight) * 0.15;
        
        let size;
        if (valueRange === 0) {
          size = minSize;
        } else {
          const normalizedValue = (value - minValue) / valueRange;
          size = minSize + (normalizedValue * (maxBubbleSize - minSize));
        }
        
        return {
          name: emotion,
          size,
          color: colorPalette[index % colorPalette.length],
          position: { x: 0, y: 0 },
          value: valueRange === 0 ? 0.5 : (value - minValue) / valueRange
        };
      });
    } else if (themes && themes.length > 0) {
      const itemCount = themes.length;
      
      const totalArea = availableWidth * availableHeight * 0.7;
      const maxBubbleSize = Math.min(
        Math.min(availableWidth, availableHeight) * 0.35,
        Math.sqrt((totalArea) / (itemCount * Math.PI)) * 1.5
      );
      
      newItems = themes.map((theme, index) => {
        const minSize = calculateMinBubbleSize(theme);
        
        const size = Math.min(maxBubbleSize, Math.max(minSize, maxBubbleSize * 0.7));
        
        return {
          name: theme,
          size,
          color: colorPalette[index % colorPalette.length],
          position: { x: 0, y: 0 }
        };
      });
    }
    
    if (newItems.length > 0) {
      newItems.sort((a, b) => b.size - a.size);
      
      for (let i = 0; i < newItems.length; i++) {
        const placeItem = (item: any, index: number, attempts = 0) => {
          if (attempts > 50) {
            const cols = Math.ceil(Math.sqrt(newItems.length));
            const col = index % cols;
            const row = Math.floor(index / cols);
            const cellWidth = availableWidth / cols;
            const cellHeight = availableHeight / cols;
            
            return {
              x: padding + cellWidth * (col + 0.5),
              y: padding + cellHeight * (row + 0.5)
            };
          }
          
          const maxRadius = Math.min(availableWidth, availableHeight) * 0.4;
          const maxAngle = 2 * Math.PI * 3;
          
          const t = index / newItems.length;
          const angle = t * maxAngle;
          const radius = t * maxRadius;
          
          const centerX = availableWidth / 2;
          const centerY = availableHeight / 2;
          
          const randomOffset = Math.min(availableWidth, availableHeight) * 0.05;
          const randomX = (Math.random() - 0.5) * randomOffset;
          const randomY = (Math.random() - 0.5) * randomOffset;
          
          const x = padding + centerX + radius * Math.cos(angle) + randomX;
          const y = padding + centerY + radius * Math.sin(angle) + randomY;
          
          if (preventOverlap && attempts < 50) {
            for (let j = 0; j < i; j++) {
              const otherItem = newItems[j];
              const dx = x - otherItem.position.x;
              const dy = y - otherItem.position.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              
              if (distance < (item.size / 2 + otherItem.size / 2) * 0.8) {
                return placeItem(item, index, attempts + 1);
              }
            }
          }
          
          return { x, y };
        };
        
        const position = placeItem(newItems[i], i);
        
        const safeBubblePlacement = (pos: {x: number, y: number}, size: number) => {
          const halfSize = size / 2;
          const minX = padding + halfSize;
          const maxX = padding + availableWidth - halfSize;
          const minY = padding + halfSize;
          const maxY = padding + availableHeight - halfSize;
          
          return {
            x: Math.min(maxX, Math.max(minX, pos.x)),
            y: Math.min(maxY, Math.max(minY, pos.y))
          };
        };
        
        newItems[i].position = safeBubblePlacement(position, newItems[i].size);
      }
    }
    
    setItems(newItems);
  }, [containerSize, emotions, themes, preventOverlap]);

  const handleEmotionClick = (emotion: string) => {
    setSelectedEmotion(emotion);
    toast({
      title: `${emotion}`,
      description: `You selected ${emotion}. This emotion appears in your journal entries.`,
      duration: 3000,
    });
    
    if (onEmotionClick) {
      onEmotionClick(emotion);
    }
  };

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
    show: (item: { position: { x: number; y: number }; size: number }) => ({
      opacity: 1, 
      scale: 1,
      x: item.position.x - item.size / 2,
      y: item.position.y - item.size / 2,
      transition: { 
        type: "spring",
        damping: 12,
        stiffness: 100,
        duration: 0.8
      }
    }),
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

  return (
    <div 
      ref={containerRef} 
      className={cn(
        "relative w-full h-full overflow-hidden rounded-md",
        className
      )}
    >
      {isInsightsPage ? (
        <>
          <canvas 
            ref={canvasRef} 
            className="absolute top-0 left-0 w-full h-full"
          />
          {bubblesRef.current.map((bubble, index) => (
            <div
              key={bubble.name + index}
              className="absolute pointer-events-auto"
              style={{
                width: bubble.size,
                height: bubble.size,
                transform: `translate(${bubble.body.position.x - bubble.size/2}px, ${bubble.body.position.y - bubble.size/2}px)`,
              }}
            >
              <motion.div
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <EmotionBubbleDetail
                  name={bubble.name}
                  size={bubble.size}
                  color={items[index]?.color}
                  value={items[index]?.value}
                  onClick={handleEmotionClick}
                />
              </motion.div>
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
                custom={item}
                variants={bubbleVariants}
                initial="hidden"
                animate="show"
                exit="exit"
                whileHover="hover"
              >
                <EmotionBubbleDetail
                  name={item.name}
                  size={item.size}
                  color={item.color}
                  value={item.value}
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
