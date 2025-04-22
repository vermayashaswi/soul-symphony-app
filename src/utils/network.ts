
/**
 * Utility functions for detecting network conditions and optimizing loading
 */
import React, { useState, useEffect } from 'react';

// Types for network speed
export type NetworkSpeed = 'fast' | 'medium' | 'slow' | 'offline';

// Interface for network status
export interface NetworkStatus {
  online: boolean;
  speed: NetworkSpeed;
  downlink?: number; // in Mbps
  rtt?: number; // round trip time in ms
  saveData: boolean; // whether data saver is enabled
}

/**
 * Get current network status including speed estimation
 */
export function getNetworkStatus(): NetworkStatus {
  // Default values
  const defaultStatus: NetworkStatus = {
    online: navigator.onLine,
    speed: 'medium',
    saveData: false
  };

  // If offline, return right away
  if (!navigator.onLine) {
    return { ...defaultStatus, online: false, speed: 'offline' };
  }

  // Check if the browser supports Network Information API
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    
    if (connection) {
      // Get downlink if available
      const downlink = connection.downlink;
      
      // Determine speed based on downlink
      let speed: NetworkSpeed = 'medium';
      if (downlink) {
        if (downlink < 0.5) speed = 'slow';
        else if (downlink < 2) speed = 'medium';
        else speed = 'fast';
      }
      
      return {
        online: true,
        speed,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData || false
      };
    }
  }
  
  return defaultStatus;
}

/**
 * Custom hook for monitoring network status
 */
export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>(getNetworkStatus());
  
  useEffect(() => {
    const handleOnline = () => {
      setStatus(prev => ({ ...prev, online: true }));
    };
    
    const handleOffline = () => {
      setStatus(prev => ({ ...prev, online: false, speed: 'offline' }));
    };
    
    const handleConnectionChange = () => {
      setStatus(getNetworkStatus());
    };
    
    // Listen for online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Listen for connection changes if the API is available
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        connection.addEventListener('change', handleConnectionChange);
      }
    }
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        if (connection) {
          connection.removeEventListener('change', handleConnectionChange);
        }
      }
    };
  }, []);
  
  return status;
}

/**
 * Utility to determine image quality based on network conditions
 */
export function getOptimizedImageQuality(networkStatus: NetworkStatus): 'low' | 'medium' | 'high' {
  if (!networkStatus.online || networkStatus.speed === 'offline') {
    return 'low';
  }
  
  if (networkStatus.saveData) {
    return 'low';
  }
  
  switch (networkStatus.speed) {
    case 'slow':
      return 'low';
    case 'medium':
      return 'medium';
    case 'fast':
      return 'high';
    default:
      return 'medium';
  }
}
