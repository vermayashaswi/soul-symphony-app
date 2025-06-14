
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const Focus: React.FC = () => {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Focus Mode</h1>
          <p className="text-muted-foreground">
            Dedicated space for focused journaling and reflection
          </p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Focus Mode</CardTitle>
            <CardDescription>
              Enhanced journaling experience with minimal distractions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Focus mode functionality coming soon...
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Focus;
