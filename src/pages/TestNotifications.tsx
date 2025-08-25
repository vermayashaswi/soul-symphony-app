import React from 'react';
import { NotificationTest } from '@/components/test/NotificationTest';

const TestNotifications: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Notification Service Testing</h1>
          <p className="text-muted-foreground mt-2">
            Test and diagnose notification delivery issues in different environments
          </p>
        </div>
        
        <NotificationTest />
      </div>
    </div>
  );
};

export default TestNotifications;