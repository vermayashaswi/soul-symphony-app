
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const Onboarding: React.FC = () => {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Welcome to SOULo</h1>
          <p className="text-muted-foreground">
            Let's get you set up for your journaling journey
          </p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Account Setup</CardTitle>
            <CardDescription>
              Personalize your SOULo experience
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Onboarding flow coming soon...
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Onboarding;
