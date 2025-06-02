
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useTheme } from '@/hooks/use-theme';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDebounce } from '@/hooks/use-debounce';
import { TranslatableText } from '@/components/translation/TranslatableText';
import NodeMesh from './soulnet/NodeMesh';
import DirectNodeLabel from './soulnet/DirectNodeLabel';
import Edge from './soulnet/Edge';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/contexts/TranslationContext';
import { useToast } from "@/components/ui/use-toast"
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { DatePicker } from "@/components/ui/date-picker"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import SoulNetErrorBoundary from './soulnet/SoulNetErrorBoundary';

interface SoulNetProps {
  userId: string | undefined;
  timeRange: string;
}

interface NodeData {
  id: string;
  x: number;
  y: number;
  z: number;
  scale: number;
  type: 'entity' | 'emotion';
  color: string;
  created_at?: string;
  displayColor: string;
}

interface EdgeData {
  source: string;
  target: string;
  strength: number;
}

interface ProcessedData {
  nodes: NodeData[];
  edges: EdgeData[];
  nodePositions: { [nodeId: string]: [number, number, number] };
}

interface DateRange {
  from?: Date;
  to?: Date;
}

interface JournalEntry {
  id: number;
  created_at: string;
  emotions?: Record<string, number>;
  entities?: Array<{ name: string; type: string }>;
  'refined text'?: string;
  'transcription text'?: string;
}

const LoadingState = () => (
  <div className="flex flex-col items-center justify-center space-y-4">
    <Skeleton className="h-12 w-12 rounded-full" />
    <Skeleton className="h-4 w-32" />
    <Skeleton className="h-3 w-64" />
  </div>
);

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center space-y-4">
    <div className="text-center">
      <h3 className="text-xl font-semibold">No Data Available</h3>
      <p className="text-muted-foreground">
        There is no data available for the selected time range.
      </p>
    </div>
  </div>
);

function CameraController({ 
  orbitControlsRef, 
  setCameraZoom 
}: { 
  orbitControlsRef: React.MutableRefObject<any>; 
  setCameraZoom: (zoom: number) => void; 
}) {
  const { camera } = useThree();

  useEffect(() => {
    if (orbitControlsRef.current) {
      const controls = orbitControlsRef.current;

      const handleZoom = () => {
        if (camera) {
          setCameraZoom(camera.zoom);
        }
      };

      controls.addEventListener('change', handleZoom);

      return () => {
        controls.removeEventListener('change', handleZoom);
      };
    }
  }, [camera, orbitControlsRef, setCameraZoom]);

  return null;
}

// Helper function to generate 3D coordinates in a sphere
const generateSphereCoordinates = (index: number, total: number, radius: number = 10) => {
  const phi = Math.acos(-1 + (2 * index) / total);
  const theta = Math.sqrt(total * Math.PI) * phi;
  
  return {
    x: radius * Math.cos(theta) * Math.sin(phi),
    y: radius * Math.sin(theta) * Math.sin(phi),
    z: radius * Math.cos(phi)
  };
};

// Helper function to get emotion color
const getEmotionColor = (emotion: string): string => {
  const emotionColors: Record<string, string> = {
    joy: '#FFD700',
    happiness: '#FFD700',
    sadness: '#4169E1',
    anger: '#DC143C',
    fear: '#800080',
    surprise: '#FF69B4',
    disgust: '#228B22',
    love: '#FF1493',
    excitement: '#FF4500',
    calm: '#87CEEB',
    anxiety: '#8B0000',
    content: '#32CD32',
    frustrated: '#B22222',
    grateful: '#FFB6C1',
    lonely: '#483D8B',
    confident: '#FFA500',
    stressed: '#696969',
    peaceful: '#98FB98',
    overwhelmed: '#CD5C5C',
    hopeful: '#87CEFA'
  };
  
  return emotionColors[emotion.toLowerCase()] || '#9CA3AF';
};

// Helper function to get entity color
const getEntityColor = (entityType: string): string => {
  const entityColors: Record<string, string> = {
    person: '#60A5FA',
    place: '#34D399',
    organization: '#F59E0B',
    event: '#EC4899',
    other: '#8B5CF6'
  };
  
  return entityColors[entityType.toLowerCase()] || '#6B7280';
};

