
import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const Legal: React.FC = () => {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">Legal Information</h1>
          <p className="text-muted-foreground">
            Please review our legal documents below
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Privacy Policy</h2>
            <p className="text-muted-foreground mb-4">
              Learn how we collect, use, and protect your personal information.
            </p>
            <Link to="/privacy-policy">
              <Button className="w-full">Read Privacy Policy</Button>
            </Link>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Terms of Service</h2>
            <p className="text-muted-foreground mb-4">
              Understand the terms and conditions for using our service.
            </p>
            <Link to="/terms-of-service">
              <Button className="w-full">Read Terms of Service</Button>
            </Link>
          </Card>
        </div>

        <div className="text-center mt-8">
          <Link to="/app">
            <Button variant="outline">Continue to App</Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Legal;
