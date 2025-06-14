
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const Tutorial: React.FC = () => {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Tutorial</h1>
          <p className="text-muted-foreground">
            Learn how to use SOULo effectively
          </p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>
              Step-by-step guide to voice journaling
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Interactive tutorial coming soon...
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Tutorial;
