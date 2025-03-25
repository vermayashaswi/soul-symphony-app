
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, ChartBar } from 'lucide-react';
import { motion } from 'framer-motion';

interface JournalHeaderProps {
  onCreateJournal: () => void;
  onViewInsights: () => void;
}

export default function JournalHeader({ 
  onCreateJournal, 
  onViewInsights
}: JournalHeaderProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-2xl">Journal</CardTitle>
            <CardDescription>
              Record your thoughts and feelings to track your emotional wellbeing
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={onViewInsights}
              variant="outline"
              size="sm"
            >
              <ChartBar className="h-4 w-4 mr-2" />
              Insights
            </Button>
            
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button onClick={onCreateJournal}>
                <Plus className="h-4 w-4 mr-2" />
                New Journal
              </Button>
            </motion.div>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
