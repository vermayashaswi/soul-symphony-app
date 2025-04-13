import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useDebugLog } from '@/utils/debug/DebugContext';
import { DebugLogEntry } from '@/utils/debug/debugLogTypes';
import { X, Download, Trash, Bug } from 'lucide-react';
import { formatShortDate } from '@/utils/format-time';
import { supabase } from '@/integrations/supabase/client';

const JournalDebugPanel = () => {
  const { logs, clearLogs, isEnabled, toggleEnabled } = useDebugLog();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('logs');
  const [serviceStatus, setServiceStatus] = useState<Record<string, boolean>>({});
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  const [processingEntries, setProcessingEntries] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen && activeTab === 'data') {
      checkServices();
      loadJournalEntries();
      loadProcessingEntries();
    }
  }, [isOpen, activeTab]);

  const checkServices = async () => {
    setIsLoading((prev) => ({ ...prev, services: true }));
    try {
      const { data, error } = await supabase.auth.getSession();
      setServiceStatus(prev => ({
        ...prev,
        supabase: !error
      }));
    } catch (error) {
      console.error('Error checking services:', error);
    } finally {
      setIsLoading((prev) => ({ ...prev, services: false }));
    }
  };

  const loadJournalEntries = async () => {
    setIsLoading((prev) => ({ ...prev, journalEntries: true }));
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user?.id) {
        const { data, error } = await supabase
          .from('Journal Entries')
          .select('*')
          .eq('user_id', userData.user.id)
          .order('created_at', { ascending: false })
          .limit(5);
          
        if (error) {
          throw error;
        }
        
        setJournalEntries(data || []);
      }
    } catch (error) {
      console.error('Error loading journal entries:', error);
    } finally {
      setIsLoading((prev) => ({ ...prev, journalEntries: false }));
    }
  };

  const loadProcessingEntries = () => {
    try {
      const storedEntries = localStorage.getItem('processingEntries');
      setProcessingEntries(storedEntries ? JSON.parse(storedEntries) : []);
    } catch (error) {
      console.error('Error loading processing entries:', error);
      setProcessingEntries([]);
    }
  };

  const downloadLogs = () => {
    try {
      const debugData = {
        logs,
        journalEntries,
        processingEntries,
        serviceStatus,
        browser: navigator.userAgent,
        timestamp: new Date().toISOString(),
        localStorage: getLocalStorageItems()
      };
      
      const blob = new Blob([JSON.stringify(debugData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `soulo-debug-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading logs:', error);
    }
  };

  const getLocalStorageItems = () => {
    const items: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        try {
          items[key] = localStorage.getItem(key) || '';
        } catch (e) {
          items[key] = 'Error reading value';
        }
      }
    }
    return items;
  };

  const getLogBadgeColor = (level: string) => {
    switch (level) {
      case 'error': return 'bg-red-500 hover:bg-red-600';
      case 'warning': return 'bg-yellow-500 hover:bg-yellow-600';
      case 'success': return 'bg-green-500 hover:bg-green-600';
      default: return 'bg-blue-500 hover:bg-blue-600';
    }
  };

  const testWhisperEndpoint = async () => {
    setIsLoading((prev) => ({ ...prev, whisperTest: true }));
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const dest = audioContext.createMediaStreamDestination();
      oscillator.connect(dest);
      oscillator.frequency.value = 440;
      oscillator.start();
      
      const mediaRecorder = new MediaRecorder(dest.stream);
      const chunks: BlobPart[] = [];
      
      mediaRecorder.ondataavailable = (e) => {
        chunks.push(e.data);
      };
      
      const recordingPromise = new Promise<Blob>((resolve) => {
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          resolve(blob);
        };
      });
      
      mediaRecorder.start();
      await new Promise(resolve => setTimeout(resolve, 1000));
      mediaRecorder.stop();
      oscillator.stop();
      
      const audioBlob = await recordingPromise;
      
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(audioBlob);
      
      const base64Audio = await base64Promise;
      
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      
      const response = await supabase.functions.invoke('transcribe-audio', {
        body: {
          audio: base64Audio,
          userId: userId || null,
          directTranscription: true
        }
      });
      
      alert(`Whisper Test Result: ${JSON.stringify(response)}`);
    } catch (error) {
      console.error('Error testing Whisper endpoint:', error);
      alert(`Whisper Test Error: ${error}`);
    } finally {
      setIsLoading((prev) => ({ ...prev, whisperTest: false }));
    }
  };

  const handleToggleLogging = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleEnabled();
  };

  return (
    <div className="fixed top-4 right-4 z-[9999]">
      {!isOpen ? (
        <Button 
          onClick={() => setIsOpen(true)} 
          className="group bg-red-600 hover:bg-red-700"
        >
          <Bug className="w-5 h-5 mr-2" />
          Debug Journal
        </Button>
      ) : (
        <Card className="w-[95vw] md:w-[600px] shadow-xl border-red-300 overflow-hidden">
          <div className="bg-red-600 p-2 text-white flex justify-between items-center">
            <h3 className="font-medium flex items-center">
              <Bug className="w-4 h-4 mr-2" /> Journal Debug Panel
            </h3>
            <div className="flex gap-2">
              <button onClick={downloadLogs} className="p-1 hover:bg-red-700 rounded">
                <Download className="w-4 h-4" />
              </button>
              <button onClick={clearLogs} className="p-1 hover:bg-red-700 rounded">
                <Trash className="w-4 h-4" />
              </button>
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-red-700 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <Tabs defaultValue="logs" value={activeTab} onValueChange={setActiveTab}>
            <div className="p-2 bg-gray-100 dark:bg-gray-800">
              <TabsList className="w-full">
                <TabsTrigger value="logs" className="flex-1">Logs ({logs.length})</TabsTrigger>
                <TabsTrigger value="data" className="flex-1">Data</TabsTrigger>
                <TabsTrigger value="tests" className="flex-1">Tests</TabsTrigger>
              </TabsList>
            </div>
            
            <div className="p-2">
              <div className="flex justify-between mb-2">
                <Badge variant={isEnabled ? "default" : "outline"}>
                  Logging: {isEnabled ? "Enabled" : "Disabled"}
                </Badge>
                <Button 
                  size="sm" 
                  variant={isEnabled ? "outline" : "default"} 
                  onClick={handleToggleLogging}
                >
                  {isEnabled ? "Disable" : "Enable"} Logging
                </Button>
              </div>
            </div>
            
            <TabsContent value="logs" className="m-0">
              <ScrollArea className="h-[400px] p-2">
                {logs.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    No logs recorded. Enable logging and perform some actions.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {logs.map((log: DebugLogEntry) => (
                      <div key={log.id} className="border rounded p-2 text-sm">
                        <div className="flex justify-between mb-1">
                          <Badge className={getLogBadgeColor(log.level)}>
                            {log.level.toUpperCase()}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="font-medium">{log.category}</div>
                        <div className="text-sm">{log.message}</div>
                        {log.details && (
                          <pre className="mt-1 text-xs bg-gray-100 dark:bg-gray-800 p-1 rounded overflow-x-auto">
                            {typeof log.details === 'object' 
                              ? JSON.stringify(log.details, null, 2)
                              : String(log.details)
                            }
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="data" className="m-0">
              <ScrollArea className="h-[400px]">
                <div className="p-2 space-y-4">
                  <Card className="p-2">
                    <h4 className="font-medium text-sm mb-2">Service Status</h4>
                    {isLoading.services ? (
                      <p className="text-sm text-gray-500">Checking services...</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-sm">
                          Supabase: 
                          <Badge className={serviceStatus.supabase ? "bg-green-500 ml-2" : "bg-red-500 ml-2"}>
                            {serviceStatus.supabase ? "Connected" : "Disconnected"}
                          </Badge>
                        </div>
                      </div>
                    )}
                    <Button size="sm" className="mt-2" onClick={checkServices}>
                      Refresh Status
                    </Button>
                  </Card>
                  
                  <Card className="p-2">
                    <h4 className="font-medium text-sm mb-2">Processing Entries</h4>
                    <div className="text-sm">
                      {processingEntries.length > 0 ? (
                        <ul className="list-disc pl-5">
                          {processingEntries.map((id, index) => (
                            <li key={index}>{id}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-gray-500">No entries currently being processed</p>
                      )}
                    </div>
                    <Button size="sm" className="mt-2" onClick={loadProcessingEntries}>
                      Refresh
                    </Button>
                  </Card>
                  
                  <Card className="p-2">
                    <h4 className="font-medium text-sm mb-2">
                      Recent Journal Entries 
                      {isLoading.journalEntries && <span className="ml-2 text-xs text-gray-500">(Loading...)</span>}
                    </h4>
                    {journalEntries.length > 0 ? (
                      <div className="space-y-2">
                        {journalEntries.map((entry) => (
                          <div key={entry.id} className="border p-2 rounded text-xs">
                            <div className="flex justify-between">
                              <span>ID: {entry.id}</span>
                              <span>{formatShortDate(entry.created_at)}</span>
                            </div>
                            <div className="mt-1">
                              Content: {entry["refined text"] || entry["transcription text"] || "No content"}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {entry.master_themes && entry.master_themes.map((theme: string, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs">{theme}</Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No journal entries found</p>
                    )}
                    <Button size="sm" className="mt-2" onClick={loadJournalEntries}>
                      Refresh Entries
                    </Button>
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="tests" className="m-0 p-2">
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  <Card className="p-2">
                    <h4 className="font-medium text-sm mb-2">Transcription Service Test</h4>
                    <p className="text-xs text-gray-600 mb-2">
                      This will generate a test audio file and send it to the transcription service to verify it's working.
                    </p>
                    <Button 
                      size="sm" 
                      onClick={testWhisperEndpoint}
                      disabled={isLoading.whisperTest}
                    >
                      {isLoading.whisperTest ? "Testing..." : "Test Whisper Endpoint"}
                    </Button>
                  </Card>
                  
                  <Card className="p-2">
                    <h4 className="font-medium text-sm mb-2">Request Processing Flow</h4>
                    <div className="text-xs space-y-2">
                      <div className="flex items-center">
                        <Badge className="mr-2">1</Badge>
                        <span>Frontend: Record Audio → Convert to Base64</span>
                      </div>
                      <div className="flex items-center">
                        <Badge className="mr-2">2</Badge>
                        <span>Frontend → transcribe-audio Edge Function</span>
                      </div>
                      <div className="flex items-center">
                        <Badge className="mr-2">3</Badge>
                        <span>Edge Function: Whisper Transcription → GPT Translation</span>
                      </div>
                      <div className="flex items-center">
                        <Badge className="mr-2">4</Badge>
                        <span>Edge Function: Analyze sentiment, emotions, entities</span>
                      </div>
                      <div className="flex items-center">
                        <Badge className="mr-2">5</Badge>
                        <span>Edge Function: Store journal entry in database</span>
                      </div>
                      <div className="flex items-center">
                        <Badge className="mr-2">6</Badge>
                        <span>Edge Function → Frontend: Return entry details</span>
                      </div>
                      <div className="flex items-center">
                        <Badge className="mr-2">7</Badge>
                        <span>Frontend: Fetch and display journal entries</span>
                      </div>
                    </div>
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </Card>
      )}
    </div>
  );
};

export default JournalDebugPanel;