export default function SoulNet({ userId, timeRange }: SoulNetProps) {
  const [data, setData] = useState<{ nodes: NodeData[]; edges: EdgeData[] } | null>(null);
  const [processedData, setProcessedData] = useState<ProcessedData>({ nodes: [], edges: [], nodePositions: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [cameraZoom, setCameraZoom] = useState(45);
  const [shouldShowLabels, setShouldShowLabels] = useState(true);
  const [nodeScaleMultiplier, setNodeScaleMultiplier] = useState(1);
  const [minDate, setMinDate] = useState<Date | undefined>(undefined);
  const [maxDate, setMaxDate] = useState<Date | undefined>(undefined);
  const [dateRange, setDateRange] = useState<DateRange>({});
  const [isZoomReset, setIsZoomReset] = useState(false);
  const { theme } = useTheme();
  const { toast } = useToast()
  const { translate } = useTranslation();
  const isMobile = useIsMobile();
  const debouncedScaleMultiplier = useDebounce(nodeScaleMultiplier, 300);
  const orbitControlsRef = useRef<any>(null);

  const fetchData = useCallback(async () => {
    if (!userId) {
      console.warn("[SoulNet] No user ID provided, skipping data fetch.");
      setLoading(false);
      setError("No user ID provided.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log("[SoulNet] Fetching journal entries from Supabase...");
      
      // Fetch journal entries with emotions and entities
      const { data: entries, error: fetchError } = await supabase
        .from('Journal Entries')
        .select('id, created_at, emotions, entities, "refined text", "transcription text"')
        .eq('user_id', userId)
        .not('emotions', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100);

      if (fetchError) {
        throw new Error(`Failed to fetch journal entries: ${fetchError.message}`);
      }

      if (!entries || entries.length === 0) {
        console.log("[SoulNet] No journal entries found with emotions");
        setData({ nodes: [], edges: [] });
        setLoading(false);
        return;
      }

      console.log(`[SoulNet] Processing ${entries.length} journal entries`);
      
      // Process the data to create nodes and edges
      const nodeMap = new Map<string, NodeData>();
      const edgeMap = new Map<string, { source: string; target: string; strength: number }>();
      
      // Track entity-emotion co-occurrences for edge creation
      const coOccurrences = new Map<string, number>();
      
      entries.forEach((entry: JournalEntry, entryIndex: number) => {
        const emotions = entry.emotions || {};
        const entities = entry.entities || [];
        
        // Create emotion nodes
        Object.entries(emotions).forEach(([emotion, score]) => {
          if (score > 0.3) { // Only include emotions with significant scores
            const nodeId = `emotion_${emotion}`;
            if (!nodeMap.has(nodeId)) {
              const coords = generateSphereCoordinates(nodeMap.size, 50, 8);
              nodeMap.set(nodeId, {
                id: emotion,
                x: coords.x,
                y: coords.y,
                z: coords.z,
                scale: 0.8 + (score * 0.7), // Scale based on emotion strength
                type: 'emotion',
                color: getEmotionColor(emotion),
                displayColor: getEmotionColor(emotion),
                created_at: entry.created_at
              });
            }
          }
        });
        
        // Create entity nodes
        entities.forEach((entity) => {
          if (entity.name && entity.name.trim()) {
            const nodeId = `entity_${entity.name}`;
            if (!nodeMap.has(nodeId)) {
              const coords = generateSphereCoordinates(nodeMap.size, 50, 8);
              nodeMap.set(nodeId, {
                id: entity.name,
                x: coords.x,
                y: coords.y,
                z: coords.z,
                scale: 1.0,
                type: 'entity',
                color: getEntityColor(entity.type || 'other'),
                displayColor: getEntityColor(entity.type || 'other'),
                created_at: entry.created_at
              });
            }
          }
        });
        
        // Create edges between entities and emotions that co-occur
        Object.entries(emotions).forEach(([emotion, emotionScore]) => {
          if (emotionScore > 0.3) {
            entities.forEach((entity) => {
              if (entity.name && entity.name.trim()) {
                const emotionNodeId = `emotion_${emotion}`;
                const entityNodeId = `entity_${entity.name}`;
                const edgeKey = `${entityNodeId}_${emotionNodeId}`;
                
                const currentStrength = coOccurrences.get(edgeKey) || 0;
                coOccurrences.set(edgeKey, currentStrength + emotionScore);
              }
            });
          }
        });
      });
      
      // Convert co-occurrences to edges
      coOccurrences.forEach((strength, edgeKey) => {
        const [source, target] = edgeKey.split('_', 2);
        const sourceNodeId = source.replace('emotion_', '').replace('entity_', '');
        const targetNodeId = target.replace('emotion_', '').replace('entity_', '');
        
        if (strength > 0.5) { // Only create edges for strong co-occurrences
          edgeMap.set(edgeKey, {
            source: sourceNodeId,
            target: targetNodeId,
            strength: Math.min(1.0, strength / 3) // Normalize strength
          });
        }
      });
      
      const processedNodes = Array.from(nodeMap.values());
      const processedEdges = Array.from(edgeMap.values());
      
      console.log(`[SoulNet] Created ${processedNodes.length} nodes and ${processedEdges.length} edges`);
      
      setData({
        nodes: processedNodes,
        edges: processedEdges
      });

    } catch (e: any) {
      console.error("[SoulNet] Failed to fetch data:", e);
      setError(e.message || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [userId, timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (data) {
      try {
        const minMaxDates = data.nodes.reduce((acc: any, node: any) => {
          if (node.created_at) {
            const createdAt = new Date(node.created_at);
            if (!acc.min || createdAt < acc.min) {
              acc.min = createdAt;
            }
            if (!acc.max || createdAt > acc.max) {
              acc.max = createdAt;
            }
          }
          return acc;
        }, { min: null, max: null });

        setMinDate(minMaxDates.min);
        setMaxDate(minMaxDates.max);
        setDateRange({ from: minMaxDates.min, to: minMaxDates.max });
      } catch (error) {
        console.error("Error processing dates:", error);
      }
    }
  }, [data]);

  useEffect(() => {
    if (data) {
      try {
        const filteredNodes = data.nodes.filter((node: any) => {
          if (!dateRange?.from || !dateRange?.to || !node.created_at) return true;
          const createdAt = new Date(node.created_at);
          return createdAt >= dateRange.from && createdAt <= dateRange.to;
        });

        const nodeMap: { [key: string]: any } = {};
        filteredNodes.forEach((node: any) => {
          nodeMap[node.id] = {
            id: node.id,
            x: parseFloat(node.x?.toString()) || 0,
            y: parseFloat(node.y?.toString()) || 0,
            z: parseFloat(node.z?.toString()) || 0,
            scale: parseFloat(node.scale?.toString()) || 1,
            type: node.type,
            color: node.displayColor,
            created_at: node.created_at
          };
        });

        const filteredEdges = data.edges.filter((edge: any) => {
          return nodeMap[edge.source] && nodeMap[edge.target];
        });

        const newNodes = Object.values(nodeMap) as NodeData[];
        const newEdges = filteredEdges.map((edge: any) => ({
          source: edge.source,
          target: edge.target,
          strength: parseFloat(edge.strength?.toString()) || 0.5
        }));

        const nodePositions: { [nodeId: string]: [number, number, number] } = {};
        newNodes.forEach(node => {
          nodePositions[node.id] = [node.x, node.y, node.z];
        });

        setProcessedData({ nodes: newNodes, edges: newEdges, nodePositions });
      } catch (e) {
        console.error("[SoulNet] Error processing data:", e);
        setError("Error processing data for visualization.");
      }
    }
  }, [data, dateRange]);

  const handleNodeClick = (nodeId: string) => {
    console.log(`[SoulNet] Node clicked: ${nodeId}`);
    setSelectedNode(prev => prev === nodeId ? null : nodeId);
  };

  const handleNodePointerOver = (nodeId: string) => {
    setHighlightedNode(nodeId);
  };

  const handleNodePointerOut = () => {
    setHighlightedNode(null);
  };

  const handleNodePointerDown = (e: any) => {
    e.stopPropagation();
  };

  const handleNodePointerUp = (e: any) => {
    e.stopPropagation();
  };

  const handleNodePointerLeave = () => {
    setHighlightedNode(null);
  };

  const handleVisualizationError = (error: Error, errorInfo: any) => {
    console.error('[SoulNet] Visualization error:', error, errorInfo);
    setError(error.message);
    setLoading(false);
  };

  const resetZoom = () => {
    if (orbitControlsRef.current) {
      const controls = orbitControlsRef.current;
      controls.reset();
      setCameraZoom(1);
      setIsZoomReset(true);
      toast({
        title: "Zoom Reset",
        description: "The zoom level has been reset to its initial value.",
      })
    }
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-background p-8 rounded-xl shadow-sm border"
      >
        <LoadingState />
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-background p-8 rounded-xl shadow-sm border"
      >
        <SoulNetErrorBoundary
          onError={handleVisualizationError}
          maxRetries={3}
        >
          <div className="text-center">
            <p className="text-red-500 mb-4">
              <TranslatableText text={error} forceTranslate={true} />
            </p>
            <Button onClick={() => window.location.reload()}>
              <TranslatableText text="Reload Page" forceTranslate={true} />
            </Button>
          </div>
        </SoulNetErrorBoundary>
      </motion.div>
    );
  }

  if (processedData.nodes.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-background p-8 rounded-xl shadow-sm border"
      >
        <EmptyState />
      </motion.div>
    );
  }

  return (
    <SoulNetErrorBoundary
      onError={handleVisualizationError}
      maxRetries={3}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-background rounded-xl shadow-sm border overflow-hidden w-full"
      >
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">
            <TranslatableText text="Soul-Net Visualization" forceTranslate={true} />
          </h3>
          <p className="text-muted-foreground text-sm">
            <TranslatableText text="Explore the connections between your emotions and entities." forceTranslate={true} />
          </p>
        </div>
        <div className="flex flex-col md:flex-row items-center justify-between p-4">
          <div className="flex items-center space-x-2 mb-2 md:mb-0">
            <Switch id="show-labels"
              checked={shouldShowLabels}
              onCheckedChange={(checked) => setShouldShowLabels(checked)} />
            <Label htmlFor="show-labels">
              <TranslatableText text="Show Labels" forceTranslate={true} />
            </Label>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Label htmlFor="node-scale">
                <TranslatableText text="Node Scale:" forceTranslate={true} />
              </Label>
              <Slider
                id="node-scale"
                defaultValue={[1]}
                max={3}
                min={0.1}
                step={0.1}
                onValueChange={(value) => setNodeScaleMultiplier(value[0])}
                className="w-[100px]"
              />
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  <TranslatableText text="Open Date Range" forceTranslate={true} />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    <TranslatableText text="Select Date Range" forceTranslate={true} />
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    <TranslatableText text="Choose the start and end dates for the visualization." forceTranslate={true} />
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="grid gap-4">
                  <div className="grid grid-cols-1 gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-[240px] justify-start text-left font-normal",
                            !dateRange?.from && "text-muted-foreground"
                          )}
                        >
                          {dateRange?.from ? (
                            format(dateRange.from, "PPP")
                          ) : (
                            <span>
                              <TranslatableText text="Pick a date" forceTranslate={true} />
                            </span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <DatePicker
                          mode="single"
                          selected={dateRange?.from}
                          onSelect={(date) => setDateRange({ ...dateRange, from: date })}
                          disabled={(date) =>
                            minDate && maxDate ? (date < minDate || date > maxDate) : false
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-[240px] justify-start text-left font-normal",
                            !dateRange?.to && "text-muted-foreground"
                          )}
                        >
                          {dateRange?.to ? (
                            format(dateRange.to, "PPP")
                          ) : (
                            <span>
                              <TranslatableText text="Pick a date" forceTranslate={true} />
                            </span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <DatePicker
                          mode="single"
                          selected={dateRange?.to}
                          onSelect={(date) => setDateRange({ ...dateRange, to: date })}
                          disabled={(date) =>
                            minDate && maxDate ? (date < minDate || date > maxDate) : false
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>
                    <TranslatableText text="Cancel" forceTranslate={true} />
                  </AlertDialogCancel>
                  <AlertDialogAction>
                    <TranslatableText text="Save" forceTranslate={true} />
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="secondary" onClick={resetZoom}>
              <TranslatableText text="Reset Zoom" forceTranslate={true} />
            </Button>
          </div>
        </div>
        <div className="w-full h-[600px] relative soul-net-visualization">
          <Canvas
            camera={{ position: [0, 0, 5] }}
            onCreated={({ gl }) => {
              gl.setClearColor(theme === 'dark' ? '#0F172A' : '#FFFFFF');
            }}
          >
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} />
            <OrbitControls
              ref={orbitControlsRef}
              enableDamping
              dampingFactor={0.1}
              rotateSpeed={0.5}
              zoomSpeed={0.5}
              minDistance={1}
              maxDistance={10}
            />
            <CameraController 
              orbitControlsRef={orbitControlsRef} 
              setCameraZoom={setCameraZoom} 
            />
            
            {/* Render edges */}
            {processedData.edges.map((edge, index) => {
              const sourceNode = processedData.nodes.find(n => n.id === edge.source);
              const targetNode = processedData.nodes.find(n => n.id === edge.target);
              
              if (!sourceNode || !targetNode) return null;
              
              const isHighlighted = selectedNode === edge.source || selectedNode === edge.target;
              const isDimmed = selectedNode && !isHighlighted;
              
              return (
                <Edge
                  key={`edge-${index}`}
                  start={[sourceNode.x, sourceNode.y, sourceNode.z]}
                  end={[targetNode.x, targetNode.y, targetNode.z]}
                  value={edge.strength}
                  isHighlighted={isHighlighted}
                  dimmed={isDimmed}
                  maxThickness={2}
                  startNodeType={sourceNode.type}
                  endNodeType={targetNode.type}
                  startNodeScale={sourceNode.scale * debouncedScaleMultiplier}
                  endNodeScale={targetNode.scale * debouncedScaleMultiplier}
                />
              );
            })}
            
            {/* Render nodes */}
            {processedData.nodes.map((node) => {
              const isHighlighted = node.id === highlightedNode;
              const isSelected = node.id === selectedNode;
              const isConnected = processedData.edges.some(edge => edge.source === node.id || edge.target === node.id);
              const connectionStrength = processedData.edges.find(edge => edge.source === node.id || edge.target === node.id)?.strength || 0.5;

              return (
                <group key={`node-${node.id}`} position={[node.x, node.y, node.z]}>
                  <NodeMesh
                    type={node.type}
                    scale={node.scale * debouncedScaleMultiplier}
                    displayColor={node.color}
                    isHighlighted={isHighlighted}
                    dimmed={highlightedNode != null && !isHighlighted && !isSelected && !isConnected}
                    connectionStrength={connectionStrength}
                    isSelected={isSelected}
                    onClick={() => handleNodeClick(node.id)}
                    onPointerOver={() => handleNodePointerOver(node.id)}
                    onPointerDown={handleNodePointerDown}
                    onPointerUp={handleNodePointerUp}
                    onPointerOut={handleNodePointerOut}
                    onPointerLeave={handleNodePointerLeave}
                  />
                </group>
              );
            })}
            
            {/* Render labels */}
            {processedData.nodes.map((node) => {
              const isHighlighted = node.id === highlightedNode;
              const isSelected = node.id === selectedNode;
              return (
                <DirectNodeLabel
                  key={`label-${node.id}`}
                  id={node.id}
                  type={node.type}
                  position={[node.x, node.y, node.z]}
                  isHighlighted={isHighlighted}
                  isSelected={isSelected}
                  shouldShowLabel={shouldShowLabels && (isHighlighted || isSelected)}
                  cameraZoom={cameraZoom}
                  themeHex={theme === 'dark' ? '#1e293b' : '#ffffff'}
                  nodeScale={node.scale * debouncedScaleMultiplier}
                />
              );
            })}
          </Canvas>
        </div>
      </motion.div>
    </SoulNetErrorBoundary>
  );
}
