import { supabase } from '@/integrations/supabase/client';
import { SessionTrackingService } from './sessionTrackingService';

export interface SessionState {
  id?: string;
  isActive: boolean;
  state: 'active' | 'background' | 'inactive' | 'terminated';
  startTime: Date;
  lastActivity: Date;
  pageViews: number;
  qualityScore: number;
  appVersion?: string;
  networkState?: 'online' | 'offline' | 'slow';
  batteryLevel?: number;
  memoryUsage?: number;
}

export interface SessionMetrics {
  duration: number;
  foregroundTime: number;
  backgroundTime: number;
  appLaunchCount: number;
  pageViews: number;
  qualityScore: number;
  crashCount: number;
  errorCount: number;
}

class SessionManager {
  private static instance: SessionManager;
  private currentSession: SessionState | null = null;
  private sessionFingerprint: string | null = null;
  private activityTimer: NodeJS.Timeout | null = null;
  private backgroundStartTime: Date | null = null;
  private foregroundStartTime: Date | null = null;
  private debugEnabled = true;
  
  // Session configuration
  private readonly ACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  private readonly HEARTBEAT_INTERVAL = 30 * 1000; // 30 seconds
  private readonly SESSION_RENEWAL_THRESHOLD = 4 * 60 * 60 * 1000; // 4 hours

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  private log(message: string, data?: any) {
    if (this.debugEnabled) {
      const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
      console.log(`[SessionManager:${timestamp}] ${message}`, data || '');
    }
  }

  private error(message: string, error?: any) {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    console.error(`[SessionManager:${timestamp}] ERROR: ${message}`, error || '');
  }

  public async initialize(): Promise<void> {
    this.log('Initializing SessionManager');
    
    // Set up app state listeners for mobile
    this.setupAppStateListeners();
    
    // Set up activity tracking
    this.setupActivityTracking();
    
    // Set up network state monitoring
    this.setupNetworkMonitoring();
    
    // Set up periodic heartbeat
    this.setupHeartbeat();
    
    this.log('SessionManager initialized successfully');
  }

