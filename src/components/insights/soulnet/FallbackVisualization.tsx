
import React from 'react';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface NodeData {
  id: string;
  type: 'entity' | 'emotion';
  value: number;
  color: string;
  position: [number, number, number];
}

interface LinkData {
  source: string;
  target: string;
  value: number;
}

interface FallbackVisualizationProps {
  data: { nodes: NodeData[]; links: LinkData[] };
  selectedNode: string | null;
  onNodeClick: (id: string) => void;
  themeHex: string;
}

export const FallbackVisualization: React.FC<FallbackVisualizationProps> = ({
  data,
  selectedNode,
  onNodeClick,
  themeHex
}) => {
  const entities = data.nodes.filter(node => node.type === 'entity');
  const emotions = data.nodes.filter(node => node.type === 'emotion');

  const getConnectedNodes = (nodeId: string) => {
    return data.links
      .filter(link => link.source === nodeId || link.target === nodeId)
      .map(link => link.source === nodeId ? link.target : link.source);
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold mb-2">
          <TranslatableText text="Soul-Net Connection Map" />
        </h3>
        <p className="text-sm text-muted-foreground">
          <TranslatableText text="Explore connections between entities and emotions" />
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
        {/* Entities Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <h4 className="font-medium mb-3 text-blue-600 dark:text-blue-400">
            <TranslatableText text="Life Areas" />
          </h4>
          <div className="space-y-2">
            {entities.map(entity => {
              const isSelected = selectedNode === entity.id;
              const connections = getConnectedNodes(entity.id);
              
              return (
                <button
                  key={entity.id}
                  onClick={() => onNodeClick(entity.id)}
                  className={`w-full text-left p-3 rounded-md transition-all ${
                    isSelected 
                      ? 'bg-blue-100 dark:bg-blue-900 border-2 border-blue-500' 
                      : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                >
                  <div className="font-medium">{entity.id}</div>
                  <div className="text-xs text-muted-foreground">
                    {connections.length} connections
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Emotions Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <h4 className="font-medium mb-3 text-purple-600 dark:text-purple-400">
            <TranslatableText text="Emotions" />
          </h4>
          <div className="space-y-2">
            {emotions.map(emotion => {
              const isSelected = selectedNode === emotion.id;
              const connections = getConnectedNodes(emotion.id);
              
              return (
                <button
                  key={emotion.id}
                  onClick={() => onNodeClick(emotion.id)}
                  className={`w-full text-left p-3 rounded-md transition-all ${
                    isSelected 
                      ? 'bg-purple-100 dark:bg-purple-900 border-2 border-purple-500' 
                      : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                >
                  <div className="font-medium">{emotion.id}</div>
                  <div className="text-xs text-muted-foreground">
                    {connections.length} connections
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Connection Details */}
      {selectedNode && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm w-full max-w-2xl">
          <h4 className="font-medium mb-3">
            <TranslatableText text={`Connections for "${selectedNode}"`} />
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {getConnectedNodes(selectedNode).map(connectedId => {
              const connectedNode = data.nodes.find(n => n.id === connectedId);
              if (!connectedNode) return null;
              
              return (
                <button
                  key={connectedId}
                  onClick={() => onNodeClick(connectedId)}
                  className="text-left p-2 rounded bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600"
                >
                  <span className={`text-sm ${
                    connectedNode.type === 'entity' ? 'text-blue-600' : 'text-purple-600'
                  }`}>
                    {connectedId}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default FallbackVisualization;
