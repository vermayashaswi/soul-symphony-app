
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import FeatureFlagAdmin from '@/components/admin/FeatureFlagAdmin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Flag, Users, Settings } from 'lucide-react';

const Admin: React.FC = () => {
  const { user } = useAuth();

  // For now, we'll check if user exists. In production, you'd want proper admin role checks
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <AdminLayout 
      title="SOULo Admin Panel"
      description="Manage feature flags, user settings, and system configuration"
    >
      <Tabs defaultValue="feature-flags" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="feature-flags" className="flex items-center space-x-2">
            <Flag className="h-4 w-4" />
            <span>Feature Flags</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center space-x-2">
            <Users className="h-4 w-4" />
            <span>Users</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center space-x-2">
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feature-flags">
          <FeatureFlagAdmin />
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Manage user accounts and permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                User management interface coming soon...
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <CardDescription>
                Configure system-wide settings and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                System settings interface coming soon...
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
};

export default Admin;
