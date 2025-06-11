
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, AlertTriangle } from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ 
  children, 
  title = "Admin Panel",
  description = "Administrative tools and settings"
}) => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <div className="flex items-center space-x-2 mb-4">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          </div>
          <p className="text-muted-foreground">{description}</p>
          
          <Card className="mt-4 border-amber-200 bg-amber-50/50">
            <CardContent className="pt-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <p className="text-sm text-amber-800">
                  <strong>Admin Access:</strong> This is an administrative interface. 
                  Changes made here will affect all users of the application.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {children}
      </div>
    </div>
  );
};

export default AdminLayout;
