
import React, { useState, useEffect } from 'react';
import { checkAllSupabaseFunctions } from '@/utils/supabase-function-checker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle, RefreshCw, AlertCircle } from 'lucide-react';

const SupabaseStatusChecker = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [functionStatus, setFunctionStatus] = useState<Record<string, { isWorking: boolean, error?: string }> | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const checkFunctions = async () => {
    setIsChecking(true);
    try {
      const results = await checkAllSupabaseFunctions();
      setFunctionStatus(results);
      setLastChecked(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Error checking functions:', error);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    // Check functions on mount
    checkFunctions();
  }, []);

  const allFunctionsWorking = functionStatus && 
    Object.values(functionStatus).every(status => status.isWorking);
  
  const someFunctionsWorking = functionStatus && 
    Object.values(functionStatus).some(status => status.isWorking);

  return (
    <Card className="w-full max-w-md mx-auto shadow-md">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium">Supabase Functions Status</CardTitle>
        {allFunctionsWorking ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : someFunctionsWorking ? (
          <AlertCircle className="h-5 w-5 text-amber-500" />
        ) : (
          <XCircle className="h-5 w-5 text-red-500" />
        )}
      </CardHeader>
      
      <CardContent className="pt-0">
        {functionStatus ? (
          <div className="space-y-3">
            {Object.entries(functionStatus).map(([functionName, status]) => (
              <div key={functionName} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {status.isWorking ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="font-mono text-sm">{functionName}</span>
                </div>
                {!status.isWorking && status.error && (
                  <span className="text-xs text-red-500 truncate max-w-[200px]" title={status.error}>
                    {status.error}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-4 text-center text-muted-foreground">
            Checking functions...
          </div>
        )}
        
        {lastChecked && (
          <div className="text-xs text-muted-foreground mt-4">
            Last checked: {lastChecked}
          </div>
        )}
      </CardContent>
      
      <CardFooter className="pt-2">
        <Button 
          onClick={checkFunctions} 
          disabled={isChecking} 
          variant="outline" 
          size="sm"
          className="w-full"
        >
          {isChecking ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Status
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default SupabaseStatusChecker;
