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

  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0 || initialized) return;
    
    const filteredEntities = entities.filter(entity => entity.type !== 'others').slice(0, 7);
    if (!filteredEntities.length) return;
    
    const maxCount = Math.max(...filteredEntities.map(e => e.count));
    
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
    
    const wallThickness = 50;
    const walls = [
      Bodies.rectangle(
        dimensions.width / 2, 
        dimensions.height + wallThickness / 2, 
        dimensions.width + 100, 
        wallThickness, 
        { isStatic: true, render: { visible: false } }
      ),
      Bodies.rectangle(
        dimensions.width / 2, 
        -wallThickness / 2, 
        dimensions.width + 100, 
        wallThickness, 
        { isStatic: true, render: { visible: false } }
      ),
      Bodies.rectangle(
        -wallThickness / 2, 
        dimensions.height / 2, 
        wallThickness, 
        dimensions.height + 100, 
        { isStatic: true, render: { visible: false } }
      ),
      Bodies.rectangle(
        dimensions.width + wallThickness / 2, 
        dimensions.height / 2, 
        wallThickness, 
        dimensions.height + 100, 
        { isStatic: true, render: { visible: false } }
      ),
    ];
    
    World.add(engine.world, walls);
    
    const maxBubbleSize = Math.min(dimensions.width / 3, dimensions.height / 3);
    
    const bubbleSpacing = dimensions.width / (filteredEntities.length + 1);
    
    filteredEntities.forEach((entity, index) => {
      const normFactor = 0.3 + (entity.count / maxCount) * 0.7;
      const radius = Math.max(
        30,
        maxBubbleSize * normFactor / 2
      );
      
      const initialX = (index + 1) * bubbleSpacing;
      const initialY = dimensions.height / 2 + (index % 3 - 1) * 20;
      
      const circle = Bodies.circle(initialX, initialY, radius, {
        restitution: 0.7,
        friction: 0.001,
        frictionAir: 0.02,
        density: 0.001,
        render: {
          fillStyle: `rgba(var(--primary), 0.2)`,
          strokeStyle: `rgba(var(--primary), 0.5)`,
          lineWidth: 2,
        },
        plugin: {
          entityData: {
            name: entity.name,
            count: entity.count,
          }
        }
      });
      
      Matter.Body.setVelocity(circle, {
        x: (Math.random() - 0.5) * 0.7,
        y: (Math.random() - 0.5) * 0.7,
      });
      
      World.add(engine.world, circle);
    });
    
    const mouse = Mouse.create(canvasRef.current);
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse: mouse,
      constraint: {
        stiffness: 0.1,
        render: {
          visible: false
        }
      }
    });
    
    Matter.Events.on(mouseConstraint, 'mousemove', function(event) {
      const mousePosition = event.mouse.position;
      let foundEntity = null;
      
      for (let i = 0; i < engine.world.bodies.length; i++) {
        const body = engine.world.bodies[i];
        
        if (body.isStatic) continue;
        
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
    
    canvasRef.current.addEventListener('mouseleave', () => {
      setHighlightedEntity(null);
    });
    
    World.add(engine.world, mouseConstraint);
    
    const runner = Matter.Runner.create({
      isFixed: true,
      delta: 1000 / 60
    });
    Matter.Runner.run(runner, engine);
    
    Render.run(render);
    
    setInitialized(true);
    
    return () => {
      if (runner) Matter.Runner.stop(runner);
      Render.stop(render);
      World.clear(engine.world, false);
      Engine.clear(engine);
      if (render.canvas) {
        render.canvas.remove();
      }
      setInitialized(false);
    };
  }, [dimensions, entities, initialized]);

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
      
      {initialized && engineRef.current && filteredEntities.map((entity) => {
        const body = engineRef.current?.world.bodies.find(
          b => b.plugin?.entityData?.name === entity.name && !b.isStatic
        );
        
        if (!body) return null;
        
        const isHighlighted = highlightedEntity === entity.name;
        
        return (
          <div 
            key={entity.name}
            className={cn(
              "absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none text-center",
              "flex items-center justify-center rounded-full transition-all duration-150",
              isHighlighted ? "text-primary font-semibold" : "text-primary/80"
            )}
            style={{
              left: body.position.x,
              top: body.position.y,
              width: body.circleRadius * 1.8,
              height: body.circleRadius * 1.8,
              fontSize: '0.6rem',
              textShadow: isHighlighted ? '0 0 5px rgba(255,255,255,0.7)' : 'none',
            }}
          >
            <span className="text-center px-1 leading-tight">{entity.name}</span>
          </div>
        );
      })}
      
      {initialized && engineRef.current && highlightedEntity && filteredEntities.map((entity) => {
        if (entity.name !== highlightedEntity) return null;
        
        const body = engineRef.current?.world.bodies.find(
          b => b.plugin?.entityData?.name === entity.name && !b.isStatic
        );
        
        if (!body) return null;
        
        return (
          <div 
            key={`highlight-${entity.name}`}
            className="absolute rounded-full pointer-events-none entity-bubble-glow"
            style={{
              left: body.position.x,
              top: body.position.y,
              width: body.circleRadius * 2,
              height: body.circleRadius * 2,
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 0 15px 5px rgba(var(--primary), 0.5)',
              backgroundColor: 'rgba(var(--primary), 0.15)',
              zIndex: -1,
            }}
          />
        );
      })}
    </div>
  );
};

export default PhysicsEntityBubbles;
