
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

interface RobustFallbackVisualizationProps {
  data: { nodes: NodeData[], links: LinkData[] };
  themeHex: string;
  selectedNode?: string | null;
  onNodeClick?: (id: string) => void;
}

export const RobustFallbackVisualization: React.FC<RobustFallbackVisualizationProps> = ({
  data,
  themeHex,
  selectedNode,
  onNodeClick
}) => {
  const entities = data.nodes.filter(node => node.type === 'entity');
  const emotions = data.nodes.filter(node => node.type === 'emotion');

  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg overflow-hidden">
      <div className="p-6 h-full flex flex-col">
        <div className="text-center mb-6">
          <h3 className="text-xl font-semibold text-white mb-2">
            <TranslatableText text="Soul-Net Network" />
          </h3>
          <p className="text-gray-300 text-sm">
            <TranslatableText text="Explore the connections between your thoughts and emotions" />
          </p>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Entities Column */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-white border-b border-gray-600 pb-2">
              <TranslatableText text="Key Topics" />
            </h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {entities.map((entity) => {
                const isSelected = selectedNode === entity.id;
                const connections = data.links.filter(
                  link => link.source === entity.id || link.target === entity.id
                ).length;

                return (
                  <div
                    key={entity.id}
                    className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                      isSelected 
                        ? 'bg-white text-gray-900 shadow-lg transform scale-105' 
                        : 'bg-gray-700 text-white hover:bg-gray-600'
                    }`}
                    style={isSelected ? { backgroundColor: themeHex, color: '#ffffff' } : {}}
                    onClick={() => onNodeClick?.(entity.id)}
                  >
                    <div className="font-medium">{entity.id}</div>
                    <div className="text-sm opacity-75">
                      <TranslatableText text={`${connections} connections`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Emotions Column */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-white border-b border-gray-600 pb-2">
              <TranslatableText text="Emotions" />
            </h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {emotions.map((emotion) => {
                const isSelected = selectedNode === emotion.id;
                const connections = data.links.filter(
                  link => link.source === emotion.id || link.target === emotion.id
                ).length;

                return (
                  <div
                    key={emotion.id}
                    className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                      isSelected 
                        ? 'bg-white text-gray-900 shadow-lg transform scale-105' 
                        : 'bg-gray-700 text-white hover:bg-gray-600'
                    }`}
                    style={isSelected ? { backgroundColor: themeHex, color: '#ffffff' } : {}}
                    onClick={() => onNodeClick?.(emotion.id)}
                  >
                    <div className="font-medium">{emotion.id}</div>
                    <div className="text-sm opacity-75">
                      <TranslatableText text={`${connections} connections`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {selectedNode && (
          <div className="mt-6 p-4 bg-gray-800 rounded-lg border-2" style={{ borderColor: themeHex }}>
            <h5 className="text-white font-medium mb-2">
              <TranslatableText text="Selected:" /> {selectedNode}
            </h5>
            <div className="text-gray-300 text-sm">
              <TranslatableText text="Click another node to see its connections, or click the same node to deselect." />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RobustFallbackVisualization;
