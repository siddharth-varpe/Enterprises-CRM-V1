import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTechnicianTracking, _resetSharedTrackingStateForTesting } from './useTechnicianTracking';

// Mock Socket.IO
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
  })),
}));

describe('useTechnicianTracking Hook Suite', () => {
  let mockWatchPositionId = 42;
  let mockClearWatch = vi.fn();
  let mockWatchPosition = vi.fn();
  let originalGeolocation: any;
  let originalOpen: any;
  let originalFetch: any;

  beforeEach(() => {
    vi.clearAllMocks();
    _resetSharedTrackingStateForTesting();

    originalGeolocation = navigator.geolocation;
    originalOpen = window.open;
    originalFetch = global.fetch;

    window.open = vi.fn();

    (navigator as any).geolocation = {
      watchPosition: mockWatchPosition.mockImplementation((success) => {
        // Trigger once immediately with mock coordinates
        success({
          coords: {
            latitude: 18.5204,
            longitude: 73.8567,
            accuracy: 10,
            heading: 90,
            speed: 5,
          },
          timestamp: Date.now(),
        });
        return mockWatchPositionId;
      }),
      clearWatch: mockClearWatch,
    };

    global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
      if (url.includes('/api/v1/maps/technician/active')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: { isNavigating: false, destination: null } }),
        });
      }

      if (url.includes('/api/v1/maps/technician/navigate')) {
        const body = options?.body ? JSON.parse(options.body) : {};
        if (body.serviceId === 'conflict-service') {
          return Promise.resolve({
            ok: false,
            status: 409,
            json: () =>
              Promise.resolve({
                conflict: true,
                activeServiceId: 'srv-101',
                activeServiceNumber: 'SRV-101',
              }),
          });
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              trackingStatus: 'ON_THE_WAY',
              destination: {
                serviceId: body.serviceId,
                customerName: 'Test Customer',
              },
              googleMapsUrl: 'https://www.google.com/maps/dir/?api=1&destination=18.5204,73.8567',
            }),
        });
      }

      if (url.includes('/api/v1/maps/technician/location')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true }),
        });
      }

      if (url.includes('/api/v1/maps/technician/stop')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true }),
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });
    });
  });

  afterEach(() => {
    _resetSharedTrackingStateForTesting();
    (navigator as any).geolocation = originalGeolocation;
    window.open = originalOpen;
    global.fetch = originalFetch;
  });

  it('initializes in NOT_TRACKING state and checks server active state', async () => {
    const { result } = renderHook(() => useTechnicianTracking('srv-1'));

    expect(result.current.isNavigating).toBe(false);
    expect(result.current.trackingStatus).toBe('NOT_TRACKING');
    expect(result.current.activeServiceId).toBeNull();
  });

  it('initiates navigation, starts device GPS watch, and opens Google Maps external directions URL', async () => {
    const { result } = renderHook(() => useTechnicianTracking('srv-101'));

    await act(async () => {
      await result.current.navigate('srv-101');
    });

    // Verifies /api/v1/maps/technician/navigate was invoked with serviceId
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/maps/technician/navigate',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ serviceId: 'srv-101', confirmSwitch: false }),
      })
    );

    // Verifies continuous GPS watch was registered
    expect(mockWatchPosition).toHaveBeenCalled();

    // Verifies state updated to ON_THE_WAY and activeServiceId set
    expect(result.current.isNavigating).toBe(true);
    expect(result.current.activeServiceId).toBe('srv-101');
    expect(result.current.trackingStatus).toBe('ON_THE_WAY');

    // Verifies Google Maps navigation directions opened
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining('google.com/maps/dir'),
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('stops tracking, clears device geolocation watch, and updates state', async () => {
    const { result } = renderHook(() => useTechnicianTracking('srv-101'));

    await act(async () => {
      await result.current.navigate('srv-101');
    });

    expect(result.current.isNavigating).toBe(true);

    await act(async () => {
      await result.current.stopTracking();
    });

    // Verifies server cleanup was called
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/maps/technician/stop',
      expect.objectContaining({ method: 'POST' })
    );

    // Verifies browser GPS watch was cleared
    expect(mockClearWatch).toHaveBeenCalledWith(mockWatchPositionId);

    // Verifies state cleared
    expect(result.current.isNavigating).toBe(false);
    expect(result.current.activeServiceId).toBeNull();
    expect(result.current.trackingStatus).toBe('NOT_TRACKING');
  });

  it('detects 409 conflict and opens conflictModal when attempting to navigate a different service (Section 10)', async () => {
    const { result } = renderHook(() => useTechnicianTracking('srv-101'));

    // Attempt to navigate to a conflicting service
    await act(async () => {
      await result.current.navigate('conflict-service');
    });

    // Conflict modal is opened
    expect(result.current.conflictModal).not.toBeNull();
    expect(result.current.conflictModal?.isOpen).toBe(true);
    expect(result.current.conflictModal?.activeServiceId).toBe('srv-101');
    expect(result.current.conflictModal?.pendingServiceId).toBe('conflict-service');

    // Dismissing conflict modal clears it
    act(() => {
      result.current.dismissConflictModal();
    });
    expect(result.current.conflictModal).toBeNull();
  });

  it('CASE 1, 2 & 3: requests permission, starts watchPosition on grant, and transmits initial GPS fix', async () => {
    let getCurrentPositionCallback: any;
    (navigator as any).geolocation.getCurrentPosition = vi.fn().mockImplementation((success) => {
      getCurrentPositionCallback = success;
    });

    const { result } = renderHook(() => useTechnicianTracking('srv-101'));

    let grantedPromise: Promise<boolean>;
    act(() => {
      grantedPromise = result.current.requestPermission();
    });

    // Verify browser requested permission via getCurrentPosition
    expect((navigator as any).geolocation.getCurrentPosition).toHaveBeenCalled();

    // Simulate user clicking "Allow" on browser prompt
    await act(async () => {
      getCurrentPositionCallback({
        coords: {
          latitude: 18.5204,
          longitude: 73.8567,
          accuracy: 10,
        },
        timestamp: Date.now(),
      });
      await grantedPromise;
    });

    expect(result.current.permissionState).toBe('granted');
    expect(mockWatchPosition).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/maps/technician/location',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"latitude":18.5204'),
      })
    );
  });

  it('CASE 9: clicking Navigate repeatedly NEVER creates duplicate geolocation watchers', async () => {
    const { result } = renderHook(() => useTechnicianTracking('srv-101'));

    mockWatchPosition.mockClear();

    // First Navigate click
    await act(async () => {
      await result.current.navigate('srv-101');
    });
    expect(mockWatchPosition).toHaveBeenCalledTimes(1);

    // Repeated Navigate clicks on same service
    await act(async () => {
      await result.current.navigate('srv-101');
      await result.current.navigate('srv-101');
    });

    // Still exactly ONE active watcher established! No duplicates
    expect(mockWatchPosition).toHaveBeenCalledTimes(1);
  });

  it('CASE 11 & 13: handles DENIED geolocation permission safely without starting fake tracking', async () => {
    (navigator as any).geolocation.getCurrentPosition = vi.fn().mockImplementation((_success, error) => {
      error({
        code: 1, // PERMISSION_DENIED
        message: 'User denied Geolocation',
      });
    });

    const { result } = renderHook(() => useTechnicianTracking('srv-101'));

    mockWatchPosition.mockClear();

    let granted: boolean = true;
    await act(async () => {
      granted = await result.current.requestPermission();
    });

    expect(granted).toBe(false);
    expect(result.current.permissionState).toBe('denied');
    expect(result.current.error).toContain('Location permission was denied');
    expect(result.current.isWatching).toBe(false);
    // Verified: NO fake watcher started when denied
    expect(mockWatchPosition).not.toHaveBeenCalled();
  });
});
