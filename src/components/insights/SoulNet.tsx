import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Node from './soulnet/Node';
import { Button } from '@/components/ui/button';
import { RotateCcw, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface JournalEntry {
  id: string;
  date: string;
  content: string;
  keywords: string[];
  emotions: string[];
  sentimentScore: number;
}

interface NodeData {
  id: string;
  label: string;
  group: string;
  date: string;
  content: string;
  keywords: string[];
  emotions: string[];
  sentimentScore: number;
  x?: number;
  y?: number;
  z?: number;
}

interface SoulNetProps {
  journalEntries: JournalEntry[];
  isLoading?: boolean;
  onNodeSelect?: (node: NodeData) => void;
  className?: string;
}

const initialCameraPosition = [0, 0, 20];

export default function SoulNet({ 
  journalEntries = [], 
  isLoading = false,
  onNodeSelect,
  className = ""
}) {
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [cameraPosition, setCameraPosition] = useState<[number, number, number]>(initialCameraPosition);
  const [zoom, setZoom] = useState(1);
  const orbitControlsRef = useRef<OrbitControls>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  
  const resetCamera = () => {
    setCameraPosition(initialCameraPosition);
    setZoom(1);
    if (orbitControlsRef.current) {
      orbitControlsRef.current.reset();
    }
  };
  
  const zoomIn = () => {
    setZoom(prev => Math.min(prev + 0.1, 3));
  };
  
  const zoomOut = () => {
    setZoom(prev => Math.max(prev - 0.1, 0.2));
  };
  
  const fitToScreen = () => {
    if (!orbitControlsRef.current || !canvasRef.current) return;
    
    const canvasWidth = canvasRef.current.clientWidth;
    const canvasHeight = canvasRef.current.clientHeight;
    
    // Calculate bounding box of all nodes
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    nodes.forEach(node => {
      minX = Math.min(minX, node.x || 0);
      maxX = Math.max(maxX, node.x || 0);
      minY = Math.min(minY, node.y || 0);
      maxY = Math.max(maxY, node.y || 0);
      minZ = Math.min(minZ, node.z || 0);
      maxZ = Math.max(maxZ, node.z || 0);
    });
    
    const width = maxX - minX;
    const height = maxY - minY;
    const depth = maxZ - minZ;
    
    // Calculate the required distance to fit the bounding box in the view
    const maxDimension = Math.max(width, height, depth);
    const fov = 75; // Field of view in degrees
    const aspect = canvasWidth / canvasHeight;
    const cameraZ = maxDimension / (2 * Math.tan((fov * Math.PI / 180) / 2));
    
    // Set new camera position and zoom
    setCameraPosition([0, 0, cameraZ * 2]);
    setZoom(1);
    
    // Update orbit controls
    orbitControlsRef.current.target.set((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
    orbitControlsRef.current.position0.set(0, 0, cameraZ * 2);
    orbitControlsRef.current.zoom0 = 1;
    orbitControlsRef.current.reset();
  };

  useEffect(() => {
    // Process journal entries to create nodes
    const newNodes = journalEntries.map((entry, index) => ({
      id: entry.id,
      label: entry.date,
      group: 'journal',
      date: entry.date,
      content: entry.content,
      keywords: entry.keywords,
      emotions: entry.emotions,
      sentimentScore: entry.sentimentScore,
      x: Math.random() * 20 - 10,
      y: Math.random() * 20 - 10,
      z: Math.random() * 5 - 2.5
    }));
    setNodes(newNodes);
  }, [journalEntries]);

  return (
    <div className={`soul-net-container ${className}`}>
      <div className="absolute top-2 left-2 z-50 p-2 bg-white/80 backdrop-blur-md rounded-md shadow-md flex flex-col gap-2">
        <Button variant="outline" size="icon" onClick={resetCamera} aria-label="Reset Camera">
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={zoomIn} aria-label="Zoom In">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={zoomOut} aria-label="Zoom Out">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={fitToScreen} aria-label="Fit to Screen">
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
      
      {isLoading && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white/70 backdrop-blur-md rounded-lg p-4 shadow-lg">
          <TranslatableText text="Loading SoulNet..." />
        </div>
      )}
      
      <Canvas
        style={{
          width: '100%',
          height: '100%',
          maxWidth: '100%',
          maxHeight: '100%',
          position: 'relative',
          zIndex: 1,
          transition: 'all 0.3s ease-in-out'
        }}
        camera={{
          position: [0, 0, 20],
          fov: 75,
          near: 0.1,
          far: 1000
        }}
        gl={{
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: true
        }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={0.7} />
        
        <OrbitControls 
          ref={orbitControlsRef}
          enableDamping 
          dampingFactor={0.1}
          zoomSpeed={zoom}
          rotateSpeed={0.5}
        />
        
        {nodes.map((node) => (
          <Node 
            key={node.id} 
            data={node} 
            onSelect={onNodeSelect}
          />
        ))}
      </Canvas>
    </div>
  );
}
