
import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const TermsOfServicePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">Terms of Service</h1>
          <p className="text-muted-foreground">
            Please read these terms carefully before using our service
          </p>
        </div>

        <Card className="p-8">
          <div className="prose max-w-none">
            <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p className="mb-6">
              By accessing and using this service, you accept and agree to be bound by the terms 
              and provision of this agreement.
            </p>

            <h2 className="text-2xl font-semibold mb-4">2. Use License</h2>
            <p className="mb-6">
              Permission is granted to temporarily download one copy of the materials on this 
              service for personal, non-commercial transitory viewing only.
            </p>

            <h2 className="text-2xl font-semibold mb-4">3. Disclaimer</h2>
            <p className="mb-6">
              The materials on this service are provided on an 'as is' basis. We make no 
              warranties, expressed or implied, and hereby disclaim and negate all other 
              warranties including without limitation, implied warranties or conditions of 
              merchantability, fitness for a particular purpose, or non-infringement of 
              intellectual property or other violation of rights.
            </p>

            <h2 className="text-2xl font-semibold mb-4">4. Limitations</h2>
            <p className="mb-6">
              In no event shall our company or its suppliers be liable for any damages 
              (including, without limitation, damages for loss of data or profit, or due to 
              business interruption) arising out of the use or inability to use the materials 
              on this service.
            </p>

            <h2 className="text-2xl font-semibold mb-4">5. Privacy Policy</h2>
            <p className="mb-6">
              Your privacy is important to us. Please review our Privacy Policy, which also 
              governs your use of the service, to understand our practices.
            </p>

            <h2 className="text-2xl font-semibold mb-4">6. Contact Information</h2>
            <p className="mb-6">
              If you have any questions about these Terms of Service, please contact us.
            </p>
          </div>
        </Card>

        <div className="text-center mt-8">
          <Link to="/app">
            <Button variant="outline">Continue to App</Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default TermsOfServicePage;
