
import { supabase } from '@/integrations/supabase/client';

/**
 * Tests each step of the recording and upload pipeline
 * @returns Diagnostic results
 */
export const testRecordingPipeline = async () => {
  const results = {
    audioContext: false,
    mediaDevices: false,
    mediaRecorder: false,
    storageUpload: false,
    storageAccess: false,
    transcriptionFunction: false,
    errors: [] as string[]
  };

  // Test Audio Context
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContext) {
      const context = new AudioContext();
      context.close();
      results.audioContext = true;
    } else {
      results.errors.push('AudioContext not supported in this browser');
    }
  } catch (error) {
    results.errors.push(`AudioContext error: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Test Media Devices
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      results.mediaDevices = true;
    } else {
      results.errors.push('getUserMedia API not supported in this browser');
    }
  } catch (error) {
    results.errors.push(`Media devices error: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Test MediaRecorder
  try {
    if (window.MediaRecorder) {
      results.mediaRecorder = true;
    } else {
      results.errors.push('MediaRecorder not supported in this browser');
    }
  } catch (error) {
    results.errors.push(`MediaRecorder error: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Test Storage Access
  try {
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      results.errors.push(`Storage access error: ${bucketsError.message}`);
    } else {
      results.storageAccess = true;
      
      // Check if audio bucket exists
      const audioBucket = buckets?.find(bucket => bucket.name === 'audio');
      if (!audioBucket) {
        results.errors.push('Audio bucket not found in storage');
      }
    }
  } catch (error) {
    results.errors.push(`Storage access error: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Test Edge Function Access
  try {
    const { error: functionError } = await supabase.functions.invoke('transcribe-audio', { 
      body: { test: true }
    });
    
    if (functionError) {
      results.errors.push(`Transcription function error: ${functionError.message}`);
    } else {
      results.transcriptionFunction = true;
    }
  } catch (error) {
    results.errors.push(`Edge function error: ${error instanceof Error ? error.message : String(error)}`);
  }

  return results;
};

/**
 * Gets detailed information about the user's browser and system
 */
export const getBrowserInfo = () => {
  const info = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    vendor: navigator.vendor,
    language: navigator.language,
    cookiesEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    storageAvailable: {
      localStorage: false,
      sessionStorage: false,
      indexedDB: false
    },
    screenSize: {
      width: window.screen.width,
      height: window.screen.height,
      availWidth: window.screen.availWidth,
      availHeight: window.screen.availHeight,
      colorDepth: window.screen.colorDepth
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    },
    devicePixelRatio: window.devicePixelRatio,
    permissions: {} as Record<string, string>
  };

  // Check storage availability
  try {
    if (window.localStorage) {
      window.localStorage.setItem('test', 'test');
      window.localStorage.removeItem('test');
      info.storageAvailable.localStorage = true;
    }
  } catch (e) {
    console.error('LocalStorage not available:', e);
  }

  try {
    if (window.sessionStorage) {
      window.sessionStorage.setItem('test', 'test');
      window.sessionStorage.removeItem('test');
      info.storageAvailable.sessionStorage = true;
    }
  } catch (e) {
    console.error('SessionStorage not available:', e);
  }

  try {
    if (window.indexedDB) {
      info.storageAvailable.indexedDB = true;
    }
  } catch (e) {
    console.error('IndexedDB not available:', e);
  }

  // Check permissions if available
  if (navigator.permissions) {
    const permissionsToCheck = ['camera', 'microphone', 'notifications', 'geolocation'];
    
    permissionsToCheck.forEach(permission => {
      try {
        navigator.permissions.query({ name: permission as PermissionName })
          .then(result => {
            info.permissions[permission] = result.state;
          })
          .catch(() => {
            info.permissions[permission] = 'error';
          });
      } catch (e) {
        info.permissions[permission] = 'not-supported';
      }
    });
  }

  return info;
};

/**
 * Performs a complete diagnostic test of all aspects of the application
 */
export const runCompleteDiagnostics = async () => {
  const results = {
    timestamp: new Date().toISOString(),
    browserInfo: getBrowserInfo(),
    database: await testDatabaseConnection(),
    recording: await testRecordingPipeline(),
    auth: await testAuthStatus(),
    network: await testNetworkConnection()
  };
  
  return results;
};

/**
 * Tests the database connection
 */
const testDatabaseConnection = async () => {
  try {
    const startTime = performance.now();
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);
    const endTime = performance.now();
    
    return {
      success: !error,
      error: error?.message,
      latency: Math.round(endTime - startTime),
      data
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      latency: null,
      data: null
    };
  }
};

/**
 * Tests the current authentication status
 */
const testAuthStatus = async () => {
  try {
    const startTime = performance.now();
    const { data, error } = await supabase.auth.getSession();
    const endTime = performance.now();
    
    return {
      success: !error,
      error: error?.message,
      latency: Math.round(endTime - startTime),
      hasSession: !!data.session,
      expiresAt: data.session?.expires_at ? new Date(data.session.expires_at * 1000).toISOString() : null
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      latency: null,
      hasSession: false,
      expiresAt: null
    };
  }
};

/**
 * Tests network connectivity
 */
const testNetworkConnection = async () => {
  const results = {
    online: navigator.onLine,
    supabaseLatency: null as number | null,
    googleLatency: null as number | null,
    errors: [] as string[]
  };
  
  try {
    // Test Supabase latency
    const supabaseStart = performance.now();
    await fetch('https://kwnwhgucnzqxndzjayyq.supabase.co/rest/v1/', {
      method: 'HEAD',
      headers: {
        'apikey': process.env.REACT_APP_SUPABASE_ANON_KEY || ''
      }
    });
    results.supabaseLatency = Math.round(performance.now() - supabaseStart);
  } catch (error) {
    results.errors.push(`Supabase connectivity error: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  try {
    // Test general internet latency
    const googleStart = performance.now();
    await fetch('https://www.google.com', { method: 'HEAD' });
    results.googleLatency = Math.round(performance.now() - googleStart);
  } catch (error) {
    results.errors.push(`Google connectivity error: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  return results;
};
