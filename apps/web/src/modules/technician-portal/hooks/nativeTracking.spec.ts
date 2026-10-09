import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nativeTrackingBridge, isNativeMobilePlatform } from '../services/nativeTrackingBridge';
import { Capacitor } from '@capacitor/core';

describe('Native Android Background Tracking Bridge Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly reports availability false in standard web browser environment', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
    expect(nativeTrackingBridge.isAvailable()).toBe(false);
    expect(isNativeMobilePlatform()).toBe(false);
  });

  it('correctly reports availability true when running in native Android environment', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
    expect(nativeTrackingBridge.isAvailable()).toBe(true);
    expect(isNativeMobilePlatform()).toBe(true);
  });

  it('safely handles startTracking and stopTracking when not on native platform without errors', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
    const startRes = await nativeTrackingBridge.startTracking({
      apiUrl: 'https://crm.example.com/api/v1',
      token: 'test-nav-token-123',
      serviceId: 'srv-101',
    });
    expect(startRes.success).toBe(false);
    expect(startRes.status).toBe('NOT_NATIVE');

    const stopRes = await nativeTrackingBridge.stopTracking();
    expect(stopRes.success).toBe(false);
    expect(stopRes.status).toBe('NOT_NATIVE');

    const status = await nativeTrackingBridge.getTrackingStatus();
    expect(status).toBeNull();
  });
});
