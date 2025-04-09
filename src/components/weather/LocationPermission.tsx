
import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LocationPermissionProps {
  onRequestPermission: () => void;
  permissionState: 'granted' | 'denied' | 'prompt' | null;
  error: string | null;
}

export const LocationPermission: React.FC<LocationPermissionProps> = ({ 
  onRequestPermission, 
  permissionState,
  error 
}) => {
  return (
    <motion.div
      className="p-6 bg-gradient-to-br from-theme/10 to-theme/5 rounded-xl shadow-sm"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-theme/20 rounded-full flex items-center justify-center mb-4">
          <MapPin className="h-8 w-8 text-theme" />
        </div>
        
        <h3 className="text-xl font-semibold mb-2">
          {permissionState === 'denied' 
            ? 'Location Permission Denied' 
            : 'Enable Location Services'}
        </h3>
        
        <p className="text-muted-foreground mb-6 max-w-xs">
          {permissionState === 'denied' 
            ? 'Please enable location services in your browser settings to see the weather information for your current location.' 
            : 'Allow access to your location to see real-time weather information for your area.'}
        </p>
        
        {error && (
          <div className="flex items-center text-red-500 mb-4 text-sm">
            <AlertCircle className="h-4 w-4 mr-2" />
            <span>{error}</span>
          </div>
        )}
        
        <Button 
          onClick={onRequestPermission}
          className="bg-theme hover:bg-theme/90"
          disabled={permissionState === 'denied'}
        >
          {permissionState === 'denied' 
            ? 'Update Browser Settings' 
            : 'Enable Location'}
        </Button>
        
        {permissionState === 'denied' && (
          <p className="text-xs text-muted-foreground mt-4">
            You'll need to update location permissions in your browser settings
          </p>
        )}
      </div>
    </motion.div>
  );
};
