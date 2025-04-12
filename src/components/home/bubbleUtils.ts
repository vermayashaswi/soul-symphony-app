
import { ThemeData } from './ThemeBubble';

export const createBubble = (
  themePool: ThemeData[],
  activeBubbles: Array<{
    id: string;
    themeData: ThemeData;
    size: number;
    position: { x: number; y: number };
    velocity: { x: number; y: number };
  }>,
  dimensions: { width: number; height: number },
  maxBubbles: number
) => {
  if (activeBubbles.length >= maxBubbles || !themePool.length) {
    return { newBubble: null, updatedThemePool: themePool };
  }
  
  const themeIndex = Math.floor(Math.random() * themePool.length);
  const themeData = themePool[themeIndex];
  
  const newThemePool = [...themePool];
  newThemePool.splice(themeIndex, 1);
  
  const MIN_SIZE = 80; // Increased from 50
  const MAX_SIZE = 120; // Increased from 75
  
  const textLength = themeData.theme.length;
  let bubbleSize = MIN_SIZE;
  
  if (textLength > 10) {
    bubbleSize = Math.min(MAX_SIZE, MIN_SIZE + textLength * 1.5);
  } else if (textLength > 6) {
    bubbleSize = Math.min(MAX_SIZE, MIN_SIZE + textLength);
  } else if (textLength > 3) {
    bubbleSize = Math.min(MAX_SIZE, MIN_SIZE + textLength * 0.8);
  }
  
  const edge = Math.floor(Math.random() * 4);
  
  let position: { x: number; y: number };
  let velocity: { x: number; y: number };
  
  const speedFactor = 0.8; // Increased from 0.5
  
  switch (edge) {
    case 0: // Top
      position = { 
        x: Math.random() * (dimensions.width - bubbleSize), 
        y: -bubbleSize 
      };
      velocity = { 
        x: (Math.random() - 0.5) * speedFactor, 
        y: Math.random() * speedFactor + 0.25 
      };
      break;
    case 1: // Right
      position = { 
        x: dimensions.width, 
        y: Math.random() * (dimensions.height - bubbleSize) 
      };
      velocity = { 
        x: -(Math.random() * speedFactor + 0.25), 
        y: (Math.random() - 0.5) * speedFactor 
      };
      break;
    case 2: // Bottom
      position = { 
        x: Math.random() * (dimensions.width - bubbleSize), 
        y: dimensions.height 
      };
      velocity = { 
        x: (Math.random() - 0.5) * speedFactor, 
        y: -(Math.random() * speedFactor + 0.25) 
      };
      break;
    case 3: // Left
      position = { 
        x: -bubbleSize, 
        y: Math.random() * (dimensions.height - bubbleSize) 
      };
      velocity = { 
        x: Math.random() * speedFactor + 0.25, 
        y: (Math.random() - 0.5) * speedFactor 
      };
      break;
    default:
      position = { x: 0, y: 0 };
      velocity = { x: 0.5, y: 0.5 };
  }
  
  const newBubble = {
    id: `bubble-${Date.now()}-${Math.random()}`,
    themeData, 
    size: bubbleSize, 
    position, 
    velocity
  };
  
  console.log(`Created bubble at position: (${position.x.toFixed(2)}, ${position.y.toFixed(2)}), size: ${bubbleSize}`);
  
  return { newBubble, updatedThemePool: newThemePool };
};

export const updateBubblePositions = (
  bubbles: Array<{
    id: string;
    themeData: ThemeData;
    size: number;
    position: { x: number; y: number };
    velocity: { x: number; y: number };
  }>,
  dimensions: { width: number; height: number }
) => {
  // First update positions
  const updatedBubbles = bubbles.map(bubble => {
    const newX = bubble.position.x + bubble.velocity.x;
    const newY = bubble.position.y + bubble.velocity.y;
    
    return {
      ...bubble,
      position: { x: newX, y: newY }
    };
  });
  
  // Then handle collisions
  for (let i = 0; i < updatedBubbles.length; i++) {
    for (let j = i + 1; j < updatedBubbles.length; j++) {
      const b1 = updatedBubbles[i];
      const b2 = updatedBubbles[j];
      
      const dx = b2.position.x - b1.position.x;
      const dy = b2.position.y - b1.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const minDistance = (b1.size + b2.size) / 2;
      
      if (distance < minDistance) {
        const angle = Math.atan2(dy, dx);
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);
        
        const v1 = { 
          x: b1.velocity.x * cos + b1.velocity.y * sin,
          y: b1.velocity.y * cos - b1.velocity.x * sin
        };
        const v2 = { 
          x: b2.velocity.x * cos + b2.velocity.y * sin,
          y: b2.velocity.y * cos - b2.velocity.x * sin
        };
        
        const temp = { x: v1.x, y: v1.y };
        v1.x = v2.x;
        v2.x = temp.x;
        
        updatedBubbles[i].velocity = {
          x: v1.x * cos - v1.y * sin,
          y: v1.y * cos + v1.x * sin
        };
        updatedBubbles[j].velocity = {
          x: v2.x * cos - v2.y * sin,
          y: v2.y * cos + v2.x * sin
        };
        
        const overlap = minDistance - distance;
        const moveX = overlap * Math.cos(angle) / 2;
        const moveY = overlap * Math.sin(angle) / 2;
        
        updatedBubbles[i].position.x -= moveX;
        updatedBubbles[i].position.y -= moveY;
        updatedBubbles[j].position.x += moveX;
        updatedBubbles[j].position.y += moveY;
      }
    }
  }
  
  // Check bounds and filter out bubbles that are out of bounds
  const bubblesInBounds = updatedBubbles.filter(bubble => {
    const outOfBounds =
      bubble.position.x < -bubble.size * 2 ||
      bubble.position.x > dimensions.width + bubble.size * 2 ||
      bubble.position.y < -bubble.size * 2 ||
      bubble.position.y > dimensions.height + bubble.size * 2;
    
    return !outOfBounds;
  });
  
  // Get bubble IDs that are out of bounds
  const outOfBoundsBubbleIds = updatedBubbles
    .filter(bubble => {
      const outOfBounds =
        bubble.position.x < -bubble.size * 2 ||
        bubble.position.x > dimensions.width + bubble.size * 2 ||
        bubble.position.y < -bubble.size * 2 ||
        bubble.position.y > dimensions.height + bubble.size * 2;
      
      return outOfBounds;
    })
    .map(bubble => bubble.themeData);
  
  return { updatedBubbles: bubblesInBounds, outOfBoundsBubbleThemes: outOfBoundsBubbleIds };
};
