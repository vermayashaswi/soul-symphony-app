import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, RefreshCw, Bug, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { enhancedAuthService } from '@/services/enhancedAuthService';

import { toast } from 'sonner';

interface AuthDebugPanelProps {
  onDiagnosticsRun?: (results: any) => void;
}

export const AuthDebugPanel: React.FC<AuthDebugPanelProps> = ({ onDiagnosticsRun }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any>(null);
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