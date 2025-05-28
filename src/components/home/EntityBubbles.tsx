
import React from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface EntityBubblesProps {
  entities?: any[];
}

const EntityBubbles: React.FC<EntityBubblesProps> = ({ entities = [] }) => {
  const { user } = useAuth();

  const { data: journalEntities = [] } = useQuery({
    queryKey: ['journal-entities', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('Journal Entries')
        .select('entities')
        .eq('user_id', user.id)
        .not('entities', 'is', null);

      if (error) {
        console.error('Error fetching entities:', error);
        return [];
      }

      // Extract all entities from journal entries
      const allEntities = data.flatMap(entry => 
        entry.entities ? Object.keys(entry.entities) : []
      );

      // Get unique entities
      return [...new Set(allEntities)];
    },
    enabled: !!user?.id,
  });

  const displayEntities = entities.length > 0 ? entities : journalEntities;

  if (displayEntities.length === 0) {
    return null;
  }

  return (
    <div className="relative h-32 overflow-hidden rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
      <div className="flex flex-wrap gap-2 p-4">
        {displayEntities.slice(0, 8).map((entity, index) => (
          <motion.div
            key={entity}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className="px-3 py-1 bg-white/70 dark:bg-gray-800/70 rounded-full text-sm font-medium text-gray-700 dark:text-gray-300 backdrop-blur-sm"
          >
            {entity}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default EntityBubbles;
