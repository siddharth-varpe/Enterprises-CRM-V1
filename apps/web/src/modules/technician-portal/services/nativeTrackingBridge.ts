import { Capacitor, registerPlugin } from '@capacitor/core';

export interface NativeTrackingStatus {
  isRunning: boolean;
  status: 'STOPPED' | 'STARTING' | 'TRACKING' | 'PERMISSION_REQUIRED' | 'LOCATION_UNAVAILABLE' | 'NETWORK_UNAVAILABLE' | 'SERVICE_ERROR';
  activeServiceId: string;
  lastUpdate: number;
}

export interface NativeTrackingPlugin {
  startTracking(options: {
    apiUrl: string;
    token: string;
    serviceId: string;
    technicianName?: string;
  }): Promise<{ success: boolean; status: string; serviceId?: string }>;

  stopTracking(): Promise<{ success: boolean; status: string }>;

  getTrackingStatus(): Promise<NativeTrackingStatus>;

  requestTrackingPermissions(): Promise<{
    locationGranted: boolean;
    status: string;
  }>;
}

const TechnicianTracking = registerPlugin<NativeTrackingPlugin>('TechnicianTracking');

/**
 * Checks if the current environment is running as a native Android or iOS mobile application.
 */
export function isNativeMobilePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Native Tracking Bridge: Clean, fault-tolerant wrapper around the native Android Foreground Location Service.
 */
export const nativeTrackingBridge = {
  isAvailable(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  },

  async startTracking(options: {
    apiUrl: string;
    token: string;
    serviceId: string;
    technicianName?: string;
  }): Promise<{ success: boolean; status: string; serviceId?: string }> {
    if (!this.isAvailable()) {
      return { success: false, status: 'NOT_NATIVE' };
    }
    return TechnicianTracking.startTracking(options);
  },

  async stopTracking(): Promise<{ success: boolean; status: string }> {
    if (!this.isAvailable()) {
      return { success: false, status: 'NOT_NATIVE' };
    }
    return TechnicianTracking.stopTracking();
  },

  async getTrackingStatus(): Promise<NativeTrackingStatus | null> {
    if (!this.isAvailable()) {
      return null;
    }
    try {
      return await TechnicianTracking.getTrackingStatus();
    } catch {
      return null;
    }
  },

  async requestPermissions(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    try {
      const res = await TechnicianTracking.requestTrackingPermissions();
      return Boolean(res.locationGranted);
    } catch {
      return false;
    }
  },
};
