
import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import Matter, { 
  Engine, 
  Render, 
  World, 
  Bodies, 
  Mouse, 
  MouseConstraint 
} from 'matter-js';

interface Entity {
  name: string;
  count: number;
  type?: string;
}

interface PhysicsEntityBubblesProps {
  entities: Entity[];
  className?: string;
}

const PhysicsEntityBubbles: React.FC<PhysicsEntityBubblesProps> = ({ entities, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [highlightedEntity, setHighlightedEntity] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  
  // Get container dimensions
  useEffect(() => {
    if (containerRef.current) {
      const updateDimensions = () => {
        setDimensions({
          width: containerRef.current?.offsetWidth || 0,
          height: containerRef.current?.offsetHeight || 0
        });
      };
      
      updateDimensions();
      window.addEventListener('resize', updateDimensions);
      
      return () => {
        window.removeEventListener('resize', updateDimensions);
      };
    }
  }, []);

  // Set up physics engine when dimensions are available
  useEffect(() => {
    // Don't proceed if no dimensions yet or already initialized
    if (dimensions.width === 0 || dimensions.height === 0 || initialized) return;
    
    // Filter entities with type "others"
    const filteredEntities = entities.filter(entity => entity.type !== 'others').slice(0, 7);
    if (!filteredEntities.length) return;
    
    // Find max count
    const maxCount = Math.max(...filteredEntities.map(e => e.count));
    
    // Set up physics
    const engine = Engine.create({
      gravity: { x: 0, y: 0 }
    });
    engineRef.current = engine;
    
    if (!canvasRef.current) return;
    
    const render = Render.create({
      canvas: canvasRef.current,
      engine: engine,
      options: {
        width: dimensions.width,
        height: dimensions.height,
        wireframes: false,
        background: 'transparent',
      }
    });
    
    // Create walls
    const wallThickness = 50;
    const walls = [
      // Bottom wall
      Bodies.rectangle(
        dimensions.width / 2, 
        dimensions.height + wallThickness / 2, 
        dimensions.width + 100, 
        wallThickness, 
        { isStatic: true, render: { visible: false } }
      ),
      // Top wall
      Bodies.rectangle(
        dimensions.width / 2, 
        -wallThickness / 2, 
        dimensions.width + 100, 
        wallThickness, 
        { isStatic: true, render: { visible: false } }
      ),
      // Left wall
      Bodies.rectangle(
        -wallThickness / 2, 
        dimensions.height / 2, 
        wallThickness, 
        dimensions.height + 100, 
        { isStatic: true, render: { visible: false } }
      ),
      // Right wall
      Bodies.rectangle(
        dimensions.width + wallThickness / 2, 
        dimensions.height / 2, 
        wallThickness, 
        dimensions.height + 100, 
        { isStatic: true, render: { visible: false } }
      ),
    ];
    
    World.add(engine.world, walls);
    
    // Create bubbles
    const maxBubbleSize = Math.min(dimensions.width / 3, dimensions.height / 2.5);
    
    filteredEntities.forEach((entity, index) => {
      // Size based on count and ensuring size fits text
      const radius = Math.max(
        25, 
        15 + (entity.count / maxCount) * (maxBubbleSize / 2)
      );
      
      // Distribute initial positions
      const sectionWidth = dimensions.width / filteredEntities.length;
      const initialX = index * sectionWidth + sectionWidth / 2;
      const initialY = dimensions.height / 2 + (index % 2 === 0 ? -30 : 30);
      
      const circle = Bodies.circle(initialX, initialY, radius, {
        restitution: 0.8,
        friction: 0.005,
        frictionAir: 0.01,
        render: {
          fillStyle: `rgba(var(--primary), 0.2)`,
          lineWidth: 1,
        },
        plugin: {
          entityData: {
            name: entity.name,
            count: entity.count,
          }
        }
      });
      
      // Set initial velocity
      Matter.Body.setVelocity(circle, {
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2,
      });
      
      World.add(engine.world, circle);
    });
    
    // Add mouse interaction
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
    
    // Handle mouse hover
    Matter.Events.on(mouseConstraint, 'mousemove', function(event) {
      const mousePosition = event.mouse.position;
      let foundEntity = null;
      
      // Check if mouse is over any bubble
      for (let i = 0; i < engine.world.bodies.length; i++) {
        const body = engine.world.bodies[i];
        
        // Skip walls
        if (body.isStatic) continue;
        
        // Check if mouse position is inside this circle
        const distance = Matter.Vector.magnitude(
          Matter.Vector.sub(body.position, mousePosition)
        );
        
        if (distance < body.circleRadius) {
          foundEntity = body.plugin?.entityData?.name || null;
          break;
        }
      }
      
      setHighlightedEntity(foundEntity);
    });
    
    // When mouse leaves canvas, clear highlight
    canvasRef.current.addEventListener('mouseleave', () => {
      setHighlightedEntity(null);
    });
    
    World.add(engine.world, mouseConstraint);
    
    Matter.Runner.run(engine);
    Render.run(render);
    
    setInitialized(true);
    
    // Cleanup on unmount
    return () => {
      Render.stop(render);
      World.clear(engine.world, false);
      Engine.clear(engine);
      if (render.canvas) {
        render.canvas.remove();
      }
      setInitialized(false);
    };
  }, [dimensions, entities, initialized]);

  // Filter out entities with type "others"
  const filteredEntities = entities.filter(entity => entity.type !== 'others').slice(0, 7);
  
  if (!filteredEntities.length || dimensions.width === 0) {
    return <div ref={containerRef} className={cn("w-full h-24", className)}></div>;
  }

  return (
    <div 
      ref={containerRef} 
      className={cn("relative w-full overflow-hidden", className)}
    >
      <canvas 
        ref={canvasRef} 
        className="absolute top-0 left-0 w-full h-full"
      />
      
      {/* Overlay text labels */}
      {initialized && engineRef.current && filteredEntities.map((entity) => {
        // Find matching physics body
        const body = engineRef.current?.world.bodies.find(
          b => b.plugin?.entityData?.name === entity.name && !b.isStatic
        );
        
        if (!body) return null;
        
        const isHighlighted = highlightedEntity === entity.name;
        
        return (
          <div 
            key={entity.name}
            className={cn(
              "absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none",
              "flex items-center justify-center rounded-full transition-all duration-100",
              isHighlighted ? "text-primary font-semibold" : "text-primary/90"
            )}
            style={{
              left: body.position.x,
              top: body.position.y,
              width: body.circleRadius * 1.8,
              height: body.circleRadius * 1.8,
              fontSize: '0.65rem',
              textShadow: isHighlighted ? '0 0 5px rgba(255,255,255,0.7)' : 'none',
            }}
          >
            <span className="text-center px-1">{entity.name}</span>
          </div>
        );
      })}
      
      {/* Highlight effects */}
      {initialized && engineRef.current && highlightedEntity && filteredEntities.map((entity) => {
        if (entity.name !== highlightedEntity) return null;
        
        const body = engineRef.current?.world.bodies.find(
          b => b.plugin?.entityData?.name === entity.name && !b.isStatic
        );
        
        if (!body) return null;
        
        return (
          <div 
            key={`highlight-${entity.name}`}
            className="absolute rounded-full pointer-events-none animate-pulse"
            style={{
              left: body.position.x,
              top: body.position.y,
              width: body.circleRadius * 2,
              height: body.circleRadius * 2,
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 0 15px 5px rgba(var(--primary), 0.5)',
              backgroundColor: 'transparent',
              zIndex: -1,
            }}
          />
        );
      })}
    </div>
  );
};

export default PhysicsEntityBubbles;
