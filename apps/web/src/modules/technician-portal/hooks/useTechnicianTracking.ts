import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { io, Socket } from 'socket.io-client';
import { resolveApiUrl, getApiBaseUrl } from '../../../lib/api-client';
import { nativeTrackingBridge } from '../services/nativeTrackingBridge';

export type TrackingStatus =
  | 'NOT_TRACKING'
  | 'UNTRACKED'
  | 'LOCATION_PERMISSION'
  | 'TRACKING_READY'
  | 'NAVIGATION_STARTING'
  | 'NAVIGATION_SELECTED'
  | 'ON_THE_WAY'
  | 'ARRIVAL_PENDING'
  | 'AT_CUSTOMER'
  | 'STALE'
  | 'OFFLINE'
  | 'NAVIGATION_ERROR'
  | 'NAVIGATION_ENDED'
  | 'STOPPED_ON_WAY';

export type GeolocationPermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported' | 'insecure_context';

export type DiagnosticReason =
  | 'INSECURE_CONTEXT'
  | 'PERMISSION_DENIED'
  | 'POSITION_UNAVAILABLE'
  | 'TIMEOUT'
  | 'API_UNAVAILABLE'
  | null;

export interface TrackingDiagnostics {
  isSecureContext: boolean;
  hasGeolocation: boolean;
  protocol: string;
  origin: string;
  permissionQueryState: string | null;
  errorCode: number | null;
  diagnosticReason: DiagnosticReason;
  lastUpdateReachedBackend: boolean;
}

export interface ActiveDestination {
  serviceId: string;
  serviceNumber: string;
  jobCardId?: string | null;
  jobCardNumber?: string | null;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  address: string;
  latitude: number;
  longitude: number;
  scheduledDate?: string | null;
  scheduledTimeSlot?: string | null;
}

export interface TechnicianTrackingState {
  isNavigating: boolean;
  activeServiceId: string | null;
  trackingStatus: TrackingStatus;
  destination: ActiveDestination | null;
  distanceText: string | null;
  etaText: string | null;
  lastUpdate: number | null;
  error: string | null;
  permissionState: GeolocationPermissionState;
  isWatching: boolean;
  diagnosticReason: DiagnosticReason;
  diagnostics: TrackingDiagnostics;
}

export interface ConflictModalState {
  isOpen: boolean;
  activeServiceId: string;
  activeServiceNumber: string;
  pendingServiceId: string;
}

export interface TechnicianTrackingContextValue {
  state: TechnicianTrackingState;
  isNavigating: boolean;
  activeServiceId: string | null;
  trackingStatus: TrackingStatus;
  destination: ActiveDestination | null;
  distanceText: string | null;
  etaText: string | null;
  lastUpdate: number | null;
  error: string | null;
  permissionState: GeolocationPermissionState;
  isWatching: boolean;
  diagnosticReason: DiagnosticReason;
  diagnostics: TrackingDiagnostics;
  conflictModal: ConflictModalState | null;
  dismissConflictModal: () => void;
  closeConflictModal?: () => void;
  confirmSwitchDestination: () => void;
  navigate: (serviceId: string, confirmSwitch?: boolean) => Promise<{ success?: boolean; conflict?: boolean; error?: string; googleMapsUrl?: string }>;
  stopTracking: () => Promise<void>;
  requestPermission: () => Promise<boolean>;
  startBrowserWatch: (serviceId?: string) => void;
  isThisServiceActive?: boolean;
}

let sharedWatchId: number | null = null;
let sharedSocket: Socket | null = null;

export function _resetSharedTrackingStateForTesting() {
  sharedWatchId = null;
  sharedSocket = null;
}

/**
 * Validates whether the execution environment satisfies W3C Secure Context requirements.
 * Modern browsers strictly require a secure origin (HTTPS or localhost/127.0.0.1)
 * to access navigator.geolocation.
 */
export function isContextSecure(): boolean {
  if (typeof window === 'undefined') return true;
  if (typeof window.isSecureContext === 'boolean') {
    return window.isSecureContext;
  }
  const { protocol, hostname } = window.location;
  if (protocol === 'https:') return true;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return true;
  return false;
}

