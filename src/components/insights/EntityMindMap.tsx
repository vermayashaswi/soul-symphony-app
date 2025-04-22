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

enum NodeLevel {
  ROOT = 'root',
  ENTITY = 'entity',
  EMOTION = 'emotion',
}

const ENTITY_TYPES = ['person', 'location', 'organization', 'event', 'work_of_art', 'other'];

interface EntityMindMapProps {
  entries: JournalEntry[];
  timeRange: TimeRange;
}

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

  switch (nodeType) {
    case NodeLevel.ROOT:
      return {
        ...baseStyle,
        background: isDark ? '#6366f1' : '#818cf8',
        color: 'white',
        boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.4)',
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

  const processEntityData = useCallback(() => {
    const entityCounts: Record<string, { count: number, type: string }> = {};
    const entityEmotions: Record<string, Record<string, number>> = {};

    entries.forEach(entry => {
      if (!entry.entities || entry.entities.length === 0) return;
      entry.entities.forEach(entity => {
        const entityType = entity.type.toLowerCase();
        const entityName = entity.name.toLowerCase();
        const entityKey = `${entityType}::${entityName}`;
        if (!entityCounts[entityKey]) {
          entityCounts[entityKey] = { count: 0, type: entityType };
        }
        entityCounts[entityKey].count += 1;

        if (entry.emotions && typeof entry.emotions === 'object') {
          if (!entityEmotions[entityKey]) {
            entityEmotions[entityKey] = {};
          }
          Object.entries(entry.emotions).forEach(([emotion, intensity]) => {
            if (!entityEmotions[entityKey][emotion]) {
              entityEmotions[entityKey][emotion] = 0;
            }
            entityEmotions[entityKey][emotion] += typeof intensity === 'number' ? intensity : parseFloat(intensity.toString());
          });
        }
      });
    });

    const entityArray = Object.entries(entityCounts)
      .map(([key, value]) => ({
        entityKey: key,
        entityType: value.type,
        entityName: key.split('::')[1],
        count: value.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return { entityArray, entityEmotions };
  }, [entries]);

  const buildGraph = useCallback(() => {
    const { entityArray, entityEmotions } = processEntityData();
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    const rootNodeId = 'root';
    newNodes.push({
      id: rootNodeId,
      data: { label: `${user?.email?.split('@')[0] || 'Your'}'s Soul` },
      position: { x: 0, y: 0 },
      type: 'default',
      style: getNodeStyle(NodeLevel.ROOT, theme)
    });

    const entityCount = entityArray.length;
    const angleStep = (2 * Math.PI) / entityCount;
    const radius = 220;

    entityArray.forEach((entity, index) => {
      const { entityKey, entityName } = entity;
      const nodeId = `entity-${entityKey}`;
      const angle = index * angleStep;
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);

      const formattedEntityName = entityName
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      newNodes.push({
        id: nodeId,
        data: { label: formattedEntityName },
        position: { x, y },
        type: 'default',
        style: getNodeStyle(NodeLevel.ENTITY, theme)
      });

      newEdges.push({
        id: `edge-root-${nodeId}`,
        source: rootNodeId,
        target: nodeId,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: '#9ca3af' }
      });

      if (expandedNodes.has(nodeId)) {
        const emotions = entityEmotions[entityKey]
          ? Object.entries(entityEmotions[entityKey]).sort((a, b) => b[1] - a[1]).slice(0, 5)
          : [];
        if (emotions.length > 0) {
          const emotionAngleStep = (Math.PI / 2) / Math.max(emotions.length, 1);
          const emotionRadius = 110;
          emotions.forEach((emotion, emotionIndex) => {
            const [emotionName, intensity] = emotion;
            const emotionNodeId = `emotion-${entityKey}-${emotionName}`;
            const emotionAngle = angle - Math.PI / 4 + emotionIndex * emotionAngleStep;
            const emotionX = x + emotionRadius * Math.cos(emotionAngle);
            const emotionY = y + emotionRadius * Math.sin(emotionAngle);
            const formattedEmotionName = emotionName.charAt(0).toUpperCase() + emotionName.slice(1);

            newNodes.push({
              id: emotionNodeId,
              data: { label: formattedEmotionName },
              position: { x: emotionX, y: emotionY },
              type: 'default',
              style: getNodeStyle(NodeLevel.EMOTION, theme)
            });

            newEdges.push({
              id: `edge-${nodeId}-${emotionNodeId}`,
              source: nodeId,
              target: emotionNodeId,
              markerEnd: { type: MarkerType.ArrowClosed },
              style: { stroke: '#9ca3af' }
            });
          });
        }
      }
    });

    return { newNodes, newEdges };
  }, [expandedNodes, processEntityData, theme, user]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(node.id)) newSet.delete(node.id);
      else newSet.add(node.id);
      return newSet;
    });
  }, []);

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
              <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
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
