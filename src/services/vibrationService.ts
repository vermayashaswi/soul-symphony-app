
/**
 * Vibration Service
 * Provides haptic feedback for both web and native environments
 */

import { webToNativeDetection } from './webToNativeDetectionService';

export type VibrationPattern = number | number[];
export type HapticImpactStyle = 'light' | 'medium' | 'heavy';

class VibrationService {
  async vibrate(pattern: VibrationPattern = 200): Promise<boolean> {
    const deviceInfo = await webToNativeDetection.getDeviceInfo();

    if (deviceInfo.isNative) {
      return this.vibrateNative(pattern);
    } else {
      return this.vibrateWeb(pattern);
    }
  }

  async hapticImpact(style: HapticImpactStyle = 'light'): Promise<boolean> {
    const deviceInfo = await webToNativeDetection.getDeviceInfo();

    if (deviceInfo.isNative) {
      return this.hapticImpactNative(style);
    } else {
      // Fallback to regular vibration for web
      const duration = style === 'light' ? 50 : style === 'medium' ? 100 : 200;
      return this.vibrateWeb(duration);
    }
  }

  private async vibrateNative(pattern: VibrationPattern): Promise<boolean> {
    try {
      const dynamicImport = new Function('specifier', 'return import(specifier)');
      const { Haptics, ImpactStyle } = await dynamicImport('@capacitor/haptics');

      if (typeof pattern === 'number') {
        await Haptics.vibrate({ duration: pattern });
      } else {
        // For pattern arrays, simulate with multiple vibrations
        for (let i = 0; i < pattern.length; i++) {
          if (i % 2 === 0) {
            // Vibrate
            await Haptics.vibrate({ duration: pattern[i] });
          } else {
            // Pause
            await new Promise(resolve => setTimeout(resolve, pattern[i]));
          }
        }
      }
      
      return true;
    } catch (error) {
      console.log('Native vibration not available:', error);
      return false;
    }
  }

  private async hapticImpactNative(style: HapticImpactStyle): Promise<boolean> {
    try {
      const dynamicImport = new Function('specifier', 'return import(specifier)');
      const { Haptics, ImpactStyle } = await dynamicImport('@capacitor/haptics');

      const impactStyle = style === 'light' ? ImpactStyle.Light : 
                         style === 'medium' ? ImpactStyle.Medium : 
                         ImpactStyle.Heavy;

      await Haptics.impact({ style: impactStyle });
      return true;
    } catch (error) {
      console.log('Native haptic impact not available:', error);
      return false;
    }
  }

  private vibrateWeb(pattern: VibrationPattern): Promise<boolean> {
    return new Promise((resolve) => {
      if ('vibrate' in navigator) {
        try {
          const result = navigator.vibrate(pattern);
          resolve(result);
        } catch (error) {
          console.log('Web vibration failed:', error);
          resolve(false);
        }
      } else {
        console.log('Web vibration not supported');
        resolve(false);
      }
    });
  }

  async isVibrationSupported(): Promise<boolean> {
    const deviceInfo = await webToNativeDetection.getDeviceInfo();

    if (deviceInfo.isNative) {
      try {
        const dynamicImport = new Function('specifier', 'return import(specifier)');
        await dynamicImport('@capacitor/haptics');
        return true;
      } catch {
        return false;
      }
    } else {
      return 'vibrate' in navigator;
    }
  }
}

export const vibrationService = new VibrationService();