function getInitialDiagnostics(): TrackingDiagnostics {
  const isSecure = isContextSecure();
  const hasGeo = typeof window !== 'undefined' && typeof navigator !== 'undefined' && Boolean(navigator.geolocation);
  const protocol = typeof window !== 'undefined' ? window.location.protocol : '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  let initialReason: DiagnosticReason = null;
  if (!isSecure) {
    initialReason = 'INSECURE_CONTEXT';
  } else if (!hasGeo) {
    initialReason = 'API_UNAVAILABLE';
  }

  return {
    isSecureContext: isSecure,
    hasGeolocation: hasGeo,
    protocol,
    origin,
    permissionQueryState: null,
    errorCode: null,
    diagnosticReason: initialReason,
    lastUpdateReachedBackend: false,
  };
}

const TechnicianTrackingContext = createContext<TechnicianTrackingContextValue | null>(null);

function useTrackingInternal(currentServiceId?: string, isProvider = false): TechnicianTrackingContextValue {
  const [state, setState] = useState<TechnicianTrackingState>(() => {
    const diag = getInitialDiagnostics();
    const isSecure = diag.isSecureContext;
    const hasGeo = diag.hasGeolocation;

    let initialPerm: GeolocationPermissionState = 'prompt';
    let initialError: string | null = null;

    if (!isSecure) {
      initialPerm = 'insecure_context';
      const host = typeof window !== 'undefined' ? window.location.host : '<domain-or-ip>';
      initialError = `Geolocation requires a secure context (HTTPS). This site is being accessed over insecure HTTP. Access via https://${host} instead.`;
    } else if (!hasGeo) {
      initialPerm = 'unsupported';
      initialError = 'Geolocation is not supported by this browser.';
    }

    return {
      isNavigating: false,
      activeServiceId: null,
      trackingStatus: 'NOT_TRACKING',
      destination: null,
      distanceText: null,
      etaText: null,
      lastUpdate: null,
      error: initialError,
      permissionState: initialPerm,
      isWatching: false,
      diagnosticReason: diag.diagnosticReason,
      diagnostics: diag,
    };
  });

  const [conflictModal, setConflictModal] = useState<ConflictModalState | null>(null);

  // Initialize Socket.IO connection once
  useEffect(() => {
    if (!sharedSocket && typeof window !== 'undefined') {
      try {
        const rawBaseUrl = getApiBaseUrl();
        const socketUrl = rawBaseUrl || window.location.origin;
        const token = typeof localStorage !== 'undefined' ? localStorage.getItem('crm_session_token') : null;
        sharedSocket = io(`${socketUrl}/maps`, {
          withCredentials: true,
          transports: ['websocket', 'polling'],
          auth: { token },
          autoConnect: true,
        });
      } catch (err) {
        console.warn('[TechnicianTracking] Socket init notice:', err);
      }
    }
  }, []);

  // Send GPS location ping to server
  const sendLocationPing = useCallback(async (position: GeolocationPosition) => {
    const payload = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      heading: position.coords.heading,
      speed: position.coords.speed,
      timestamp: position.timestamp || Date.now(),
    };

    // Try Socket.IO first
    if (sharedSocket && sharedSocket.connected) {
      sharedSocket.emit('technician:location_ping', payload, (res: any) => {
        if (res && res.record) {
          setState((prev) => ({
            ...prev,
            trackingStatus: res.record.trackingStatus || prev.trackingStatus,
            distanceText: res.record.distanceText ?? prev.distanceText,
            etaText: res.record.etaText ?? prev.etaText,
            lastUpdate: res.record.lastUpdate ?? Date.now(),
            diagnostics: {
              ...prev.diagnostics,
              lastUpdateReachedBackend: true,
            },
          }));
        }
      });
    } else {
      // Fallback to REST API
      try {
        const res = await fetch(resolveApiUrl('/maps/technician/location'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            setState((prev) => ({
              ...prev,
              trackingStatus: json.data.trackingStatus || prev.trackingStatus,
              distanceText: json.data.distanceText ?? prev.distanceText,
              etaText: json.data.etaText ?? prev.etaText,
              lastUpdate: json.data.lastUpdate ?? Date.now(),
              diagnostics: {
                ...prev.diagnostics,
                lastUpdateReachedBackend: true,
              },
            }));
          }
        } else {
          setState((prev) => ({
            ...prev,
            diagnostics: {
              ...prev.diagnostics,
              lastUpdateReachedBackend: false,
            },
          }));
        }
      } catch {
        setState((prev) => ({
          ...prev,
          diagnostics: {
            ...prev.diagnostics,
            lastUpdateReachedBackend: false,
          },
        }));
      }
    }
  }, []);

  // Continuous geolocation watch using navigator.geolocation.watchPosition
  const startBrowserWatch = useCallback((_serviceId?: string) => {
    // 1. INSECURE CONTEXT: Never call navigator.geolocation
    if (!isContextSecure()) {
      const host = typeof window !== 'undefined' ? window.location.host : '<domain-or-ip>';
      const errorMsg = `Geolocation requires a secure context (HTTPS). This site is being accessed over insecure HTTP. Access via https://${host} instead.`;
      setState((prev) => ({
        ...prev,
        permissionState: 'insecure_context',
        diagnosticReason: 'INSECURE_CONTEXT',
        error: errorMsg,
        diagnostics: {
          ...prev.diagnostics,
          isSecureContext: false,
          diagnosticReason: 'INSECURE_CONTEXT',
        },
      }));
      return;
    }

    if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        permissionState: 'unsupported',
        diagnosticReason: 'API_UNAVAILABLE',
        error: 'Geolocation is not supported by this browser.',
        diagnostics: {
          ...prev.diagnostics,
          hasGeolocation: false,
          diagnosticReason: 'API_UNAVAILABLE',
        },
      }));
      return;
    }

    // Section 9: Exactly ONE active watcher per authenticated technician session
    if (sharedWatchId !== null) {
      return;
    }

    try {
      sharedWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          setState((prev) => ({
            ...prev,
            permissionState: 'granted',
            diagnosticReason: null,
            isWatching: true,
            error: null,
            trackingStatus: prev.trackingStatus === 'NOT_TRACKING' ? 'TRACKING_READY' : prev.trackingStatus,
            diagnostics: {
              ...prev.diagnostics,
              permissionQueryState: 'granted',
              diagnosticReason: null,
              errorCode: null,
            },
          }));
          sendLocationPing(pos);
        },
        (err) => {
          let reason: DiagnosticReason = null;
          let errorMsg = 'Location tracking error.';
          if (err.code === 1) {
            // PERMISSION_DENIED
            reason = 'PERMISSION_DENIED';
            errorMsg = 'Location permission was denied. Please enable location access in your browser settings (look for the lock or site settings icon in the address bar).';
            setState((prev) => ({
              ...prev,
              permissionState: 'denied',
              diagnosticReason: 'PERMISSION_DENIED',
              isWatching: false,
              error: errorMsg,
              diagnostics: {
                ...prev.diagnostics,
                permissionQueryState: 'denied',
                diagnosticReason: 'PERMISSION_DENIED',
                errorCode: 1,
              },
            }));
            if (sharedWatchId !== null) {
              navigator.geolocation.clearWatch(sharedWatchId);
              sharedWatchId = null;
            }
          } else if (err.code === 2) {
            // POSITION_UNAVAILABLE
            reason = 'POSITION_UNAVAILABLE';
            errorMsg = 'Unable to determine location. Please ensure device location/GPS is enabled.';
            setState((prev) => ({
              ...prev,
              diagnosticReason: 'POSITION_UNAVAILABLE',
              error: errorMsg,
              diagnostics: {
                ...prev.diagnostics,
                diagnosticReason: 'POSITION_UNAVAILABLE',
                errorCode: 2,
              },
            }));
          } else if (err.code === 3) {
            // TIMEOUT
            reason = 'TIMEOUT';
            errorMsg = 'Location request timed out. Retrying...';
            setState((prev) => ({
              ...prev,
              diagnosticReason: 'TIMEOUT',
              error: errorMsg,
              diagnostics: {
                ...prev.diagnostics,
                diagnosticReason: 'TIMEOUT',
                errorCode: 3,
              },
            }));
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 10000,
          timeout: 20000,
        }
      );

      setState((prev) => ({ ...prev, isWatching: true, permissionState: 'granted' }));
    } catch (err: any) {
      console.warn('[TechnicianTracking] Failed to establish watchPosition:', err?.message);
    }
  }, [sendLocationPing]);

  // Request browser geolocation permission and acquire initial location fix
  const requestPermission = useCallback(async (): Promise<boolean> => {
    // 0. NATIVE PLATFORM: Use native runtime permissions
    if (nativeTrackingBridge.isAvailable()) {
      const granted = await nativeTrackingBridge.requestPermissions();
      if (granted) {
        setState((prev) => ({
          ...prev,
          permissionState: 'granted',
          diagnosticReason: null,
          error: null,
        }));
        return true;
      } else {
        setState((prev) => ({
          ...prev,
          permissionState: 'denied',
          diagnosticReason: 'PERMISSION_DENIED',
          error: 'Location permission was denied in device settings.',
        }));
        return false;
      }
    }

    // 1. INSECURE CONTEXT: Immediately diagnose without calling navigator.geolocation
    if (!isContextSecure()) {
      const host = typeof window !== 'undefined' ? window.location.host : '<domain-or-ip>';
      const errorMsg = `Geolocation requires a secure context (HTTPS). This site is being accessed over insecure HTTP. Access via https://${host} instead.`;
      setState((prev) => ({
        ...prev,
        permissionState: 'insecure_context',
        diagnosticReason: 'INSECURE_CONTEXT',
        error: errorMsg,
        diagnostics: {
          ...prev.diagnostics,
          isSecureContext: false,
          diagnosticReason: 'INSECURE_CONTEXT',
        },
      }));
      return false;
    }

    if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        permissionState: 'unsupported',
        diagnosticReason: 'API_UNAVAILABLE',
        error: 'Geolocation is not supported by this browser.',
        diagnostics: {
          ...prev.diagnostics,
          hasGeolocation: false,
          diagnosticReason: 'API_UNAVAILABLE',
        },
      }));
      return false;
    }

    if (typeof navigator.geolocation.getCurrentPosition !== 'function') {
      startBrowserWatch();
      return true;
    }

    return new Promise<boolean>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          setState((prev) => ({
            ...prev,
            permissionState: 'granted',
            diagnosticReason: null,
            error: null,
            trackingStatus: prev.trackingStatus === 'NOT_TRACKING' ? 'TRACKING_READY' : prev.trackingStatus,
            diagnostics: {
              ...prev.diagnostics,
              permissionQueryState: 'granted',
              diagnosticReason: null,
              errorCode: null,
            },
          }));
          await sendLocationPing(pos);
          startBrowserWatch();
          resolve(true);
        },
        (err) => {
          let reason: DiagnosticReason = null;
          let errorMsg = 'Location acquisition failed.';
          if (err.code === 1) {
            reason = 'PERMISSION_DENIED';
            errorMsg = 'Location permission was denied. Please enable location access in your browser settings (look for the lock or site settings icon in the address bar).';
          } else if (err.code === 2) {
            reason = 'POSITION_UNAVAILABLE';
            errorMsg = 'Unable to determine location. Please ensure device location/GPS is enabled.';
          } else if (err.code === 3) {
            reason = 'TIMEOUT';
            errorMsg = 'Location request timed out. Retrying...';
          }

          setState((prev) => ({
            ...prev,
            permissionState: err.code === 1 ? 'denied' : prev.permissionState,
            diagnosticReason: reason,
            error: errorMsg,
            diagnostics: {
              ...prev.diagnostics,
              errorCode: err.code,
              diagnosticReason: reason,
              permissionQueryState: err.code === 1 ? 'denied' : prev.diagnostics.permissionQueryState,
            },
          }));
          resolve(false);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 10000,
          timeout: 15000,
        }
      );
    });
  }, [sendLocationPing, startBrowserWatch]);

  // Poll server-side active tracking status on initialization
  const checkActiveTracking = useCallback(async () => {
    try {
      const res = await fetch(resolveApiUrl('/maps/technician/active'), {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data && json.data.activeDestination) {
          const dest = json.data.activeDestination;
          setState((prev) => ({
            ...prev,
            isNavigating: true,
            activeServiceId: dest.serviceId,
            trackingStatus: json.data.trackingStatus || 'ON_THE_WAY',
            destination: dest,
            distanceText: json.data.distanceText || null,
            etaText: json.data.etaText || null,
            lastUpdate: json.data.lastUpdate || Date.now(),
            error: null,
          }));

          // If tracking was active and no watcher is running, restart watchPosition
          if (sharedWatchId === null && typeof navigator !== 'undefined' && navigator.geolocation && isContextSecure()) {
            startBrowserWatch(dest.serviceId);
          }
        } else {
          setState((prev) => ({
            ...prev,
            isNavigating: false,
            activeServiceId: null,
            trackingStatus: prev.trackingStatus === 'ON_THE_WAY' ? 'TRACKING_READY' : prev.trackingStatus,
            destination: null,
          }));
        }
      }
    } catch {}
  }, [startBrowserWatch]);

  // Sections 6 & 7: Initialize location capability on portal entry
  useEffect(() => {
    let isMounted = true;

    async function initLocationCapability() {
      // 1. INSECURE CONTEXT: Diagnose immediately, do not prompt or query
      if (!isContextSecure()) {
        if (isMounted) {
          const host = typeof window !== 'undefined' ? window.location.host : '<domain-or-ip>';
          const errorMsg = `Geolocation requires a secure context (HTTPS). This site is being accessed over insecure HTTP. Access via https://${host} instead.`;
          setState((prev) => ({
            ...prev,
            permissionState: 'insecure_context',
            diagnosticReason: 'INSECURE_CONTEXT',
            error: errorMsg,
            diagnostics: {
              ...prev.diagnostics,
              isSecureContext: false,
              diagnosticReason: 'INSECURE_CONTEXT',
            },
          }));
        }
        return;
      }

      if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.geolocation) {
        if (isMounted) {
          setState((prev) => ({
            ...prev,
            permissionState: 'unsupported',
            diagnosticReason: 'API_UNAVAILABLE',
            error: 'Geolocation is not supported by this browser.',
            diagnostics: {
              ...prev.diagnostics,
              hasGeolocation: false,
              diagnosticReason: 'API_UNAVAILABLE',
            },
          }));
        }
        return;
      }

      // Check current permission state if navigator.permissions is supported
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const permStatus = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          if (!isMounted) return;

          if (permStatus.state === 'granted') {
            setState((prev) => ({
              ...prev,
              permissionState: 'granted',
              diagnostics: {
                ...prev.diagnostics,
                permissionQueryState: 'granted',
              },
            }));
            startBrowserWatch();
          } else if (permStatus.state === 'prompt') {
            // Keep prompt state without unprompted getCurrentPosition call (user can click Enable Location)
            setState((prev) => ({
              ...prev,
              permissionState: 'prompt',
              diagnostics: {
                ...prev.diagnostics,
                permissionQueryState: 'prompt',
              },
            }));
          } else if (permStatus.state === 'denied') {
            const errorMsg = 'Location permission was denied. Please enable location access in your browser settings (look for the lock or site settings icon in the address bar).';
            setState((prev) => ({
              ...prev,
              permissionState: 'denied',
              diagnosticReason: 'PERMISSION_DENIED',
              error: errorMsg,
              diagnostics: {
                ...prev.diagnostics,
                permissionQueryState: 'denied',
                diagnosticReason: 'PERMISSION_DENIED',
                errorCode: 1,
              },
            }));
          }

          permStatus.onchange = () => {
            if (!isMounted) return;
            if (permStatus.state === 'granted') {
              setState((prev) => ({
                ...prev,
                permissionState: 'granted',
                diagnosticReason: null,
                error: null,
                diagnostics: {
                  ...prev.diagnostics,
                  permissionQueryState: 'granted',
                  diagnosticReason: null,
                },
              }));
              startBrowserWatch();
            } else if (permStatus.state === 'denied') {
              const errorMsg = 'Location permission was denied. Please enable location access in your browser settings (look for the lock or site settings icon in the address bar).';
              setState((prev) => ({
                ...prev,
                permissionState: 'denied',
                diagnosticReason: 'PERMISSION_DENIED',
                isWatching: false,
                error: errorMsg,
                diagnostics: {
                  ...prev.diagnostics,
                  permissionQueryState: 'denied',
                  diagnosticReason: 'PERMISSION_DENIED',
                  errorCode: 1,
                },
              }));
              if (sharedWatchId !== null) {
                navigator.geolocation.clearWatch(sharedWatchId);
                sharedWatchId = null;
              }
            }
          };
          return;
        } catch {
          // Permissions API query not supported in this environment, fallback
        }
      }

      // Fallback: stay in prompt state until user clicks button
      if (isMounted) {
        setState((prev) => ({ ...prev, permissionState: 'prompt' }));
      }
    }

    if (isProvider) {
      initLocationCapability();
    }
    checkActiveTracking();

    return () => {
      isMounted = false;
      if (!isProvider && sharedWatchId !== null && typeof navigator !== 'undefined' && typeof navigator.geolocation?.clearWatch === 'function') {
        try {
          navigator.geolocation.clearWatch(sharedWatchId);
        } catch {}
        sharedWatchId = null;
      }
    };
  }, [isProvider, startBrowserWatch, checkActiveTracking]);

  // Navigate trigger action
  const handleNavigate = useCallback(
    async (targetServiceId: string, confirmSwitch = false) => {
      setState((prev) => ({ ...prev, error: null, trackingStatus: 'NAVIGATION_STARTING' }));

      // 1. Verify Secure Context & Geolocation API Availability
      if (!isContextSecure()) {
        const host = typeof window !== 'undefined' ? window.location.host : '<domain-or-ip>';
        const errorMsg = `Geolocation requires a secure context (HTTPS). This site is being accessed over insecure HTTP. Access via https://${host} instead.`;
        setState((prev) => ({
          ...prev,
          permissionState: 'insecure_context',
          diagnosticReason: 'INSECURE_CONTEXT',
          trackingStatus: 'NOT_TRACKING',
          error: errorMsg,
          diagnostics: {
            ...prev.diagnostics,
            isSecureContext: false,
            diagnosticReason: 'INSECURE_CONTEXT',
          },
        }));
        return { success: false, error: errorMsg };
      }

      if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.geolocation) {
        const errorMsg = 'Geolocation is not supported by this browser.';
        setState((prev) => ({
          ...prev,
          permissionState: 'unsupported',
          diagnosticReason: 'API_UNAVAILABLE',
          trackingStatus: 'NOT_TRACKING',
          error: errorMsg,
          diagnostics: {
            ...prev.diagnostics,
            hasGeolocation: false,
            diagnosticReason: 'API_UNAVAILABLE',
          },
        }));
        return { success: false, error: errorMsg };
      }

      // 2. Acquire immediate device GPS location fix before backgrounding tab to external maps
      let initialPos: GeolocationPosition | null = null;
      if (typeof navigator.geolocation.getCurrentPosition === 'function') {
        try {
          initialPos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 5000,
            });
          });
          // Immediately transmit fresh coordinates to backend
          await sendLocationPing(initialPos);
        } catch (geoErr: any) {
          if (geoErr?.code === 1) {
            // PERMISSION_DENIED
            const errorMsg = 'Location permission was denied. Please enable location access in your browser settings to start live tracking.';
            setState((prev) => ({
              ...prev,
              permissionState: 'denied',
              diagnosticReason: 'PERMISSION_DENIED',
              trackingStatus: 'NOT_TRACKING',
              error: errorMsg,
              diagnostics: {
                ...prev.diagnostics,
                permissionQueryState: 'denied',
                diagnosticReason: 'PERMISSION_DENIED',
                errorCode: 1,
              },
            }));
            return { success: false, error: errorMsg };
          }
          console.warn('[TechnicianTracking] Pre-navigation getCurrentPosition notice:', geoErr?.message);
        }
      }

      try {
        const res = await fetch(resolveApiUrl('/maps/technician/navigate'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            serviceId: targetServiceId,
            confirmSwitch,
            latitude: initialPos?.coords.latitude,
            longitude: initialPos?.coords.longitude,
          }),
        });

        const json = await res.json();

        // 409 Conflict: Already navigating another destination
        if (res.status === 409 || json.conflict) {
          setConflictModal({
            isOpen: true,
            activeServiceId: json.activeServiceId,
            activeServiceNumber: json.activeServiceNumber || 'Previous Service',
            pendingServiceId: targetServiceId,
          });
          return { conflict: true };
        }

        if (!res.ok) {
          const errorMsg = json.error?.message || 'Failed to start navigation';
          setState((prev) => ({ ...prev, error: errorMsg }));
          return { success: false, error: errorMsg };
        }

        // Navigation initiated successfully
        const dest = json.destination;
        setState((prev) => ({
          ...prev,
          isNavigating: true,
          activeServiceId: targetServiceId,
          trackingStatus: json.trackingStatus || 'ON_THE_WAY',
          destination: dest,
          distanceText: null,
          etaText: null,
          lastUpdate: Date.now(),
          error: null,
        }));

        // Continue/ensure existing browser watch is active (does not duplicate)
        startBrowserWatch(targetServiceId);

        // If we acquired an initial position, send an updated ping with the active destination confirmed
        if (initialPos) {
          sendLocationPing(initialPos).catch(() => {});
        }

        // If running on native Android app, start native Foreground Location Service
        if (nativeTrackingBridge.isAvailable() && json.navSessionToken) {
          try {
            const apiBase = getApiBaseUrl() || (typeof window !== 'undefined' ? window.location.origin : '');
            const targetApiUrl = `${apiBase.replace(/\/+$/, '')}/api/v1`;
            await nativeTrackingBridge.startTracking({
              apiUrl: targetApiUrl,
              token: json.navSessionToken,
              serviceId: targetServiceId,
              technicianName: dest?.customerName ? `Destination: ${dest.customerName}` : undefined,
            });
          } catch (natErr: any) {
            console.warn('[TechnicianTracking] Native service start notice:', natErr?.message);
          }
        }

        // Open Google Maps external navigation URL
        if (json.googleMapsUrl) {
          window.open(json.googleMapsUrl, '_blank', 'noopener,noreferrer');
        }

        return { success: true, googleMapsUrl: json.googleMapsUrl };
      } catch (err: any) {
        const msg = err?.message || 'Network error while initiating navigation';
        setState((prev) => ({ ...prev, error: msg }));
        return { success: false, error: msg };
      }
    },
    [startBrowserWatch, sendLocationPing]
  );

  // Stop tracking action
  const handleStopTracking = useCallback(async () => {
    if (nativeTrackingBridge.isAvailable()) {
      try {
        await nativeTrackingBridge.stopTracking();
      } catch (natErr: any) {
        console.warn('[TechnicianTracking] Native service stop notice:', natErr?.message);
      }
    }

    if (sharedWatchId !== null && typeof navigator !== 'undefined') {
      navigator.geolocation.clearWatch(sharedWatchId);
      sharedWatchId = null;
    }

    try {
      await fetch(resolveApiUrl('/maps/technician/stop'), {
        method: 'POST',
        credentials: 'include',
      });
    } catch {}

    if (sharedSocket && sharedSocket.connected) {
      sharedSocket.emit('technician:stop_tracking', {});
    }

    setState((prev) => ({
      ...prev,
      isNavigating: false,
      activeServiceId: null,
      trackingStatus: 'NOT_TRACKING',
      destination: null,
      distanceText: null,
      etaText: null,
      lastUpdate: null,
      error: null,
      isWatching: false,
    }));
  }, []);

  return {
    state,
    ...state,
    isThisServiceActive: Boolean(
      currentServiceId && state.isNavigating && state.activeServiceId === currentServiceId
    ),
    conflictModal,
    dismissConflictModal: () => setConflictModal(null),
    closeConflictModal: () => setConflictModal(null),
    confirmSwitchDestination: () => {
      if (conflictModal) {
        const nextId = conflictModal.pendingServiceId;
        setConflictModal(null);
        handleNavigate(nextId, true);
      }
    },
    navigate: (serviceId: string, confirmSwitch = false) => handleNavigate(serviceId, confirmSwitch),
    stopTracking: handleStopTracking,
    requestPermission,
    startBrowserWatch,
  };
}

