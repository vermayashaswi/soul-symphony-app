
import React, { useState, useEffect, useRef } from 'react';
import { X, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface ProfileDebugEvent {
  id: string;
  type: 'check' | 'create' | 'api' | 'error' | 'success' | 'info';
  message: string;
  details?: any;
  timestamp: Date;
  source?: string;
}

const JournalProfileDebug = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [events, setEvents] = useState<ProfileDebugEvent[]>([]);
  const { user, ensureProfileExists } = useAuth();
  const eventsRef = useRef<ProfileDebugEvent[]>([]);
  
  const addEvent = (event: Omit<ProfileDebugEvent, 'id' | 'timestamp'>) => {
    const newEvent = {
      ...event,
      id: Date.now().toString(36) + Math.random().toString(36).substring(2),
      timestamp: new Date()
    };
    
    eventsRef.current = [newEvent, ...eventsRef.current.slice(0, 99)];
    setEvents([...eventsRef.current]);
    return newEvent.id;
  };
  
  useEffect(() => {
    // Initial info
    addEvent({
      type: 'info',
      message: 'Profile debugger initialized',
      source: 'debugger'
    });
    
    if (user) {
      addEvent({
        type: 'info',
        message: 'User is logged in',
        details: {
          id: user.id,
          email: user.email,
          app_metadata: user.app_metadata,
          authProvider: user.app_metadata?.provider,
          hasUserMetadata: !!user.user_metadata,
          userMetadataKeys: user.user_metadata ? Object.keys(user.user_metadata) : []
        },
        source: 'auth'
      });
    } else {
      addEvent({
        type: 'info',
        message: 'No user is logged in',
        source: 'auth'
      });
    }
    
    // Monitor Supabase API calls
    const originalFetch = window.fetch;
    
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      // Only intercept Supabase API calls
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const isSupabaseCall = url.includes('supabase') || url.includes('kwnwhgucnzqxndzjayyq');
      
      if (!isSupabaseCall) {
        return originalFetch(input, init);
      }
      
      const method = init?.method || 'GET';
      const eventId = addEvent({
        type: 'api',
        message: `${method} ${url.split('/').slice(-2).join('/')}`,
        details: {
          url,
          method,
          body: init?.body instanceof FormData ? 'FormData' : init?.body
        },
        source: 'network'
      });
      
      try {
        const response = await originalFetch(input, init);
        const clonedResponse = response.clone();
        
        try {
          // Attempt to parse response as JSON
          const data = await clonedResponse.json();
          
          addEvent({
            type: response.ok ? 'success' : 'error',
            message: `Response: ${response.status} ${response.statusText}`,
            details: {
              status: response.status,
              data,
              for: eventId
            },
            source: 'network'
          });
        } catch (e) {
          // If not JSON, just log status
          addEvent({
            type: response.ok ? 'success' : 'error',
            message: `Response: ${response.status} ${response.statusText}`,
            details: {
              status: response.status,
              for: eventId
            },
            source: 'network'
          });
        }
        
        return response;
      } catch (error) {
        addEvent({
          type: 'error',
          message: 'Fetch error',
          details: {
            error: String(error),
            for: eventId
          },
          source: 'network'
        });
        throw error;
      }
    };
    
    return () => {
      window.fetch = originalFetch;
    };
  }, [user]);
  
  const checkProfile = async () => {
    if (!user) {
      addEvent({
        type: 'error',
        message: 'Cannot check profile: No user logged in',
        source: 'debugger'
      });
      return;
    }
    
    addEvent({
      type: 'check',
      message: 'Manually checking if profile exists',
      source: 'debugger'
    });
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, avatar_url, full_name, created_at')
        .eq('id', user.id)
        .maybeSingle();
      
      if (error) {
        addEvent({
          type: 'error',
          message: 'Error checking profile',
          details: error,
          source: 'supabase'
        });
      } else if (data) {
        addEvent({
          type: 'success',
          message: 'Profile exists',
          details: data,
          source: 'supabase'
        });
      } else {
        addEvent({
          type: 'info',
          message: 'Profile does not exist',
          source: 'supabase'
        });
      }
    } catch (error) {
      addEvent({
        type: 'error',
        message: 'Exception checking profile',
        details: error,
        source: 'exception'
      });
    }
  };
  
  const createProfile = async () => {
    if (!user) {
      addEvent({
        type: 'error',
        message: 'Cannot create profile: No user logged in',
        source: 'debugger'
      });
      return;
    }
    
    addEvent({
      type: 'create',
      message: 'Manually creating profile',
      source: 'debugger'
    });
    
    try {
      // Extract user metadata - handle different metadata formats
      let fullName = '';
      let avatarUrl = '';
      const email = user.email || '';
      
      // Examine user metadata
      if (user.user_metadata) {
        addEvent({
          type: 'info',
          message: 'User metadata found',
          details: user.user_metadata,
          source: 'debugger'
        });
        
        // Google auth often uses these fields
        fullName = user.user_metadata?.full_name || 
                  user.user_metadata?.name ||
                  `${user.user_metadata?.given_name || ''} ${user.user_metadata?.family_name || ''}`.trim();
        
        avatarUrl = user.user_metadata?.avatar_url || 
                   user.user_metadata?.picture || 
                   '';
      } else {
        addEvent({
          type: 'warning',
          message: 'No user metadata found',
          source: 'debugger'
        });
      }
      
      // First try upsert approach
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert([{
          id: user.id,
          email,
          full_name: fullName,
          avatar_url: avatarUrl,
          onboarding_completed: false,
          updated_at: new Date().toISOString()
        }], { 
          onConflict: 'id',
          ignoreDuplicates: false 
        });
      
      if (upsertError) {
        addEvent({
          type: 'error',
          message: 'Error upserting profile',
          details: upsertError,
          source: 'supabase'
        });
        
        // Fallback to direct insert
        const { error: insertError } = await supabase
          .from('profiles')
          .insert([{
            id: user.id,
            email,
            full_name: fullName,
            avatar_url: avatarUrl,
            onboarding_completed: false
          }]);
          
        if (insertError) {
          addEvent({
            type: 'error',
            message: 'Final fallback insert failed',
            details: insertError,
            source: 'supabase'
          });
        } else {
          addEvent({
            type: 'success',
            message: 'Profile created using fallback insert',
            source: 'supabase'
          });
        }
      } else {
        addEvent({
          type: 'success',
          message: 'Profile created/updated successfully with upsert',
          source: 'supabase'
        });
      }
      
      // Re-check to confirm
      setTimeout(checkProfile, 1000);
      
    } catch (error) {
      addEvent({
        type: 'error',
        message: 'Exception creating profile',
        details: error,
        source: 'exception'
      });
    }
  };
  
  const triggerProfileCreation = async () => {
    if (!user) {
      addEvent({
        type: 'error',
        message: 'Cannot ensure profile: No user logged in',
        source: 'debugger'
      });
      return;
    }
    
    addEvent({
      type: 'info',
      message: 'Triggering ensureProfileExists from AuthContext',
      source: 'debugger'
    });
    
    try {
      const result = await ensureProfileExists();
      
      addEvent({
        type: result ? 'success' : 'error',
        message: result ? 'Profile creation succeeded' : 'Profile creation failed',
        source: 'auth'
      });
      
      // Re-check to confirm
      setTimeout(checkProfile, 1000);
    } catch (error) {
      addEvent({
        type: 'error',
        message: 'Exception in ensureProfileExists',
        details: error,
        source: 'exception'
      });
    }
  };
  
  const clearEvents = () => {
    eventsRef.current = [];
    setEvents([]);
  };
  
  if (!isOpen) {
    return (
      <Button 
        className="fixed bottom-20 right-4 z-50 bg-amber-600 hover:bg-amber-700 text-white"
        onClick={() => setIsOpen(true)}
        size="sm"
      >
        Profile Debug
      </Button>
    );
  }
  
  return (
    <Card className="fixed bottom-4 right-4 z-50 w-96 max-h-[80vh] shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">Profile Debugger</CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex flex-wrap gap-2 mt-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={checkProfile}
          >
            Check Profile
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={createProfile}
          >
            Create Profile
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={triggerProfileCreation}
          >
            Run ensureProfileExists
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearEvents}
            className="ml-auto"
          >
            Clear
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-xs mb-2">
          {user ? (
            <div>
              User: {user.email} (Provider: {user.app_metadata?.provider || 'unknown'})
            </div>
          ) : 'Not logged in'}
        </div>
        <ScrollArea className="h-[60vh]">
          <div className="space-y-3">
            {events.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No events logged yet
              </div>
            ) : (
              events.map((event) => (
                <div key={event.id} className="border rounded-md p-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {event.type === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
                      {event.type === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                      {event.type === 'api' && <RefreshCw className="h-4 w-4 text-blue-500" />}
                      {(event.type === 'check' || event.type === 'create' || event.type === 'info') && <div className="h-4 w-4 rounded-full bg-orange-500" />}
                      
                      <Badge variant={
                        event.type === 'error' ? 'destructive' : 
                        event.type === 'success' ? 'default' : 
                        event.type === 'api' ? 'secondary' : 
                        'outline'
                      }>
                        {event.source || event.type}
                      </Badge>
                      
                      <span className="font-medium text-xs">{event.message}</span>
                    </div>
                  </div>
                  
                  {event.details && (
                    <>
                      <Separator className="my-2" />
                      <div className="text-[10px] font-mono whitespace-pre-wrap bg-muted/50 p-1 rounded-sm overflow-x-auto">
                        {typeof event.details === 'string' 
                          ? event.details 
                          : JSON.stringify(event.details, null, 2)}
                      </div>
                    </>
                  )}
                  
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {event.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default JournalProfileDebug;
