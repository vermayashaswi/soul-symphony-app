import React, { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Node,
  Edge,
  MarkerType,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useTheme } from '@/hooks/use-theme';
import { useIsMobile } from '@/hooks/use-mobile';
import { TimeRange } from '@/hooks/use-insights-data';
import { JournalEntry } from '@/types/journal';
import { useAuth } from '@/contexts/AuthContext';
import { Network } from 'lucide-react';

// Node types for different levels in the mind map
enum NodeLevel {
  ROOT = 'root',
  ENTITY_TYPE = 'entity_type',
  ENTITY = 'entity',
  EMOTION = 'emotion',
}

// Entity types we want to visualize
const ENTITY_TYPES = ['person', 'location', 'organization', 'event', 'work_of_art', 'other'];

interface EntityMindMapProps {
  entries: JournalEntry[];
  timeRange: TimeRange;
}

// Custom node styles based on type
const getNodeStyle = (nodeType: NodeLevel, theme: string) => {
  const baseStyle = {
    padding: '10px',
    borderRadius: '50%',
    width: nodeType === NodeLevel.ROOT ? 100 : 80,
    height: nodeType === NodeLevel.ROOT ? 100 : 80,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center' as const,
    fontSize: nodeType === NodeLevel.ROOT ? '14px' : '12px',
    fontWeight: nodeType === NodeLevel.ROOT ? 'bold' : 'normal',
    cursor: 'pointer',
  };

  const isDark = theme === 'dark';

  // Different colors for different node types
  switch (nodeType) {
    case NodeLevel.ROOT:
      return {
        ...baseStyle,
        background: isDark ? '#6366f1' : '#818cf8',
        color: 'white',
        boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.4)',
      };
    case NodeLevel.ENTITY_TYPE:
      return {
        ...baseStyle,
        background: isDark ? '#2dd4bf' : '#5eead4',
        color: isDark ? 'white' : '#134e4a',
        boxShadow: '0 4px 6px -1px rgba(45, 212, 191, 0.4)',
      };
    case NodeLevel.ENTITY:
      return {
        ...baseStyle,
        background: isDark ? '#fb923c' : '#fdba74',
        color: isDark ? 'white' : '#7c2d12',
        boxShadow: '0 4px 6px -1px rgba(251, 146, 60, 0.4)',
      };
    case NodeLevel.EMOTION:
      return {
        ...baseStyle,
        background: isDark ? '#c084fc' : '#d8b4fe',
        color: isDark ? 'white' : '#581c87',
        boxShadow: '0 4px 6px -1px rgba(192, 132, 252, 0.4)',
        borderRadius: '8px',
        width: 70,
        height: 40,
        fontSize: '11px',
      };
    default:
      return baseStyle;
  }
};

