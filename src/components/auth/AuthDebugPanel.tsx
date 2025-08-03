import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, RefreshCw, Bug, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { enhancedAuthService } from '@/services/enhancedAuthService';
// Auth error service removed - using simplified error handling
import { toast } from 'sonner';

interface AuthDebugPanelProps {
  onDiagnosticsRun?: (results: any) => void;
}

export const AuthDebugPanel: React.FC<AuthDebugPanelProps> = ({ onDiagnosticsRun }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [authErrors, setAuthErrors] = useState<any[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    try {
      const results = await enhancedAuthService.runDiagnostics();
      setDiagnostics(results);
      
      // Auth errors disabled - related service removed
      setAuthErrors([]);
      
      onDiagnosticsRun?.(results);
      toast.success('Diagnostics completed');
    } catch (error: any) {
      console.error('Diagnostics failed:', error);
      toast.error(`Diagnostics failed: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: boolean | null) => {
    if (status === null) return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return status ? 
      <CheckCircle className="h-4 w-4 text-green-500" /> : 
      <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getStatusBadge = (status: boolean | null) => {
    if (status === null) return <Badge variant="secondary">Unknown</Badge>;
    return status ? 
      <Badge variant="default" className="bg-green-500">OK</Badge> : 
      <Badge variant="destructive">Error</Badge>;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" />
              Auth Debug Panel
            </CardTitle>
            <CardDescription>
              Diagnose authentication issues and view system status
            </CardDescription>
          </div>
          <Button 
            onClick={runDiagnostics} 
            disabled={isRunning}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
            {isRunning ? 'Running...' : 'Run Diagnostics'}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {diagnostics && (
          <>
            {/* Status Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  {getStatusIcon(diagnostics.sessionValid)}
                  <span className="font-medium">Session Status</span>
                </div>
                {getStatusBadge(diagnostics.sessionValid)}
              </div>
              
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  {getStatusIcon(diagnostics.profileExists)}
                  <span className="font-medium">Profile Status</span>
                </div>
                {getStatusBadge(diagnostics.profileExists)}
              </div>
            </div>

            {/* Auth Errors */}
            {authErrors.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger 
                  onClick={() => toggleSection('errors')}
                  className="flex items-center justify-between w-full p-3 border rounded-lg hover:bg-accent"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <span className="font-medium">Recent Auth Errors ({authErrors.length})</span>
                  </div>
                  {expandedSections.has('errors') ? 
                    <ChevronDown className="h-4 w-4" /> : 
                    <ChevronRight className="h-4 w-4" />
                  }
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="space-y-2">
                    {authErrors.slice(0, 5).map((error) => (
                      <div key={error.id} className="p-3 border rounded-lg bg-muted/50">
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant="outline">{error.error_type}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(error.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{error.error_message}</p>
                        {error.context && (
                          <p className="text-xs text-muted-foreground mt-1">Context: {error.context}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Test Results */}
            {diagnostics.testResults && (
              <Collapsible>
                <CollapsibleTrigger 
                  onClick={() => toggleSection('tests')}
                  className="flex items-center justify-between w-full p-3 border rounded-lg hover:bg-accent"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">Test Results</span>
                  </div>
                  {expandedSections.has('tests') ? 
                    <ChevronDown className="h-4 w-4" /> : 
                    <ChevronRight className="h-4 w-4" />
                  }
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="p-3 border rounded-lg bg-muted/50">
                    <pre className="text-xs whitespace-pre-wrap overflow-auto">
                      {JSON.stringify(diagnostics.testResults, null, 2)}
                    </pre>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Debug Info */}
            {diagnostics.debugInfo && (
              <Collapsible>
                <CollapsibleTrigger 
                  onClick={() => toggleSection('debug')}
                  className="flex items-center justify-between w-full p-3 border rounded-lg hover:bg-accent"
                >
                  <div className="flex items-center gap-2">
                    <Bug className="h-4 w-4 text-purple-500" />
                    <span className="font-medium">Debug Information</span>
                  </div>
                  {expandedSections.has('debug') ? 
                    <ChevronDown className="h-4 w-4" /> : 
                    <ChevronRight className="h-4 w-4" />
                  }
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="p-3 border rounded-lg bg-muted/50">
                    <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-96">
                      {JSON.stringify(diagnostics.debugInfo, null, 2)}
                    </pre>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Timestamp */}
            <div className="text-xs text-muted-foreground text-center">
              Last run: {new Date(diagnostics.timestamp).toLocaleString()}
            </div>
          </>
        )}

        {!diagnostics && (
          <div className="text-center text-muted-foreground py-8">
            <Bug className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Click "Run Diagnostics" to analyze your authentication status</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};