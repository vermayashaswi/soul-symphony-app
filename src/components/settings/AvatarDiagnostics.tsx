import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RefreshCw, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { avatarSyncService } from '@/services/avatarSyncService';
import { getOptimizedAvatarUrl, validateAvatarUrl } from '@/utils/avatarUtils';
import { Capacitor } from '@capacitor/core';

interface AvatarDiagnosticsProps {
  onClose: () => void;
}

export const AvatarDiagnostics: React.FC<AvatarDiagnosticsProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);

  const runDiagnostics = async () => {
    if (!user) return;
    
    setIsRunning(true);
    try {
      const results = {
        timestamp: new Date().toISOString(),
        platform: Capacitor.getPlatform(),
        isNative: Capacitor.isNativePlatform(),
        userId: user.id,
        authMetadata: {
          hasAvatarUrl: !!user.user_metadata?.avatar_url,
          avatarUrl: user.user_metadata?.avatar_url,
          optimized: user.user_metadata?.avatar_url ? getOptimizedAvatarUrl(user.user_metadata.avatar_url) : null
        },
        profileData: null,
        urlValidation: null,
        networkConnectivity: 'unknown'
      };

      // Check profile data
      try {
        const profileResult = await avatarSyncService.syncUserAvatar(user);
        results.profileData = {
          success: profileResult.success,
          avatarUrl: profileResult.avatarUrl,
          error: profileResult.error
        };
      } catch (error) {
        results.profileData = { error: (error as Error).message };
      }

      // Test network connectivity with a simple request
      try {
        const response = await fetch('https://httpbin.org/get', { 
          method: 'HEAD',
          signal: AbortSignal.timeout(3000)
        });
        results.networkConnectivity = response.ok ? 'good' : 'limited';
      } catch {
        results.networkConnectivity = 'failed';
      }

      // Validate current avatar URL
      if (results.authMetadata.optimized) {
        try {
          results.urlValidation = {
            url: results.authMetadata.optimized,
            accessible: await validateAvatarUrl(results.authMetadata.optimized)
          };
        } catch (error) {
          results.urlValidation = { error: (error as Error).message };
        }
      }

      setDiagnostics(results);
    } catch (error) {
      setDiagnostics({ error: (error as Error).message });
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const getStatusIcon = (status: boolean | string) => {
    if (status === true) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status === false) return <AlertCircle className="h-4 w-4 text-red-500" />;
    return <Info className="h-4 w-4 text-blue-500" />;
  };

  return (
    <Card className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Avatar Loading Diagnostics</h3>
        <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
      </div>

      <div className="space-y-4">
        <Button 
          onClick={runDiagnostics} 
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Running Diagnostics...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Re-run Diagnostics
            </>
          )}
        </Button>

        {diagnostics && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="font-medium mb-2">Environment</div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {getStatusIcon('info')}
                    Platform: {diagnostics.platform}
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(diagnostics.isNative)}
                    Native App: {diagnostics.isNative ? 'Yes' : 'No'}
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(diagnostics.networkConnectivity === 'good')}
                    Network: {diagnostics.networkConnectivity}
                  </div>
                </div>
              </div>

              <div>
                <div className="font-medium mb-2">Auth Metadata</div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(diagnostics.authMetadata?.hasAvatarUrl)}
                    Has Avatar URL: {diagnostics.authMetadata?.hasAvatarUrl ? 'Yes' : 'No'}
                  </div>
                  {diagnostics.authMetadata?.avatarUrl && (
                    <div className="text-xs text-muted-foreground break-all">
                      {diagnostics.authMetadata.avatarUrl.substring(0, 60)}...
                    </div>
                  )}
                </div>
              </div>
            </div>

            {diagnostics.profileData && (
              <div>
                <div className="font-medium mb-2">Profile Sync</div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(diagnostics.profileData.success)}
                  Status: {diagnostics.profileData.success ? 'Success' : 'Failed'}
                </div>
                {diagnostics.profileData.error && (
                  <div className="text-xs text-red-500 mt-1">
                    {diagnostics.profileData.error}
                  </div>
                )}
              </div>
            )}

            {diagnostics.urlValidation && (
              <div>
                <div className="font-medium mb-2">URL Validation</div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(diagnostics.urlValidation.accessible)}
                  Accessible: {diagnostics.urlValidation.accessible ? 'Yes' : 'No'}
                </div>
                {diagnostics.urlValidation.url && (
                  <div className="text-xs text-muted-foreground break-all mt-1">
                    {diagnostics.urlValidation.url}
                  </div>
                )}
              </div>
            )}

            <div className="text-xs text-muted-foreground pt-2 border-t">
              Diagnostics run at: {new Date(diagnostics.timestamp).toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};