/**
 * Technician Tracking Provider: Mounted at Technician Portal root
 * Ensures exactly ONE controlled active watcher for the technician portal lifecycle
 */
export const TechnicianTrackingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useTrackingInternal(undefined, true);
  return React.createElement(TechnicianTrackingContext.Provider, { value }, children);
};

export function useTechnicianTrackingContext(): TechnicianTrackingContextValue {
  const context = useContext(TechnicianTrackingContext);
  if (!context) {
    throw new Error('useTechnicianTrackingContext must be used within a TechnicianTrackingProvider');
  }
  return context;
}

/**
 * useTechnicianTracking: Hook for technician portal components
 * Reuses the TechnicianTrackingContext when present, or creates standalone instance if rendered independently.
 */
export function useTechnicianTracking(currentServiceId?: string) {
  const context = useContext(TechnicianTrackingContext);

  if (context) {
    return {
      ...context,
      ...context.state,
      isThisServiceActive: Boolean(
        currentServiceId && context.state.isNavigating && context.state.activeServiceId === currentServiceId
      ),
      navigate: (serviceId: string, confirmSwitch = false) => context.navigate(serviceId, confirmSwitch),
      stopTracking: context.stopTracking,
      requestPermission: context.requestPermission,
      startBrowserWatch: context.startBrowserWatch,
      dismissConflictModal: context.dismissConflictModal,
      closeConflictModal: context.closeConflictModal || context.dismissConflictModal,
      confirmSwitchDestination: context.confirmSwitchDestination,
    };
  }

  // Fallback for tests or components rendered outside provider
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useTrackingInternal(currentServiceId);
}

