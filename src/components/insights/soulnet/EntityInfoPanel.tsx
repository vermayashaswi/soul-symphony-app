
import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/hooks/use-theme';

interface EntityInfoPanelProps {
  selectedEntity: string | null;
  entityData: Record<string, {emotions: Record<string, number>}>;
}

export const EntityInfoPanel: React.FC<EntityInfoPanelProps> = ({ selectedEntity, entityData }) => {
  const { theme } = useTheme();
  if (!selectedEntity || !entityData[selectedEntity]) return null;
  const entityInfo = entityData[selectedEntity];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={`
        absolute top-4 right-4 p-3 rounded-lg shadow-lg max-w-[250px] max-h-[40vh] overflow-y-auto
        ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}
        sm:right-2 sm:max-w-[160px] sm:top-2 sm:p-1
      `}
      style={{
        width: '90vw',
        maxWidth: 320,
        // Responsive: on small screens use even smaller
      }}
    >
      <h3 className="text-lg font-bold mb-2 pb-2 border-b">{selectedEntity}</h3>
      <h4 className="text-sm font-semibold mt-2 mb-1">Top Emotions</h4>
      <div className="space-y-1">
        {Object.entries(entityInfo.emotions)
          .sort(([, a], [, b]) => b - a)
          .map(([emotion, score]) => (
            <div key={emotion} className="flex items-center justify-between">
              <span className="text-sm">{emotion}</span>
              <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: `${Math.min(score * 100, 100)}%`,
                    backgroundColor: theme === 'dark' ? '#8b5cf6' : '#8b5cf6',
                  }}
                />
              </div>
            </div>
          ))}
      </div>
    </motion.div>
  );
};