const EntityMindMap: React.FC<EntityMindMapProps> = ({ entries, timeRange }) => {
  const { theme } = useTheme();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Process entities from journal entries
  const processEntityData = useCallback(() => {
    // Count entities by type and name
    const entityCounts: Record<string, Record<string, number>> = {};
    const entityEmotions: Record<string, Record<string, Record<string, number>>> = {};
    
    // Initialize all entity types
    ENTITY_TYPES.forEach(type => {
      entityCounts[type] = {};
      entityEmotions[type] = {};
    });

    // Process each entry
    entries.forEach(entry => {
      if (!entry.entities || entry.entities.length === 0) return;
      
      // Process entities
      entry.entities.forEach(entity => {
        const entityType = entity.type.toLowerCase();
        const entityName = entity.name.toLowerCase();
        
        // Skip if not one of our target entity types
        if (!ENTITY_TYPES.includes(entityType)) return;
        
        // Count entity occurrences
        if (!entityCounts[entityType][entityName]) {
          entityCounts[entityType][entityName] = 0;
        }
        entityCounts[entityType][entityName] += 1;
        
        // Track emotions associated with this entity
        if (entry.emotions) {
          if (!entityEmotions[entityType][entityName]) {
            entityEmotions[entityType][entityName] = {};
          }
          
          Object.entries(entry.emotions).forEach(([emotion, intensity]) => {
            if (!entityEmotions[entityType][entityName][emotion]) {
              entityEmotions[entityType][entityName][emotion] = 0;
            }
            // Add emotion intensity to this entity
            entityEmotions[entityType][entityName][emotion] += 
              typeof intensity === 'number' ? intensity : parseFloat(intensity.toString());
          });
        }
      });
    });
    
    return { entityCounts, entityEmotions };
  }, [entries]);

  // Build nodes and edges based on entity data
  const buildGraph = useCallback(() => {
    const { entityCounts, entityEmotions } = processEntityData();
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    
    // Create root node (user)
    const rootNodeId = 'root';
    newNodes.push({
      id: rootNodeId,
      data: { label: `${user?.email?.split('@')[0] || 'Your'}'s Soul` },
      position: { x: 0, y: 0 },
      type: 'default',
      style: getNodeStyle(NodeLevel.ROOT, theme)
    });
    
    // Add entity type nodes - first level
    let angleStep = (2 * Math.PI) / ENTITY_TYPES.length;
    let radius = 200;
    
    ENTITY_TYPES.forEach((entityType, index) => {
      const nodeId = `type-${entityType}`;
      const angle = index * angleStep;
      
      // Calculate position in a circle around the root
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);
      
      // Format the label (capitalize, replace underscores)
      const formattedLabel = entityType
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
      
      // Add entity type node
      newNodes.push({
        id: nodeId,
        data: { label: formattedLabel },
        position: { x, y },
        type: 'default',
        style: getNodeStyle(NodeLevel.ENTITY_TYPE, theme)
      });
      
      // Connect root to entity type
      newEdges.push({
        id: `edge-root-${nodeId}`,
        source: rootNodeId,
        target: nodeId,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: '#9ca3af' }
      });
      
      // If this node is expanded, add its child nodes (specific entities)
      if (expandedNodes.has(nodeId)) {
        const entities = Object.entries(entityCounts[entityType])
          .sort((a, b) => b[1] - a[1]) // Sort by count
          .slice(0, 3); // Get top 3
        
        if (entities.length > 0) {
          // Add entity nodes - second level
          const entityAngleStep = (Math.PI / 2) / Math.max(entities.length, 1);
          const entityRadius = 120;
          
          entities.forEach((entity, entityIndex) => {
            const [entityName, entityCount] = entity;
            const entityNodeId = `entity-${entityType}-${entityName}`;
            
            // Position in a segment around the entity type node
            const entityAngle = angle - Math.PI/4 + entityIndex * entityAngleStep;
            const entityX = x + entityRadius * Math.cos(entityAngle);
            const entityY = y + entityRadius * Math.sin(entityAngle);
            
            // Capitalize entity name
            const formattedEntityName = entityName
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
            
            // Add entity node
            newNodes.push({
              id: entityNodeId,
              data: { label: formattedEntityName },
              position: { x: entityX, y: entityY },
              type: 'default',
              style: getNodeStyle(NodeLevel.ENTITY, theme)
            });
            
            // Connect entity type to entity
            newEdges.push({
              id: `edge-${nodeId}-${entityNodeId}`,
              source: nodeId,
              target: entityNodeId,
              markerEnd: { type: MarkerType.ArrowClosed },
              style: { stroke: '#9ca3af' }
            });
            
            // If this entity node is expanded, add its emotions - third level
            if (expandedNodes.has(entityNodeId) && entityEmotions[entityType][entityName]) {
              const emotions = Object.entries(entityEmotions[entityType][entityName])
                .sort((a, b) => b[1] - a[1]) // Sort by intensity
                .slice(0, 5); // Get top 5
              
              if (emotions.length > 0) {
                const emotionAngleStep = (Math.PI / 2) / Math.max(emotions.length, 1);
                const emotionRadius = 100;
                
                emotions.forEach((emotion, emotionIndex) => {
                  const [emotionName, intensity] = emotion;
                  const emotionNodeId = `emotion-${entityType}-${entityName}-${emotionName}`;
                  
                  // Position in a segment around the entity node
                  const emotionAngle = entityAngle - Math.PI/4 + emotionIndex * emotionAngleStep;
                  const emotionX = entityX + emotionRadius * Math.cos(emotionAngle);
                  const emotionY = entityY + emotionRadius * Math.sin(emotionAngle);
                  
                  // Capitalize emotion name
                  const formattedEmotionName = emotionName
                    .charAt(0).toUpperCase() + emotionName.slice(1);
                  
                  // Add emotion node
                  newNodes.push({
                    id: emotionNodeId,
                    data: { label: formattedEmotionName },
                    position: { x: emotionX, y: emotionY },
                    type: 'default',
                    style: getNodeStyle(NodeLevel.EMOTION, theme)
                  });
                  
                  // Connect entity to emotion
                  newEdges.push({
                    id: `edge-${entityNodeId}-${emotionNodeId}`,
                    source: entityNodeId,
                    target: emotionNodeId,
                    markerEnd: { type: MarkerType.ArrowClosed },
                    style: { stroke: '#9ca3af' }
                  });
                });
              }
            }
          });
        }
      }
    });
    
    return { newNodes, newEdges };
  }, [expandedNodes, processEntityData, theme, user]);

  // Handle node click to expand/collapse
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(node.id)) {
        newSet.delete(node.id);
      } else {
        newSet.add(node.id);
      }
      return newSet;
    });
  }, []);

  // Update graph when relevant data changes
  useEffect(() => {
    const { newNodes, newEdges } = buildGraph();
    setNodes(newNodes);
    setEdges(newEdges);
  }, [buildGraph, timeRange, expandedNodes, theme]);

  return (
    <Card className="rounded-xl border shadow-sm mb-8">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg md:text-xl font-bold">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            <span>Entities Mind Map</span>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        {entries.length === 0 ? (
          <div className="h-[350px] flex items-center justify-center">
            <p className="text-muted-foreground">No entity data available for this period</p>
          </div>
        ) : (
          <div style={{ height: isMobile ? 350 : 500 }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              fitView
              attributionPosition="bottom-right"
            >
              <Controls position="bottom-right" />
              <MiniMap 
                position="bottom-left" 
                zoomable
                pannable
                nodeColor={(node) => {
                  if (node.style?.background) return node.style.background as string;
                  return '#d9e1ff';
                }}
              />
              <Background variant={BackgroundVariant.DOTS} gap={12} size={1} />
            </ReactFlow>
            <div className="text-xs text-muted-foreground mt-2 text-center">
              Click on nodes to expand/collapse. Use mouse wheel to zoom, drag to pan.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EntityMindMap;
