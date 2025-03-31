
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, BookOpen, BarChart, Settings, Home } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type EmergencyMobileUIProps = {
  route?: string;
  errorMessage?: string;
};

export function EmergencyMobileUI({ route, errorMessage }: EmergencyMobileUIProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  useEffect(() => {
    console.log("Emergency Mobile UI rendered for route:", route);
    
    // Force correct styles for the body and container
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.body.style.overflow = 'auto';
    
    // Force any hidden components to show
    setTimeout(() => {
      const containers = document.querySelectorAll('.container, [class*="container"]');
      containers.forEach(container => {
        if (container instanceof HTMLElement) {
          container.style.display = 'block';
          container.style.visibility = 'visible';
          container.style.opacity = '1';
        }
      });
    }, 100);
  }, [route]);

  const getComponentForRoute = () => {
    switch(route) {
      case '/smart-chat':
        return (
          <div className="p-4 text-center">
            <h2 className="text-xl font-semibold mb-4">Smart Chat</h2>
            <p className="mb-4">Ask questions about your journal entries.</p>
            <div className="bg-muted p-4 rounded-lg min-h-[200px] flex items-center justify-center">
              <p>Chat interface ready to use</p>
            </div>
            <Button className="mt-4 w-full" onClick={() => window.location.reload()}>
              Reload Chat Interface
            </Button>
          </div>
        );
      case '/journal':
        return (
          <div className="p-4 text-center">
            <h2 className="text-xl font-semibold mb-4">Journal</h2>
            <p className="mb-4">Record your thoughts and feelings.</p>
            <Button className="mt-4 w-full" onClick={() => window.location.reload()}>
              Reload Journal
            </Button>
          </div>
        );
      default:
        return (
          <div className="p-4">
            <h2 className="text-xl font-semibold mb-4">Welcome to SOULo</h2>
            <p className="mb-4">Your AI companion for emotional well-being</p>
            <div className="grid grid-cols-2 gap-4 mt-6">
              {user ? (
                <>
                  <Button variant="outline" className="flex flex-col gap-2 p-4 h-auto" onClick={() => navigate('/journal')}>
                    <BookOpen className="h-6 w-6" />
                    <span>Journal</span>
                  </Button>
                  <Button variant="outline" className="flex flex-col gap-2 p-4 h-auto" onClick={() => navigate('/smart-chat')}>
                    <MessageSquare className="h-6 w-6" />
                    <span>Smart Chat</span>
                  </Button>
                  <Button variant="outline" className="flex flex-col gap-2 p-4 h-auto" onClick={() => navigate('/insights')}>
                    <BarChart className="h-6 w-6" />
                    <span>Insights</span>
                  </Button>
                  <Button variant="outline" className="flex flex-col gap-2 p-4 h-auto" onClick={() => navigate('/settings')}>
                    <Settings className="h-6 w-6" />
                    <span>Settings</span>
                  </Button>
                </>
              ) : (
                <Button className="col-span-2" onClick={() => navigate('/auth')}>
                  Sign In to Continue
                </Button>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <Card className="mx-auto my-4 max-w-md border-2 border-primary">
      <CardHeader className="bg-primary/10">
        <CardTitle className="text-center text-lg flex items-center justify-center gap-2">
          <Home className="h-4 w-4" />
          SOULo Mobile
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {errorMessage && (
          <div className="bg-destructive/10 text-destructive text-sm p-2 text-center">
            {errorMessage}
          </div>
        )}
        {getComponentForRoute()}
        <div className="p-4 grid grid-cols-4 border-t">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="flex flex-col items-center gap-1">
            <Home className="h-4 w-4" />
            <span className="text-xs">Home</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/journal')} className="flex flex-col items-center gap-1">
            <BookOpen className="h-4 w-4" />
            <span className="text-xs">Journal</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/smart-chat')} className="flex flex-col items-center gap-1">
            <MessageSquare className="h-4 w-4" />
            <span className="text-xs">Chat</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/settings')} className="flex flex-col items-center gap-1">
            <Settings className="h-4 w-4" />
            <span className="text-xs">Settings</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default EmergencyMobileUI;