  private setupAppStateListeners(): void {
    // Handle app visibility changes (mobile-friendly)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.handleAppBackground();
      } else {
        this.handleAppForeground();
      }
    });

    // Handle page focus/blur
    window.addEventListener('focus', () => this.handleAppForeground());
    window.addEventListener('blur', () => this.handleAppBackground());

    // Handle beforeunload for graceful session termination
    window.addEventListener('beforeunload', () => {
      this.terminateSession();
    });

    // Handle page navigation
    window.addEventListener('popstate', () => {
      this.trackPageView(window.location.pathname);
    });
  }

  private setupActivityTracking(): void {
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    activityEvents.forEach(event => {
      document.addEventListener(event, () => {
        this.recordActivity();
      }, { passive: true });
    });
  }

  private setupNetworkMonitoring(): void {
    // Monitor network state changes
    window.addEventListener('online', () => {
      this.updateNetworkState('online');
    });

    window.addEventListener('offline', () => {
      this.updateNetworkState('offline');
    });

    // Monitor connection quality if available
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        connection.addEventListener('change', () => {
          const effectiveType = connection.effectiveType;
          const networkState = effectiveType === 'slow-2g' || effectiveType === '2g' ? 'slow' : 'online';
          this.updateNetworkState(networkState);
        });
      }
    }
  }

  private setupHeartbeat(): void {
    setInterval(() => {
      if (this.currentSession?.isActive) {
        this.sendHeartbeat();
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  public async startSession(userId: string, options: {
    entryPage?: string;
    deviceType?: string;
    userAgent?: string;
    appVersion?: string;
  } = {}): Promise<string | null> {
    try {
      this.log('Starting new session', { userId, options });

      // Generate session fingerprint
      this.sessionFingerprint = await this.generateSessionFingerprint(options);

      // Detect location and other context
      const locationData = await SessionTrackingService.detectLocation();
      const utmParams = SessionTrackingService.extractUtmParameters();

      // Get device and system info
      const deviceInfo = this.getDeviceInfo();

      // Create session in database
      const sessionId = await supabase.rpc('enhanced_session_manager', {
        p_user_id: userId,
        p_action: 'create',
        p_device_type: options.deviceType || deviceInfo.deviceType,
        p_user_agent: options.userAgent || navigator.userAgent,
        p_entry_page: options.entryPage || window.location.pathname,
        p_last_active_page: window.location.pathname,
        p_session_fingerprint: this.sessionFingerprint,
        p_app_version: options.appVersion || this.getAppVersion(),
        p_network_state: this.getNetworkState(),
        p_battery_level: await this.getBatteryLevel(),
        p_memory_usage: this.getMemoryUsage(),
        p_platform: deviceInfo.platform,
        ...locationData,
        ...utmParams
      });

      if (sessionId.error) {
        this.error('Failed to create session in database:', sessionId.error);
        return null;
      }

      // Initialize local session state
      this.currentSession = {
        id: sessionId.data,
        isActive: true,
        state: 'active',
        startTime: new Date(),
        lastActivity: new Date(),
        pageViews: 1,
        qualityScore: 1.0,
        appVersion: options.appVersion || this.getAppVersion(),
        networkState: this.getNetworkState(),
        batteryLevel: await this.getBatteryLevel(),
        memoryUsage: this.getMemoryUsage()
      };

      this.foregroundStartTime = new Date();
      this.log('Session started successfully', { sessionId: sessionId.data });
      
      return sessionId.data;
    } catch (error) {
      this.error('Exception starting session:', error);
      return null;
    }
  }

  public async updateSession(data: {
    lastActivePage?: string;
    additionalData?: Record<string, any>;
  } = {}): Promise<void> {
    if (!this.currentSession?.id) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      await supabase.rpc('enhanced_session_manager', {
        p_user_id: user.id,
        p_action: 'update',
        p_last_active_page: data.lastActivePage || window.location.pathname,
        p_network_state: this.getNetworkState(),
        p_battery_level: await this.getBatteryLevel(),
        p_memory_usage: this.getMemoryUsage()
      });

      this.currentSession.lastActivity = new Date();
      this.currentSession.pageViews++;
    } catch (error) {
      this.error('Failed to update session:', error);
    }
  }

  private async handleAppBackground(): Promise<void> {
    if (!this.currentSession?.id) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    this.log('App going to background');
    this.backgroundStartTime = new Date();

    try {
      await supabase.rpc('enhanced_session_manager', {
        p_user_id: user.id,
        p_action: 'background'
      });

      this.currentSession.state = 'background';
    } catch (error) {
      this.error('Failed to handle app background:', error);
    }
  }

  private async handleAppForeground(): Promise<void> {
    if (!this.currentSession?.id) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    this.log('App coming to foreground');
    this.foregroundStartTime = new Date();

    try {
      await supabase.rpc('enhanced_session_manager', {
        p_user_id: user.id,
        p_action: 'foreground'
      });

      this.currentSession.state = 'active';
      this.currentSession.lastActivity = new Date();
    } catch (error) {
      this.error('Failed to handle app foreground:', error);
    }
  }

  public async terminateSession(): Promise<void> {
    if (!this.currentSession?.id) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      this.log('Terminating session', { sessionId: this.currentSession.id });

      await supabase.rpc('enhanced_session_manager', {
        p_user_id: user.id,
        p_action: 'terminate'
      });

      this.currentSession.isActive = false;
      this.currentSession.state = 'terminated';
      
      // Clear timers
      if (this.activityTimer) {
        clearTimeout(this.activityTimer);
        this.activityTimer = null;
      }

      this.log('Session terminated successfully');
    } catch (error) {
      this.error('Failed to terminate session:', error);
    }
  }

  public trackPageView(page: string): void {
    this.log('Tracking page view', { page });
    this.updateSession({ lastActivePage: page });
  }

  public recordActivity(): void {
    if (!this.currentSession?.isActive) return;

    this.currentSession.lastActivity = new Date();

    // Reset activity timeout
    if (this.activityTimer) {
      clearTimeout(this.activityTimer);
    }

    this.activityTimer = setTimeout(() => {
      this.handleInactivity();
    }, this.ACTIVITY_TIMEOUT);
  }

  private handleInactivity(): void {
    if (this.currentSession?.isActive) {
      this.log('User inactive for extended period');
      this.currentSession.state = 'inactive';
    }
  }

  private async sendHeartbeat(): Promise<void> {
    if (!this.currentSession?.isActive) return;

    try {
      await this.updateSession({
        additionalData: {
          heartbeat: new Date().toISOString(),
          batteryLevel: await this.getBatteryLevel(),
          memoryUsage: this.getMemoryUsage(),
          networkState: this.getNetworkState()
        }
      });
    } catch (error) {
      this.error('Heartbeat failed:', error);
    }
  }

  private updateNetworkState(state: 'online' | 'offline' | 'slow'): void {
    if (this.currentSession) {
      this.currentSession.networkState = state;
      this.log('Network state changed', { state });
    }
  }

  private async generateSessionFingerprint(options: any): Promise<string> {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      options.deviceType || 'unknown',
      Date.now().toString()
    ];

    const fingerprint = components.join('|');
    const encoder = new TextEncoder();
    const data = encoder.encode(fingerprint);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private getDeviceInfo() {
    const userAgent = navigator.userAgent.toLowerCase();
    let deviceType = 'desktop';
    let platform = 'web';

    if (/android/i.test(userAgent)) {
      deviceType = 'mobile';
      platform = 'android';
    } else if (/iphone|ipad|ipod/i.test(userAgent)) {
      deviceType = 'mobile';
      platform = 'ios';
    } else if (/tablet/i.test(userAgent)) {
      deviceType = 'tablet';
    }

    return { deviceType, platform };
  }

  private getAppVersion(): string {
    // Try to get version from build metadata or package.json
    return process.env.npm_package_version || '1.0.0';
  }

  private getNetworkState(): 'online' | 'offline' | 'slow' {
    if (!navigator.onLine) return 'offline';
    
    const connection = (navigator as any).connection;
    if (connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g') {
      return 'slow';
    }
    
    return 'online';
  }

  private async getBatteryLevel(): Promise<number | undefined> {
    try {
      if ('getBattery' in navigator) {
        const battery = await (navigator as any).getBattery();
        return Math.round(battery.level * 100);
      }
    } catch (error) {
      // Battery API not available or blocked
    }
    return undefined;
  }

  private getMemoryUsage(): number | undefined {
    try {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        return memory.usedJSHeapSize;
      }
    } catch (error) {
      // Memory API not available
    }
    return undefined;
  }

  public getCurrentSession(): SessionState | null {
    return this.currentSession;
  }

  public getSessionMetrics(): SessionMetrics | null {
    if (!this.currentSession) return null;

    const now = new Date();
    const duration = now.getTime() - this.currentSession.startTime.getTime();

    return {
      duration,
      foregroundTime: this.foregroundStartTime ? now.getTime() - this.foregroundStartTime.getTime() : 0,
      backgroundTime: this.backgroundStartTime ? now.getTime() - this.backgroundStartTime.getTime() : 0,
      appLaunchCount: 1, // Will be updated from database
      pageViews: this.currentSession.pageViews,
      qualityScore: this.currentSession.qualityScore,
      crashCount: 0, // Will be tracked separately
      errorCount: 0 // Will be tracked separately
    };
  }

  public setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
    this.log(`Debug logging ${enabled ? 'enabled' : 'disabled'}`);
  }

  public recordError(error: Error): void {
    this.log('Recording error in session', { error: error.message });
    // This could update the session error count in the database
  }

  public recordCrash(): void {
    this.log('Recording crash in session');
    // This could update the session crash count in the database
  }
}

export const sessionManager = SessionManager.getInstance();