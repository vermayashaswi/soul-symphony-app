
import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/hooks/use-theme';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface EntityInfoPanelProps {
  selectedEntity: string | null;
  entityData: Record<string, {emotions: Record<string, number>}>;
}

export const EntityInfoPanel: React.FC<EntityInfoPanelProps> = ({ selectedEntity, entityData }) => {
  // Defensive theme access
  let theme = 'light';
  try {
    const themeData = useTheme();
    theme = themeData.theme;
  } catch (error) {
    console.warn('Theme provider not available, using default theme');
  }
  
  if (!selectedEntity || !entityData[selectedEntity]) return null;
  const entityInfo = entityData[selectedEntity];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={`
        absolute top-2 right-2 p-2 rounded-lg shadow-lg
        ${theme === 'dark' ? 'bg-gray-800/95 text-white' : 'bg-white/95 text-gray-800'}
        backdrop-blur-sm
        max-w-[180px] max-h-[35vh]
        overflow-y-auto
        border border-border/50
        z-[10000]
      `}
    >
      <h3 className="text-base font-semibold mb-1 pb-1 border-b border-border/30">
        <TranslatableText text={selectedEntity} forceTranslate={true} />
      </h3>
      <div className="space-y-1">
        {Object.entries(entityInfo.emotions)
          .sort(([, a], [, b]) => b - a)
          .map(([emotion, score]) => (
            <div key={emotion} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-xs truncate flex-1">
                <TranslatableText text={emotion} forceTranslate={true} />
              </span>
              <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex-shrink-0">
                <div
                  className="h-full transition-all"
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
