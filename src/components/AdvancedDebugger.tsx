import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Maximize2, Minimize2, Terminal, Database, RefreshCw, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type OperationStatus = {
  operation: string;
  status: 'pending' | 'success' | 'error';
  startTime: Date;
  endTime?: Date;
  details?: string;
  error?: string;
};

export function AdvancedDebugger() {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [operations, setOperations] = useState<OperationStatus[]>([]);
  const [activeTab, setActiveTab] = useState('operations');
  const [supabaseHealth, setSupabaseHealth] = useState<Record<string, boolean>>({});
  const [tableChecks, setTableChecks] = useState<Record<string, boolean>>({});
  const logRef = useRef<HTMLDivElement>(null);
  
  // Check if we're in a development environment
  const isDev = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost';
  
  useEffect(() => {
    if (!isDev) return;
    
    const checkSupabaseHealth = async () => {
      try {
        // Check if we can access the Journal_Entries table (exact name with quotes)
        const journalCheck = await supabase
          .from('"Journal_Entries"')
          .select('id')
          .limit(1);
          
        setTableChecks(prev => ({
          ...prev,
          'Journal_Entries (with quotes)': !journalCheck.error
        }));
        
        if (journalCheck.error) {
          console.error('Error accessing Journal_Entries table with quotes:', journalCheck.error);
        } else {
          console.log('Successfully accessed Journal_Entries table with quotes');
        }
        
        // Check lowercase journal_entries
        const lowercaseCheck = await supabase
          .from('journal_entries')
          .select('id')
          .limit(1);
          
        setTableChecks(prev => ({
          ...prev,
          'journal_entries': !lowercaseCheck.error
        }));
        
        // Check direct name without quotes
        const directCheck = await supabase
          .rpc('table_exists', { table_name: 'Journal_Entries' });
          
        setTableChecks(prev => ({
          ...prev,
          'table_exists(Journal_Entries)': directCheck.data === true
        }));
        
        // Check general Supabase health
        setSupabaseHealth(prev => ({
          ...prev,
          'API Connected': true,
          'Auth Service': true,
        }));
      } catch (error) {
        console.error('Error checking Supabase health:', error);
        setSupabaseHealth({
          'API Connected': false,
          'Auth Service': false,
        });
      }
    };
    
    checkSupabaseHealth();
    
    const handleOperationStart = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { operation, details } = customEvent.detail;
      
      setOperations(prev => [
        ...prev,
        {
          operation,
          status: 'pending',
          startTime: new Date(),
          details,
        },
      ]);
    };
    
    const handleOperationComplete = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { operation, success, details, error } = customEvent.detail;
      
      setOperations(prev => {
        const updatedOperations = [...prev];
        const index = updatedOperations.findIndex(op => 
          op.operation === operation && op.status === 'pending'
        );
        
        if (index !== -1) {
          updatedOperations[index] = {
            ...updatedOperations[index],
            status: success ? 'success' : 'error',
            endTime: new Date(),
            details: details || updatedOperations[index].details,
            error,
          };
        } else {
          updatedOperations.push({
            operation,
            status: success ? 'success' : 'error',
            startTime: new Date(),
            endTime: new Date(),
            details,
            error,
          });
        }
        
        return updatedOperations;
      });
    };
    
    window.addEventListener('operation-start', handleOperationStart);
    window.addEventListener('operation-complete', handleOperationComplete);
    
    return () => {
      window.removeEventListener('operation-start', handleOperationStart);
      window.removeEventListener('operation-complete', handleOperationComplete);
    };
  }, [isDev]);
  
  // Scroll to bottom of log when new operations are added
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [operations]);
  
  if (!isDev) return null;
  
  const refreshTableChecks = async () => {
    try {
      // Check if we can access the Journal_Entries table (exact name with quotes)
      const journalCheck = await supabase
        .from('"Journal_Entries"')
        .select('id')
        .limit(1);
        
      setTableChecks(prev => ({
        ...prev,
        'Journal_Entries (with quotes)': !journalCheck.error
      }));
      
      // Check lowercase journal_entries
      const lowercaseCheck = await supabase
        .from('journal_entries')
        .select('id')
        .limit(1);
        
      setTableChecks(prev => ({
        ...prev,
        'journal_entries': !lowercaseCheck.error
      }));
      
      // Check direct name without quotes
      const directCheck = await supabase
        .rpc('table_exists', { table_name: 'Journal_Entries' });
        
      setTableChecks(prev => ({
        ...prev,
        'table_exists(Journal_Entries)': directCheck.data === true
      }));
    } catch (error) {
      console.error('Error refreshing table checks:', error);
    }
  };
  
  const clearOperations = () => {
    setOperations([]);
  };
  
  const debuggerStyles = isFullScreen
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        width: '100vw',
        height: '100vh',
        margin: 0,
        borderRadius: 0,
      }
    : {
        position: 'fixed',
        bottom: 20,
        right: 20,
        width: 400,
        height: 400,
        zIndex: 1000,
      };
  
  if (!isOpen) {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        className="fixed bottom-4 right-4 z-50"
        onClick={() => setIsOpen(true)}
      >
        <Terminal className="h-4 w-4 mr-2" />
        Debug
      </Button>
    );
  }
  
  return (
    <Card className="shadow-xl" style={debuggerStyles as React.CSSProperties}>
      <CardHeader className="p-3 flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-md flex items-center">
            <Terminal className="h-4 w-4 mr-2" />
            Advanced Debugger
          </CardTitle>
          <CardDescription className="text-xs">
            Troubleshooting Journal Table Issues
          </CardDescription>
        </div>
        <div className="flex space-x-1">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsFullScreen(!isFullScreen)}
          >
            {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <Tabs 
        value={activeTab} 
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="mx-3 mb-2">
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="tables">Tables</TabsTrigger>
          <TabsTrigger value="health">System Health</TabsTrigger>
        </TabsList>
        
        <CardContent className="p-3 pt-0">
          <TabsContent value="operations" className="mt-0">
            <div className="flex justify-between mb-2">
              <div className="text-xs text-muted-foreground">
                {operations.length} operations logged
              </div>
              <Button variant="ghost" size="sm" onClick={clearOperations}>
                Clear
              </Button>
            </div>
            
            <ScrollArea 
              className="h-[300px] border rounded-md p-2" 
              ref={logRef}
            >
              {operations.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No operations logged yet
                </div>
              ) : (
                operations.map((op, index) => (
                  <div 
                    key={index} 
                    className={`mb-2 p-2 rounded text-xs ${
                      op.status === 'error' ? 'bg-red-100 dark:bg-red-900/20' : 
                      op.status === 'success' ? 'bg-green-100 dark:bg-green-900/20' : 
                      'bg-blue-100 dark:bg-blue-900/20'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center">
                        {op.status === 'pending' && <Clock className="h-3 w-3 mr-1 text-blue-500" />}
                        {op.status === 'success' && <CheckCircle className="h-3 w-3 mr-1 text-green-500" />}
                        {op.status === 'error' && <AlertTriangle className="h-3 w-3 mr-1 text-red-500" />}
                        <span className="font-medium">{op.operation}</span>
                      </div>
                      <Badge 
                        variant={
                          op.status === 'error' ? 'destructive' : 
                          op.status === 'success' ? 'default' : 
                          'secondary'
                        }
                        className="text-[10px] h-4"
                      >
                        {op.status}
                      </Badge>
                    </div>
                    
                    {op.details && (
                      <div className="mt-1 ml-4 text-xs text-muted-foreground">
                        {op.details}
                      </div>
                    )}
                    
                    {op.error && (
                      <div className="mt-1 ml-4 text-xs text-red-500 break-words">
                        Error: {op.error}
                      </div>
                    )}
                    
                    <div className="mt-1 text-[10px] text-muted-foreground flex justify-between">
                      <span>Started: {op.startTime.toLocaleTimeString()}</span>
                      {op.endTime && (
                        <span>
                          Duration: {((op.endTime.getTime() - op.startTime.getTime()) / 1000).toFixed(2)}s
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="tables" className="mt-0">
            <div className="flex justify-between mb-2">
              <div className="text-xs text-muted-foreground">
                Table Access Check
              </div>
              <Button variant="ghost" size="sm" onClick={refreshTableChecks}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </Button>
            </div>
            
            <ScrollArea className="h-[300px] border rounded-md p-2">
              <div className="space-y-2">
                <Card className="p-2">
                  <h3 className="text-xs font-medium flex items-center">
                    <Database className="h-3 w-3 mr-1" />
                    Table Name Formats
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Testing different table name formats to identify correct access method
                  </p>
                  <div className="mt-2 space-y-1">
                    {Object.entries(tableChecks).map(([tableName, accessible]) => (
                      <div 
                        key={tableName} 
                        className="flex justify-between items-center text-xs p-1 rounded bg-muted/50"
                      >
                        <code className="text-xs">{tableName}</code>
                        <Badge 
                          variant={accessible ? 'default' : 'destructive'}
                          className="text-[10px] h-4"
                        >
                          {accessible ? 'Accessible' : 'Not Found'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </Card>
              
                <Card className="p-2">
                  <h3 className="text-xs font-medium">Troubleshooting Tips</h3>
                  <ul className="text-xs text-muted-foreground mt-1 list-disc pl-4 space-y-1">
                    <li>Table names must match exactly (case-sensitive)</li>
                    <li>Spaces in table names need special handling</li>
                    <li>Check your RLS policies to ensure they allow access</li>
                    <li>Verify the user is authenticated if required by RLS</li>
                  </ul>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="health" className="mt-0">
            <div className="flex justify-between mb-2">
              <div className="text-xs text-muted-foreground">
                System Health Check
              </div>
              <Button variant="ghost" size="sm" onClick={refreshTableChecks}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </Button>
            </div>
            
            <ScrollArea className="h-[300px] border rounded-md p-2">
              <div className="space-y-2">
                <Card className="p-2">
                  <h3 className="text-xs font-medium">Supabase Services</h3>
                  <div className="mt-2 space-y-1">
                    {Object.entries(supabaseHealth).map(([service, isHealthy]) => (
                      <div 
                        key={service} 
                        className="flex justify-between items-center text-xs p-1 rounded bg-muted/50"
                      >
                        <span>{service}</span>
                        <Badge 
                          variant={isHealthy ? 'default' : 'destructive'}
                          className="text-[10px] h-4"
                        >
                          {isHealthy ? 'Healthy' : 'Error'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </Card>
                
                <Card className="p-2">
                  <h3 className="text-xs font-medium">Authentication Status</h3>
                  <div className="mt-2 text-xs">
                    <AuthStateDebugInfo />
                  </div>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}

function AuthStateDebugInfo() {
  const [authInfo, setAuthInfo] = useState<{
    isAuthenticated: boolean;
    userId?: string;
    email?: string;
    sessionExpires?: string;
  }>({
    isAuthenticated: false
  });
  
  useEffect(() => {
    const checkAuth = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error checking authentication:', error);
        return;
      }
      
      if (data.session) {
        setAuthInfo({
          isAuthenticated: true,
          userId: data.session.user.id,
          email: data.session.user.email,
          sessionExpires: new Date(data.session.expires_at! * 1000).toLocaleString()
        });
      } else {
        setAuthInfo({ isAuthenticated: false });
      }
    };
    
    checkAuth();
  }, []);
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center p-1 rounded bg-muted/50">
        <span>Authenticated</span>
        <Badge 
          variant={authInfo.isAuthenticated ? 'default' : 'secondary'}
          className="text-[10px] h-4"
        >
          {authInfo.isAuthenticated ? 'Yes' : 'No'}
        </Badge>
      </div>
      
      {authInfo.isAuthenticated && (
        <>
          <div className="flex justify-between items-center p-1 rounded bg-muted/50">
            <span>User ID</span>
            <code className="text-[10px]">{authInfo.userId?.substring(0, 8)}...</code>
          </div>
          
          <div className="flex justify-between items-center p-1 rounded bg-muted/50">
            <span>Email</span>
            <span className="text-[10px]">{authInfo.email}</span>
          </div>
          
          <div className="flex justify-between items-center p-1 rounded bg-muted/50">
            <span>Session Expires</span>
            <span className="text-[10px]">{authInfo.sessionExpires}</span>
          </div>
        </>
      )}
    </div>
  );
}
