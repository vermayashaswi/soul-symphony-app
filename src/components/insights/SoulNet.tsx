
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
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/contexts/TranslationContext';
import { useToast } from "@/components/ui/use-toast"
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

export default function SoulNet({ userId, timeRange }: SoulNetProps) {
  const [data, setData] = useState<{ nodes: any[]; edges: any[] } | null>(null);
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
  const [initialCameraPosition, setInitialCameraPosition] = useState<THREE.Vector3>(new THREE.Vector3(0, 0, 5));
  const [initialTargetPosition, setInitialTargetPosition] = useState<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const [isInitialLoad, setIsInitialLoad] = useState(true);

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
      const response = await fetch(`/api/v1/insights/soulnet?userId=${userId}&timeRange=${timeRange}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      setData(result);
      console.log("[SoulNet] Data fetched successfully:", result);
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
          const createdAt = new Date(node.created_at);
          if (!acc.min || createdAt < acc.min) {
            acc.min = createdAt;
          }
          if (!acc.max || createdAt > acc.max) {
            acc.max = createdAt;
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
          if (!dateRange?.from || !dateRange?.to) return true;
          const createdAt = new Date(node.created_at);
          return createdAt >= dateRange.from && createdAt <= dateRange.to;
        });

        const nodeMap: { [key: string]: any } = {};
        filteredNodes.forEach((node: any) => {
          nodeMap[node.id] = {
            id: node.id,
            x: parseFloat(node.x) || 0,
            y: parseFloat(node.y) || 0,
            z: parseFloat(node.z) || 0,
            scale: parseFloat(node.scale) || 1,
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
          strength: parseFloat(edge.strength) || 0.5
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
    // Handle pointer down event
    e.stopPropagation();
  };

  const handleNodePointerUp = (e: any) => {
    // Handle pointer up event
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
                    onPointerDown={handleNodePointerDown}
                    onPointerUp={handleNodePointerUp}
                    onPointerOut={handleNodePointerOut}
                    onPointerLeave={handleNodePointerLeave}
                  />
                </group>
              );
            })}
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
