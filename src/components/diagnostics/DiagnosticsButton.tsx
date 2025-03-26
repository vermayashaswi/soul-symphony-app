
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Download,
  Database
} from 'lucide-react';
import { runCompleteDiagnostics } from '@/utils/diagnostics-utils';
import { useDebug } from '@/contexts/debug/DebugContext';
import { toast } from 'sonner';

const DiagnosticsButton = ({ variant = 'default' }: { variant?: 'default' | 'minimal' }) => {
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'error' | 'checking'>('checking');
  const [isRunningTest, setIsRunningTest] = useState(false);
  const { addLog } = useDebug();

  const runDiagnostics = async () => {
    if (isRunningTest) return;
    
    setIsRunningTest(true);
    setConnectionStatus('checking');
    addLog('action', 'Running complete diagnostics');
    
    try {
      toast.loading('Running diagnostics...', { id: 'diagnostics' });
      const results = await runCompleteDiagnostics();
      
      addLog('info', 'Diagnostics results', results);
      
      if (results.database.success) {
        setConnectionStatus('connected');
        toast.success('Database connection successful', { id: 'diagnostics' });
      } else {
        setConnectionStatus('error');
        toast.error('Database connection failed', { id: 'diagnostics' });
      }
      
      // Allow the user to download the diagnostics report
      const json = JSON.stringify(results, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `feelosophy-diagnostics-${new Date().toISOString().split('T')[0]}.json`;
      
      toast.message('Diagnostics complete', {
        id: 'diagnostics',
        description: 'Detailed report is available for download',
        action: {
          label: 'Download',
          onClick: () => {
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }
        }
      });
    } catch (error) {
      setConnectionStatus('error');
      addLog('error', 'Diagnostics failed', error);
      toast.error('Diagnostics failed', { id: 'diagnostics' });
    } finally {
      setIsRunningTest(false);
    }
  };

  useEffect(() => {
    // Run a basic check on mount
    const quickCheck = async () => {
      try {
        const quickResults = await runCompleteDiagnostics();
        setConnectionStatus(quickResults.database.success ? 'connected' : 'error');
      } catch (error) {
        setConnectionStatus('error');
        addLog('error', 'Initial diagnostics check failed', error);
      }
    };
    
    quickCheck();
  }, [addLog]);

  if (variant === 'minimal') {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={runDiagnostics}
        disabled={isRunningTest}
        className="h-8"
      >
        {isRunningTest && <Clock className="h-3.5 w-3.5 mr-1 animate-spin" />}
        {connectionStatus === 'connected' && <CheckCircle className="h-3.5 w-3.5 mr-1 text-green-500" />}
        {connectionStatus === 'error' && <AlertCircle className="h-3.5 w-3.5 mr-1 text-red-500" />}
        Diagnostics
      </Button>
    );
  }

  return (
    <Button
      onClick={runDiagnostics}
      disabled={isRunningTest}
      className="flex items-center gap-2"
      variant={connectionStatus === 'error' ? 'destructive' : 'default'}
    >
      {isRunningTest && <Clock className="h-4 w-4 animate-spin" />}
      {connectionStatus === 'connected' && <CheckCircle className="h-4 w-4" />}
      {connectionStatus === 'error' && <AlertCircle className="h-4 w-4" />}
      <span>Run Diagnostics</span>
    </Button>
  );
};

export default DiagnosticsButton;
