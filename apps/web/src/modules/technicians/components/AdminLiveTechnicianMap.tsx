/// <reference types="@types/google.maps" />
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { io, Socket } from 'socket.io-client';
import {
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  Clock,
  Compass,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Users,
  Activity,
  Filter,
  Eye,
  Radio,
  X,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { getApiBaseUrl } from '../../../lib/api-client';
import { cn } from '../../../lib/utils';

export interface ActiveTechnicianLocation {
  technicianId: string;
  technicianName: string;
  technicianPhone?: string;
  serviceId: string;
  jobCardId?: string;
  trackingStatus: string;
  latitude: number | null;
  longitude: number | null;
  accuracy?: number;
  heading?: number;
  speed?: number;
  customerName?: string;
  customerAddress?: string;
  customerLatitude?: number;
  customerLongitude?: number;
  scheduledTime?: string;
  distanceKm?: number;
  etaMinutes?: number;
  distanceMeters?: number | null;
  distanceText?: string | null;
  etaSeconds?: number | null;
  etaText?: string | null;
  routeStatus?: 'IDLE' | 'LOADING' | 'SUCCESS' | 'UNAVAILABLE' | 'ERROR';
  routeErrorCode?: string | null;
  routeErrorMessage?: string | null;
  routeCalculatedAt?: number | null;
  routePolyline?: string | null;
  travelledPath?: Array<{ latitude: number; longitude: number; timestamp: number }>;
  lastUpdated: string;
  statusFreshness: 'LIVE' | 'WARNING' | 'STALE' | 'OFFLINE';
  secondsAgo: number;
}

export interface AdminMapsConfig {
  apiKey: string;
  mapId: string | null;
  stalenessThresholds: {
    liveSeconds: number;
    warningSeconds: number;
    staleSeconds: number;
    offlineSeconds: number;
  };
}

export interface AdminLiveTechnicianMapProps {
  onViewJobCard?: (jobCardId: string) => void;
  className?: string;
}

export function isValidCoordinate(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    isFinite(lat) &&
    isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export function normalizeTechnicianLocation(record: any): ActiveTechnicianLocation | null {
  if (!record || typeof record !== 'object') return null;

  const rawLat = typeof record.latitude === 'number'
    ? record.latitude
    : (typeof record.currentLocation?.latitude === 'number' ? record.currentLocation.latitude : null);

  const rawLng = typeof record.longitude === 'number'
    ? record.longitude
    : (typeof record.currentLocation?.longitude === 'number' ? record.currentLocation.longitude : null);

  const validCoords = isValidCoordinate(rawLat, rawLng);
  const lat = validCoords ? rawLat : null;
  const lng = validCoords ? rawLng : null;

  const dest = record.activeDestination;
  const isUntracked = !dest && (record.trackingStatus === 'UNTRACKED' || record.trackingStatus === 'NOT_TRACKING' || !record.trackingStatus);

  if (!record.technicianId && !record.id) {
    return null;
  }

  const actualTimestampMs = typeof record.currentLocation?.timestamp === 'number'
    ? record.currentLocation.timestamp
    : (typeof record.lastUpdate === 'number'
        ? record.lastUpdate
        : (record.lastUpdated ? new Date(record.lastUpdated).getTime() : Date.now()));

  const secondsAgo = typeof record.secondsAgo === 'number'
    ? record.secondsAgo
    : Math.max(0, Math.floor((Date.now() - actualTimestampMs) / 1000));

  const freshness = (record.statusFreshness || record.freshness || (isUntracked ? 'OFFLINE' : 'LIVE')) as 'LIVE' | 'WARNING' | 'STALE' | 'OFFLINE';

  const rawCustLat = record.customerLatitude ?? dest?.latitude;
  const rawCustLng = record.customerLongitude ?? dest?.longitude;
  const validCustCoords = isValidCoordinate(rawCustLat, rawCustLng);
  const custLat = validCustCoords ? rawCustLat : undefined;
  const custLng = validCustCoords ? rawCustLng : undefined;

  const distKm = isUntracked ? undefined : (typeof record.distanceKm === 'number'
    ? record.distanceKm
    : (typeof record.distanceMeters === 'number'
        ? Math.round((record.distanceMeters / 1000) * 10) / 10
        : undefined));

  const etaMins = isUntracked ? undefined : (typeof record.etaMinutes === 'number'
    ? record.etaMinutes
    : (typeof record.etaSeconds === 'number'
        ? Math.ceil(record.etaSeconds / 60)
        : undefined));

  let routeStatus = (isUntracked
    ? 'UNAVAILABLE'
    : (record.routeStatus || (distKm !== undefined && etaMins !== undefined ? 'SUCCESS' : (!custLat || !custLng ? 'UNAVAILABLE' : 'UNAVAILABLE')))) as 'IDLE' | 'LOADING' | 'SUCCESS' | 'UNAVAILABLE' | 'ERROR';

  let trackingStatus = record.trackingStatus;
  if (!trackingStatus || isUntracked) {
    trackingStatus = 'UNTRACKED';
  }

  return {
    technicianId: String(record.technicianId || record.id || ''),
    technicianName: String(record.technicianName || record.fullName || 'Technician'),
    technicianPhone: record.technicianPhone || record.phone,
    serviceId: record.serviceId || dest?.serviceId || '',
    jobCardId: record.jobCardId || dest?.jobCardId || undefined,
    trackingStatus,
    latitude: lat,
    longitude: lng,
    accuracy: record.accuracy ?? record.currentLocation?.accuracy,
    heading: record.heading ?? record.currentLocation?.heading,
    speed: record.speed ?? record.currentLocation?.speed,
    customerName: record.customerName || dest?.customerName,
    customerAddress: record.customerAddress || dest?.address,
    customerLatitude: isUntracked ? undefined : custLat,
    customerLongitude: isUntracked ? undefined : custLng,
    scheduledTime: record.scheduledTime || dest?.scheduledTimeSlot,
    distanceKm: distKm,
    etaMinutes: etaMins,
    distanceMeters: isUntracked ? null : (record.distanceMeters ?? null),
    distanceText: isUntracked ? null : (record.distanceText ?? null),
    etaSeconds: isUntracked ? null : (record.etaSeconds ?? null),
    etaText: isUntracked ? null : (record.etaText ?? null),
    routeStatus,
    routeErrorCode: record.routeErrorCode ?? null,
    routeErrorMessage: record.routeErrorMessage ?? null,
    routeCalculatedAt: record.routeCalculatedAt ?? null,
    routePolyline: isUntracked ? null : (record.routePolyline ?? null),
    travelledPath: isUntracked ? [] : (record.travelledPath ?? []),
    lastUpdated: record.lastUpdated || new Date(actualTimestampMs).toISOString(),
    statusFreshness: freshness,
    secondsAgo,
  };
}

export const AdminLiveTechnicianMap: React.FC<AdminLiveTechnicianMapProps> = ({
  onViewJobCard,
  className,
}) => {
  const navigate = useNavigate();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const socketRef = useRef<Socket | null>(null);
  const plannedPolylineRef = useRef<google.maps.Polyline | null>(null);
  const travelledPathPolylineRef = useRef<google.maps.Polyline | null>(null);
  const destMarkerRef = useRef<any>(null);

  const [config, setConfig] = useState<AdminMapsConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  const [technicians, setTechnicians] = useState<ActiveTechnicianLocation[]>([]);
  const [selectedTechId, setSelectedTechId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState<string | null>(null);

  // Safe developer diagnostics helper (Section 12)
  const logDiagnostic = useCallback((boundary: string, data?: Record<string, any>) => {
    if (
      process.env.NODE_ENV !== 'production' ||
      (typeof window !== 'undefined' && (window as any).__CRM_DEBUG_MAP__)
    ) {
      console.info(`[AdminLiveMap:Diagnostic] [${boundary}]`, data || {});
    }
  }, []);

  const handleRetryRoute = useCallback(async (techId: string) => {
    try {
      setIsRecalculating(techId);
      logDiagnostic('8:ROUTE_REQUEST_START', { techId });
      const res = await apiClient.post<any>('/maps/admin/recalculate-route', { technicianId: techId });
      logDiagnostic('8:ROUTE_REQUEST_FINISH', { techId, routeStatus: res?.data?.routeStatus });
      if (res && res.data) {
        setTechnicians((prev) =>
          prev.map((t) =>
            t.technicianId === techId
              ? {
                  ...t,
                  routeStatus: res.data.routeStatus,
                  routeErrorCode: res.data.routeErrorCode,
                  routeErrorMessage: res.data.routeErrorMessage,
                  distanceKm: res.data.distanceKm,
                  etaMinutes: res.data.etaMinutes,
                  distanceMeters: res.data.distanceMeters,
                  distanceText: res.data.distanceText,
                  etaSeconds: res.data.etaSeconds,
                  etaText: res.data.etaText,
                  routeCalculatedAt: res.data.routeCalculatedAt,
                }
              : t
          )
        );
      }
    } catch (err: any) {
      logDiagnostic('8:ROUTE_REQUEST_FAILED', { techId, error: err?.message });
      console.warn('[AdminLiveTechnicianMap] Recalculate route notice:', err?.message);
    } finally {
      setIsRecalculating(null);
    }
  }, [logDiagnostic]);

  // 1. Fetch Maps Config from backend
  useEffect(() => {
    let isMounted = true;
    async function fetchConfig() {
      try {
        setConfigLoading(true);
        setConfigError(null);
        const res = await apiClient.get<AdminMapsConfig>('/maps/admin/config');
        if (isMounted) {
          if (res && res.data) {
            setConfig(res.data);
          } else {
            setConfigError('Invalid configuration response from server.');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setConfigError(
            err?.message || 'Failed to load Google Maps configuration. Please check server settings.'
          );
        }
      } finally {
        if (isMounted) setConfigLoading(false);
      }
    }
    fetchConfig();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Fetch Active Technicians
  const fetchLiveTechnicians = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const res = await apiClient.get<ActiveTechnicianLocation[]>('/maps/admin/live-technicians');
      if (res && res.data) {
        const rawList = Array.isArray(res.data) ? res.data : [];
        const normalized = rawList.map(normalizeTechnicianLocation).filter(Boolean) as ActiveTechnicianLocation[];
        setTechnicians(normalized);

        const navigating = normalized.filter((t) => t.trackingStatus !== 'UNTRACKED');
        logDiagnostic('4:TRACKING_QUERY_COMPLETE', {
          totalCount: normalized.length,
          navigatingCount: navigating.length,
          untrackedCount: normalized.length - navigating.length,
        });
        logDiagnostic('5:ACTIVE_NAV_SESSIONS_IDENTIFIED', {
          sessions: navigating.map((n) => ({
            id: n.technicianId,
            name: n.technicianName,
            status: n.trackingStatus,
            hasCoords: isValidCoordinate(n.latitude, n.longitude),
          })),
        });
      }
    } catch (err) {
      console.error('[AdminLiveMap] Failed to fetch live technicians', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [logDiagnostic]);

  useEffect(() => {
    fetchLiveTechnicians();
    // Fallback polling interval every 15s to guarantee fresh view
    const pollTimer = setInterval(fetchLiveTechnicians, 15000);
    return () => clearInterval(pollTimer);
  }, [fetchLiveTechnicians]);

  // 3. Socket.IO connection for real-time live map updates
  useEffect(() => {
    const rawBaseUrl = getApiBaseUrl();
    const socketUrl = rawBaseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('crm_session_token') : null;

    try {
      const socket = io(`${socketUrl}/maps`, {
        transports: ['websocket', 'polling'],
        auth: { token },
        query: { subscribe: 'admin-map', role: 'admin' },
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        setIsSocketConnected(true);
        logDiagnostic('9:REALTIME_CONNECTED', { socketUrl });
        // Recover latest state immediately on reconnection
        fetchLiveTechnicians();
      });

      socket.on('connect_error', (err: any) => {
        logDiagnostic('9:REALTIME_CONNECT_ERROR', { error: err?.message });
      });

      socket.on('disconnect', (reason: string) => {
        setIsSocketConnected(false);
        logDiagnostic('9:REALTIME_DISCONNECTED', { reason });
      });

      const handleSnapshot = (data: any[]) => {
        if (Array.isArray(data)) {
          const normalized = data.map(normalizeTechnicianLocation).filter(Boolean) as ActiveTechnicianLocation[];
          setTechnicians(normalized);
        }
      };

      const handleUpdate = (updatedRaw: any) => {
        const updatedTech = normalizeTechnicianLocation(updatedRaw);
        if (!updatedTech) return;
        setTechnicians((prev) => {
          const index = prev.findIndex((t) => t.technicianId === updatedTech.technicianId);
          if (index >= 0) {
            const next = [...prev];
            next[index] = updatedTech;
            return next;
          }
          return [...prev, updatedTech];
        });
      };

      const handleStopped = ({ technicianId }: { technicianId: string }) => {
        if (!technicianId) return;
        setTechnicians((prev) =>
          prev.map((t) =>
            t.technicianId === technicianId
              ? {
                  ...t,
                  trackingStatus: 'UNTRACKED',
                  statusFreshness: 'OFFLINE',
                  customerLatitude: undefined,
                  customerLongitude: undefined,
                  distanceKm: undefined,
                  etaMinutes: undefined,
                  distanceMeters: null,
                  distanceText: null,
                  etaSeconds: null,
                  etaText: null,
                  routeStatus: 'UNAVAILABLE',
                  routePolyline: null,
                  travelledPath: [],
                }
              : t
          )
        );
        // Remove marker
        const existingMarker = markersRef.current.get(technicianId);
        if (existingMarker) {
          if (typeof existingMarker.setMap === 'function') {
            existingMarker.setMap(null);
          } else if ('map' in existingMarker) {
            existingMarker.map = null;
          }
          markersRef.current.delete(technicianId);
        }
      };

      socket.on('admin:live_technicians_snapshot', handleSnapshot);
      socket.on('technicians:initial', handleSnapshot);

      socket.on('admin:technician_location_update', handleUpdate);
      socket.on('technician:location:update', handleUpdate);

      socket.on('admin:technician_tracking_stopped', handleStopped);
      socket.on('technician:tracking:stopped', handleStopped);

      return () => {
        socket.disconnect();
        socketRef.current = null;
      };
    } catch (e: any) {
      console.error('[AdminLiveMap] Socket connection error', e);
      logDiagnostic('9:REALTIME_ERROR', { error: e?.message });
    }
  }, [fetchLiveTechnicians, logDiagnostic]);

  // 4. Initialize Google Maps JavaScript API with multi-library support & fallback
  useEffect(() => {
    if (!config?.apiKey || !mapContainerRef.current) return;

    let isCancelled = false;

    async function initMap() {
      const startTime = Date.now();
      logDiagnostic('1:MAP_INIT_BEGIN', {
        hasApiKey: !!config?.apiKey,
        hasMapId: !!config?.mapId,
        containerExists: !!mapContainerRef.current,
      });

      try {
        setOptions({
          key: config!.apiKey,
          v: 'weekly',
          mapIds: config!.mapId ? [config!.mapId] : undefined,
        });

        // Concurrently load maps, marker, and geometry libraries
        const [{ Map }] = await Promise.all([
          importLibrary('maps') as Promise<google.maps.MapsLibrary>,
          importLibrary('marker').catch((mErr) => {
            console.warn('[AdminLiveMap] Marker library import notice:', mErr?.message);
            return null;
          }),
          importLibrary('geometry').catch((gErr) => {
            console.warn('[AdminLiveMap] Geometry library import notice:', gErr?.message);
            return null;
          }),
        ]);

        logDiagnostic('2:PROVIDER_RESOURCES_LOADED', {
          elapsedMs: Date.now() - startTime,
          hasMapClass: !!Map,
          hasMarkerApi: !!(window as any).google?.maps?.marker,
          hasGeometryApi: !!(window as any).google?.maps?.geometry,
        });

        if (isCancelled || !mapContainerRef.current) return;

        // Default center: Pune/Maharashtra regional operational center
        const defaultCenter = { lat: 18.5204, lng: 73.8567 };

        const mapOptions: google.maps.MapOptions = {
          center: defaultCenter,
          zoom: 12,
          mapId: config!.mapId || undefined,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        };

        // Resilient map instantiation: fall back to standard raster map if vector/mapId throws
        let map: google.maps.Map;
        try {
          map = new Map(mapContainerRef.current, mapOptions);
        } catch (vectorErr: any) {
          console.warn('[AdminLiveMap] Map init with mapId failed, falling back to raster map:', vectorErr?.message);
          map = new Map(mapContainerRef.current, { ...mapOptions, mapId: undefined });
        }

        mapInstanceRef.current = map;

        logDiagnostic('3:MAP_INIT_SUCCESS', {
          elapsedMs: Date.now() - startTime,
          center: defaultCenter,
          zoom: 12,
        });
      } catch (err: any) {
        logDiagnostic('3:MAP_INIT_FAILED', {
          elapsedMs: Date.now() - startTime,
          error: err?.message,
        });
        console.error('[AdminLiveMap] Failed to load Google Maps script', err);
        setConfigError(
          'Google Maps JavaScript API could not be loaded. Please verify API key configuration and network connectivity.'
        );
      }
    }

    initMap();

    return () => {
      isCancelled = true;
    };
  }, [config, logDiagnostic]);

  // ResizeObserver to ensure map surface redraws cleanly on container size or layout changes (Section 4 & 5)
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const triggerResize = () => {
      if (mapInstanceRef.current && (window as any).google?.maps?.event) {
        (window as any).google.maps.event.trigger(mapInstanceRef.current, 'resize');
      }
    };

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(triggerResize);
      observer.observe(mapContainerRef.current);
      return () => {
        observer.disconnect();
      };
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', triggerResize);
      return () => {
        window.removeEventListener('resize', triggerResize);
      };
    }
  }, []);

  // 5. Synchronize Markers with active technicians
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !(window as any).google?.maps) return;

    const currentTechIds = new Set(technicians.map((t) => t.technicianId));

    // Remove obsolete markers
    markersRef.current.forEach((marker, techId) => {
      if (!currentTechIds.has(techId)) {
        if (typeof marker.setMap === 'function') {
          marker.setMap(null);
        } else if ('map' in marker) {
          marker.map = null;
        }
        markersRef.current.delete(techId);
      }
    });

    const google = (window as any).google;
    const hasAdvancedMarker = Boolean(
      google.maps?.marker?.AdvancedMarkerElement &&
      config?.mapId
    );

    const activeTrackedPoints: Array<{ lat: number; lng: number }> = [];

    technicians.forEach((tech) => {
      const valid = isValidCoordinate(tech.latitude, tech.longitude);
      logDiagnostic('6:COORDINATES_VALIDATED', {
        technicianId: tech.technicianId,
        valid,
        lat: valid ? tech.latitude : null,
        lng: valid ? tech.longitude : null,
        status: tech.trackingStatus,
      });

      if (!valid) {
        const existing = markersRef.current.get(tech.technicianId);
        if (existing) {
          if (typeof existing.setMap === 'function') {
            existing.setMap(null);
          } else if ('map' in existing) {
            existing.map = null;
          }
          markersRef.current.delete(tech.technicianId);
        }
        return;
      }

      const position = { lat: tech.latitude as number, lng: tech.longitude as number };
      if (tech.trackingStatus !== 'UNTRACKED') {
        activeTrackedPoints.push(position);
      }

      let marker = markersRef.current.get(tech.technicianId);

      // Status color mapping
      const statusColor =
        tech.trackingStatus === 'UNTRACKED'
          ? '#94a3b8' // Slate / Untracked
          : tech.statusFreshness === 'LIVE'
          ? '#10b981' // Green
          : tech.statusFreshness === 'WARNING'
          ? '#f59e0b' // Amber
          : tech.statusFreshness === 'STALE'
          ? '#e11d48' // Rose / Red for stale location
          : '#94a3b8'; // Muted

      let markerCreatedOrUpdated = false;

      if (hasAdvancedMarker) {
        try {
          if (!marker || !(marker instanceof google.maps.marker.AdvancedMarkerElement)) {
            // Clean up previous marker if type mismatched
            if (marker) {
              if (typeof marker.setMap === 'function') marker.setMap(null);
              else if ('map' in marker) marker.map = null;
            }

            const pinDiv = document.createElement('div');
            pinDiv.className = 'custom-tech-pin group cursor-pointer transform -translate-x-1/2 -translate-y-full transition-transform hover:scale-110';
            pinDiv.innerHTML = `
              <div style="background-color: ${statusColor};" class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-white text-xs font-bold shadow-md border-2 border-white">
                <span class="w-2 h-2 rounded-full bg-white ${tech.statusFreshness === 'LIVE' && tech.trackingStatus !== 'UNTRACKED' ? 'animate-pulse' : ''}"></span>
                <span>${escapeHtml(tech.technicianName)}</span>
              </div>
              <div class="w-2 h-2 bg-slate-800 rotate-45 mx-auto -mt-1 shadow-xs"></div>
            `;

            pinDiv.addEventListener('click', () => {
              setSelectedTechId(tech.technicianId);
            });

            marker = new google.maps.marker.AdvancedMarkerElement({
              map,
              position,
              title: `${tech.technicianName} (${tech.trackingStatus})`,
              content: pinDiv,
            });

            markersRef.current.set(tech.technicianId, marker);
            markerCreatedOrUpdated = true;
          } else {
            marker.position = position;
            if (marker.content) {
              const innerBadge = marker.content.querySelector('div');
              if (innerBadge) {
                innerBadge.style.backgroundColor = statusColor;
              }
            }
            markerCreatedOrUpdated = true;
          }
        } catch (advErr: any) {
          console.warn('[AdminLiveMap] AdvancedMarkerElement failed, falling back to standard Marker:', advErr?.message);
        }
      }

      if (!markerCreatedOrUpdated) {
        // Fallback to standard google.maps.Marker
        if (!marker || (google.maps.marker?.AdvancedMarkerElement && marker instanceof google.maps.marker.AdvancedMarkerElement)) {
          if (marker && 'map' in marker) marker.map = null;

          marker = new google.maps.Marker({
            map,
            position,
            title: `${tech.technicianName} (${tech.trackingStatus})`,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: statusColor,
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            },
          });

          marker.addListener('click', () => {
            setSelectedTechId(tech.technicianId);
          });

          markersRef.current.set(tech.technicianId, marker);
        } else {
          marker.setPosition(position);
        }
      }

      logDiagnostic('7:MARKER_SYNC_SUCCESS', {
        technicianId: tech.technicianId,
        isAdvanced: hasAdvancedMarker && markerCreatedOrUpdated,
      });
    });

    // Auto-fit bounds if multiple navigating technicians, or pan to single navigating technician
    if (activeTrackedPoints.length > 1 && google?.maps?.LatLngBounds) {
      const bounds = new google.maps.LatLngBounds();
      activeTrackedPoints.forEach((pt) => bounds.extend(pt));
      map.fitBounds(bounds, 80);
    } else if (activeTrackedPoints.length === 1 && !selectedTechId) {
      map.panTo(activeTrackedPoints[0]);
    }
  }, [technicians, config, selectedTechId, logDiagnostic]);

  // 6. Draw Planned Road Route and Observed Travelled Path when a technician is selected
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !(window as any).google?.maps) return;
    const google = (window as any).google;

    // Clean up previous polylines and destination marker
    if (plannedPolylineRef.current) {
      plannedPolylineRef.current.setMap(null);
      plannedPolylineRef.current = null;
    }
    if (travelledPathPolylineRef.current) {
      travelledPathPolylineRef.current.setMap(null);
      travelledPathPolylineRef.current = null;
    }
    if (destMarkerRef.current) {
      if (typeof destMarkerRef.current.setMap === 'function') {
        destMarkerRef.current.setMap(null);
      } else if ('map' in destMarkerRef.current) {
        destMarkerRef.current.map = null;
      }
      destMarkerRef.current = null;
    }

    const selected =
      technicians.find((t) => t.technicianId === selectedTechId) ||
      technicians.find((t) => t.trackingStatus !== 'UNTRACKED' && isValidCoordinate(t.customerLatitude, t.customerLongitude)) ||
      null;
    if (!selected || selected.trackingStatus === 'UNTRACKED') {
      return;
    }

    // A. Draw Planned Road Route (Solid Primary Blue) - Only from real routing provider polyline
    let hasDecodedRoute = false;
    if (selected.routePolyline && google.maps.geometry?.encoding?.decodePath) {
      try {
        const decodedPath = google.maps.geometry.encoding.decodePath(selected.routePolyline);
        if (decodedPath && decodedPath.length > 0) {
          plannedPolylineRef.current = new google.maps.Polyline({
            map,
            path: decodedPath,
            strokeColor: '#2563eb', // Blue solid road route
            strokeWeight: 5,
            strokeOpacity: 0.85,
            zIndex: 10,
          });
          hasDecodedRoute = true;
        }
      } catch (err: any) {
        console.warn('[AdminLiveMap] Failed to decode route polyline:', err?.message);
      }
    }

    // Client-side DirectionsService fallback if backend polyline is absent but both coordinates exist
    if (
      !hasDecodedRoute &&
      isValidCoordinate(selected.latitude, selected.longitude) &&
      isValidCoordinate(selected.customerLatitude, selected.customerLongitude) &&
      google.maps.DirectionsService
    ) {
      try {
        const directionsService = new google.maps.DirectionsService();
        directionsService.route(
          {
            origin: { lat: selected.latitude as number, lng: selected.longitude as number },
            destination: { lat: selected.customerLatitude as number, lng: selected.customerLongitude as number },
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (result: any, status: any) => {
            if (status === 'OK' && result?.routes?.[0]?.overview_path) {
              if (plannedPolylineRef.current) {
                plannedPolylineRef.current.setMap(null);
              }
              plannedPolylineRef.current = new google.maps.Polyline({
                map,
                path: result.routes[0].overview_path,
                strokeColor: '#2563eb',
                strokeWeight: 5,
                strokeOpacity: 0.85,
                zIndex: 10,
              });
            }
          }
        );
      } catch (dirErr: any) {
        console.warn('[AdminLiveMap] DirectionsService client notice:', dirErr);
      }
    }

    // B. Draw Actual Observed Travelled Path (Amber/Orange distinct polyline)
    if (selected.travelledPath && selected.travelledPath.length >= 2) {
      const pathCoords = selected.travelledPath
        .filter((p) => isValidCoordinate(p.latitude, p.longitude))
        .map((p) => ({
          lat: p.latitude,
          lng: p.longitude,
        }));

      if (pathCoords.length >= 2) {
        travelledPathPolylineRef.current = new google.maps.Polyline({
          map,
          path: pathCoords,
          strokeColor: '#f59e0b', // Amber/orange path
          strokeWeight: 4,
          strokeOpacity: 0.95,
          zIndex: 12,
        });
      }
    }

    // C. Draw Customer Destination Pin
    if (
      isValidCoordinate(selected.customerLatitude, selected.customerLongitude)
    ) {
      const destPos = {
        lat: selected.customerLatitude as number,
        lng: selected.customerLongitude as number,
      };

      if (google.maps.marker?.AdvancedMarkerElement && config?.mapId) {
        const destPin = document.createElement('div');
        destPin.className = 'custom-dest-pin cursor-pointer transform -translate-x-1/2 -translate-y-full';
        destPin.innerHTML = `
          <div class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold shadow-md border border-white">
            <span>🏁 ${escapeHtml(selected.customerName || 'Destination')}</span>
          </div>
          <div class="w-1.5 h-1.5 bg-rose-700 rotate-45 mx-auto -mt-0.5"></div>
        `;
        destMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
          map,
          position: destPos,
          title: `Destination: ${selected.customerName || 'Customer'}`,
          content: destPin,
        });
      } else {
        destMarkerRef.current = new google.maps.Marker({
          map,
          position: destPos,
          title: `Destination: ${selected.customerName || 'Customer'}`,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: '#e11d48',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        });
      }
    }

    // Fit map bounds to encompass both technician location and destination point
    if (google?.maps?.LatLngBounds) {
      const bounds = new google.maps.LatLngBounds();
      let hasTechCoords = false;
      let hasDestCoords = false;
      if (isValidCoordinate(selected.latitude, selected.longitude)) {
        bounds.extend({ lat: selected.latitude as number, lng: selected.longitude as number });
        hasTechCoords = true;
      }
      if (isValidCoordinate(selected.customerLatitude, selected.customerLongitude)) {
        bounds.extend({ lat: selected.customerLatitude as number, lng: selected.customerLongitude as number });
        hasDestCoords = true;
      }
      if (hasTechCoords && hasDestCoords) {
        map.fitBounds(bounds, 80);
      } else if (hasDestCoords) {
        map.panTo({ lat: selected.customerLatitude as number, lng: selected.customerLongitude as number });
        const currentZoom = map.getZoom() ?? 0;
        if (currentZoom < 13 || currentZoom > 16) {
          map.setZoom(14);
        }
      }
    }
  }, [selectedTechId, technicians, config]);

  // Center map on selected technician and destination
  const handleSelectTech = (tech: ActiveTechnicianLocation) => {
    setSelectedTechId(tech.technicianId);
    if (!mapInstanceRef.current) return;

    const google = (window as any).google;
    if (google?.maps?.LatLngBounds) {
      const bounds = new google.maps.LatLngBounds();
      let hasBoundsPoints = false;
      if (isValidCoordinate(tech.latitude, tech.longitude)) {
        bounds.extend({ lat: tech.latitude as number, lng: tech.longitude as number });
        hasBoundsPoints = true;
      }
      if (isValidCoordinate(tech.customerLatitude, tech.customerLongitude)) {
        bounds.extend({ lat: tech.customerLatitude as number, lng: tech.customerLongitude as number });
        hasBoundsPoints = true;
      }

      if (hasBoundsPoints && isValidCoordinate(tech.customerLatitude, tech.customerLongitude)) {
        mapInstanceRef.current.fitBounds(bounds, 80);
      } else if (hasBoundsPoints) {
        mapInstanceRef.current.panTo({ lat: tech.latitude as number, lng: tech.longitude as number });
        mapInstanceRef.current.setZoom(15);
      }
    } else if (isValidCoordinate(tech.latitude, tech.longitude) && typeof mapInstanceRef.current.panTo === 'function') {
      mapInstanceRef.current.panTo({ lat: tech.latitude as number, lng: tech.longitude as number });
    }
  };

  const selectedTech = technicians.find((t) => t.technicianId === selectedTechId) || null;

  // Filtered technicians list
  const filteredTechnicians = technicians.filter((tech) => {
    const matchesSearch =
      searchTerm === '' ||
      tech.technicianName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tech.customerName && tech.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (tech.serviceId && tech.serviceId.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus =
      statusFilter === 'ALL'
        ? true
        : statusFilter === 'UNTRACKED'
        ? tech.trackingStatus === 'UNTRACKED'
        : tech.trackingStatus !== 'UNTRACKED' &&
          (tech.trackingStatus === statusFilter || tech.statusFreshness === statusFilter);

    return matchesSearch && matchesStatus;
  });

  const liveCount = technicians.filter((t) => t.statusFreshness === 'LIVE' && t.trackingStatus !== 'UNTRACKED').length;
  const warningCount = technicians.filter((t) => t.statusFreshness === 'WARNING' && t.trackingStatus !== 'UNTRACKED').length;
  const staleCount = technicians.filter((t) => (t.statusFreshness === 'STALE' || t.statusFreshness === 'OFFLINE') && t.trackingStatus !== 'UNTRACKED').length;
  const untrackedCount = technicians.filter((t) => t.trackingStatus === 'UNTRACKED').length;
  const activeNavigatingCount = technicians.filter(
    (t) => t.trackingStatus !== 'UNTRACKED' && isValidCoordinate(t.latitude, t.longitude)
  ).length;

  return (
    <div className={cn('flex flex-col h-[750px] bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs relative', className)}>
      {/* Top Map Operational Control Bar */}
      <div className="bg-slate-900 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-600/30 text-primary-400 flex items-center justify-center border border-primary-500/30">
            <Navigation className="w-4 h-4 text-primary-300" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Admin Live Technician Map</span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border',
                  isSocketConnected
                    ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                    : 'bg-amber-950/80 text-amber-400 border-amber-800'
                )}
              >
                <Radio className={cn('w-2.5 h-2.5', isSocketConnected && 'animate-pulse text-emerald-400')} />
                {isSocketConnected ? 'Real-Time Connected' : 'Polling Sync'}
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              Live operational GPS telemetry and destination tracking for field workforce
            </p>
          </div>
        </div>

        {/* Status Metrics Counters */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/80">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-300">Active:</span>
            <span className="font-bold text-white">{technicians.length}</span>
          </div>

          {untrackedCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/80 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
              <span>Untracked:</span>
              <span className="font-bold">{untrackedCount}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/60 border border-emerald-800/60 text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Live:</span>
            <span className="font-bold">{liveCount}</span>
          </div>

          {warningCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-950/60 border border-amber-800/60 text-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>Aging:</span>
              <span className="font-bold">{warningCount}</span>
            </div>
          )}

          {staleCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/80 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-slate-500"></span>
              <span>Stale:</span>
              <span className="font-bold">{staleCount}</span>
            </div>
          )}

          <button
            type="button"
            onClick={fetchLiveTechnicians}
            disabled={isRefreshing}
            className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors ml-1"
            title="Refresh Live Telemetry"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
          </button>

          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors text-xs font-medium flex items-center gap-1"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{sidebarOpen ? 'Hide List' : 'Show List'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* Google Maps Container */}
        <div className="flex-1 h-full w-full relative">
          <div
            ref={mapContainerRef}
            className="w-full h-full min-h-[400px]"
            style={{ minHeight: '400px', width: '100%', height: '100%' }}
          />

          {/* Config Loading State */}
          {configLoading && (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-20">
              <div className="bg-white p-5 rounded-xl shadow-xl flex items-center gap-3">
                <RefreshCw className="w-5 h-5 animate-spin text-primary-600" />
                <span className="text-sm font-medium text-slate-700">
                  Initializing Google Maps Platform telemetry...
                </span>
              </div>
            </div>
          )}

          {/* Config Error Banner */}
          {configError && (
            <div className="absolute top-4 left-4 right-4 bg-rose-50 border border-rose-200 p-4 rounded-xl shadow-lg z-20 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <h4 className="font-bold text-rose-900 mb-0.5">Google Maps Initialization Error</h4>
                <p className="text-rose-700">{configError}</p>
              </div>
            </div>
          )}

          {/* Empty State Banner if no active navigating technicians (Section 6) */}
          {!configLoading && !configError && activeNavigatingCount === 0 && (
            <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur-xs border border-slate-200/90 p-3.5 rounded-xl shadow-md max-w-sm">
              <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs mb-1">
                <Activity className="w-4 h-4 text-slate-500" />
                <span>No Active Navigating Technicians</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {technicians.length === 0
                  ? 'There are currently no active tracking sessions. The live base map is operational and ready.'
                  : 'Assigned technicians are currently in untracked state. When a field engineer taps "Navigate" on an assigned service in the Technician Portal, their live device location and route telemetry will appear on this map.'}
              </p>
            </div>
          )}

          {/* Selected Technician Detail Card Floating Overlay */}
          {selectedTech && (
            <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:w-96 z-10 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="bg-slate-900 text-white px-3.5 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'w-2.5 h-2.5 rounded-full',
                      selectedTech.trackingStatus === 'UNTRACKED'
                        ? 'bg-slate-400'
                        : selectedTech.statusFreshness === 'LIVE'
                        ? 'bg-emerald-400 animate-pulse'
                        : selectedTech.statusFreshness === 'WARNING'
                        ? 'bg-amber-400'
                        : 'bg-rose-400'
                    )}
                  />
                  <span className="font-bold text-xs truncate max-w-[200px]">
                    {selectedTech.technicianName}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full',
                      selectedTech.trackingStatus === 'UNTRACKED'
                        ? 'bg-slate-700 text-slate-300 border border-slate-600'
                        : selectedTech.trackingStatus === 'NAVIGATION_STARTING'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : selectedTech.statusFreshness === 'LIVE'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : selectedTech.statusFreshness === 'WARNING'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    )}
                  >
                    {selectedTech.trackingStatus === 'UNTRACKED'
                      ? 'UNTRACKED'
                      : selectedTech.trackingStatus === 'NAVIGATION_STARTING'
                      ? 'NAV STARTING'
                      : selectedTech.statusFreshness === 'LIVE'
                      ? 'LIVE TRACKING'
                      : 'NAVIGATING / STALE LOCATION'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedTechId(null)}
                    className="text-slate-400 hover:text-white p-0.5 rounded"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="p-3.5 space-y-3 text-xs">
                {/* Status & Timing */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500">Operational State:</span>
                  <span
                    className={cn(
                      'font-semibold px-2 py-0.5 rounded text-[11px]',
                      selectedTech.trackingStatus === 'UNTRACKED'
                        ? 'bg-slate-100 text-slate-700 border border-slate-200'
                        : selectedTech.trackingStatus === 'ON_THE_WAY'
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : selectedTech.trackingStatus === 'AT_CUSTOMER'
                        ? 'bg-purple-100 text-purple-800 border border-purple-200'
                        : selectedTech.trackingStatus === 'ARRIVAL_PENDING'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    )}
                  >
                    {selectedTech.trackingStatus === 'UNTRACKED'
                      ? 'UNTRACKED'
                      : selectedTech.trackingStatus === 'ON_THE_WAY'
                      ? 'ON THE WAY'
                      : selectedTech.trackingStatus === 'AT_CUSTOMER'
                      ? 'AT CUSTOMER'
                      : selectedTech.trackingStatus.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500">Location Freshness:</span>
                  <span
                    className={cn(
                      'font-semibold px-2 py-0.5 rounded text-[11px]',
                      selectedTech.trackingStatus === 'UNTRACKED'
                        ? 'bg-slate-100 text-slate-500 border border-slate-200'
                        : selectedTech.statusFreshness === 'LIVE'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : selectedTech.statusFreshness === 'WARNING'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    )}
                  >
                    {selectedTech.trackingStatus === 'UNTRACKED'
                      ? 'OFFLINE'
                      : selectedTech.statusFreshness === 'LIVE'
                      ? 'LIVE'
                      : selectedTech.statusFreshness === 'WARNING'
                      ? 'WARNING'
                      : 'NAVIGATING / STALE LOCATION'}
                  </span>
                </div>

                {/* Customer Context */}
                {selectedTech.customerName && (
                  <div className="space-y-1">
                    <span className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">
                      Destination Customer
                    </span>
                    <p className="font-bold text-slate-900 text-xs">{selectedTech.customerName}</p>
                    {selectedTech.customerAddress && (
                      <p className="text-[11px] text-slate-500 flex items-start gap-1">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{selectedTech.customerAddress}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Distance & ETA from Routes API */}
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 space-y-1.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Road Distance</span>
                      <span className="text-xs font-bold text-slate-800">
                        {selectedTech.trackingStatus === 'UNTRACKED'
                          ? 'Not Navigating'
                          : isRecalculating === selectedTech.technicianId || selectedTech.routeStatus === 'LOADING'
                          ? 'Calculating...'
                          : selectedTech.distanceKm !== undefined
                            ? `${selectedTech.distanceKm} km`
                            : 'Unavailable'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Estimated ETA</span>
                      <span className="text-xs font-bold text-slate-800">
                        {selectedTech.trackingStatus === 'UNTRACKED'
                          ? 'Not Navigating'
                          : isRecalculating === selectedTech.technicianId || selectedTech.routeStatus === 'LOADING'
                          ? 'Calculating...'
                          : selectedTech.etaMinutes !== undefined
                            ? `~${selectedTech.etaMinutes} mins`
                            : 'Unavailable'}
                      </span>
                    </div>
                  </div>

                  {/* Route Status Context / Retry Action */}
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200/60">
                    <span className="truncate pr-1">
                      {selectedTech.trackingStatus === 'UNTRACKED' ? (
                        <span className="text-slate-400">Navigation not started (Untracked)</span>
                      ) : isRecalculating === selectedTech.technicianId ? (
                        <span className="text-primary-600 font-medium flex items-center gap-1">
                          <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                          <span>Recalculating route...</span>
                        </span>
                      ) : selectedTech.routeStatus === 'SUCCESS' ? (
                        selectedTech.statusFreshness === 'STALE' || selectedTech.secondsAgo > 90 ? (
                          <span className="text-amber-600 font-medium">Route based on last known location</span>
                        ) : (
                          <span className="text-emerald-600 font-medium">Live road route</span>
                        )
                      ) : selectedTech.routeStatus === 'UNAVAILABLE' ? (
                        !selectedTech.customerLatitude || !selectedTech.customerLongitude ? (
                          <span className="text-slate-400">Destination coordinates not set</span>
                        ) : (
                          <span className="text-slate-400">Route unavailable</span>
                        )
                      ) : selectedTech.routeStatus === 'ERROR' ? (
                        selectedTech.routeErrorCode === 'PROVIDER_RATE_LIMITED' ? (
                          <span className="text-amber-600">Rate limit reached (quota)</span>
                        ) : selectedTech.routeErrorCode === 'REQUEST_TIMEOUT' ? (
                          <span className="text-rose-600">Routing request timed out</span>
                        ) : (
                          <span className="text-rose-600">Route calculation failed</span>
                        )
                      ) : (
                        <span className="text-slate-400">Route idle</span>
                      )}
                    </span>

                    {/* Retry Action */}
                    {selectedTech.trackingStatus !== 'UNTRACKED' && (selectedTech.routeStatus === 'ERROR' ||
                      (selectedTech.routeStatus === 'UNAVAILABLE' && selectedTech.customerLatitude && selectedTech.customerLongitude) ||
                      selectedTech.statusFreshness === 'STALE') && (
                      <button
                        type="button"
                        disabled={isRecalculating === selectedTech.technicianId}
                        onClick={() => handleRetryRoute(selectedTech.technicianId)}
                        className="shrink-0 text-[10px] font-semibold text-primary-600 hover:text-primary-700 disabled:opacity-50 inline-flex items-center gap-0.5 hover:underline"
                        title="Recalculate road distance and ETA"
                      >
                        <RefreshCw className={cn('w-2.5 h-2.5', isRecalculating === selectedTech.technicianId && 'animate-spin')} />
                        <span>Retry</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Accuracy & Telemetry Details */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>GPS Accuracy:</span>
                  <span className="font-medium text-slate-700">
                    {selectedTech.trackingStatus === 'UNTRACKED'
                      ? 'N/A'
                      : selectedTech.accuracy
                      ? `±${Math.round(selectedTech.accuracy)}m`
                      : 'Standard'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Last Update:</span>
                  <span className="font-medium text-slate-700">
                    {selectedTech.trackingStatus === 'UNTRACKED'
                      ? 'No active session'
                      : selectedTech.secondsAgo < 5
                      ? 'Just now'
                      : `${selectedTech.secondsAgo}s ago`}
                  </span>
                </div>

                {/* Location Warning for Stale / Outdated Coordinates */}
                {selectedTech.trackingStatus !== 'UNTRACKED' &&
                  (selectedTech.statusFreshness === 'STALE' || selectedTech.statusFreshness === 'OFFLINE') && (
                    <div className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-center gap-1.5 font-medium mt-1">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Location warning: Current position cannot be confirmed.</span>
                    </div>
                  )}

                {/* Action: View Job Card */}
                {selectedTech.jobCardId && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (onViewJobCard) {
                          onViewJobCard(selectedTech.jobCardId!);
                        } else {
                          navigate(`/job-cards/${selectedTech.jobCardId}`);
                        }
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs shadow-xs transition-colors"
                    >
                      <span>View Job Card</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Floating Expand Tab when sidebar is collapsed */}
          {!sidebarOpen && (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-white/95 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200 px-3 py-2 rounded-xl shadow-md text-xs font-semibold backdrop-blur-xs transition-all hover:shadow-lg group cursor-pointer"
              title="Open technicians roster"
              aria-label="Open technicians roster"
            >
              <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-transform group-hover:-translate-x-0.5" />
              <Users className="w-4 h-4 text-slate-500 group-hover:text-primary-600 transition-colors" />
              <span>Show Technicians</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 group-hover:bg-primary-50 group-hover:text-primary-700">
                {technicians.length}
              </span>
            </button>
          )}
        </div>

        {/* Collapsible Technicians List Sidebar */}
        {sidebarOpen && (
          <aside
            aria-label="Technicians roster side panel"
            className="w-80 border-l border-slate-200 bg-white flex flex-col shrink-0 z-10 relative animate-in slide-in-from-right-2 duration-150"
          >
            {/* Panel Header */}
            <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-500" />
                <span className="font-semibold text-xs text-slate-800">Technicians Roster</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700">
                  {filteredTechnicians.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer flex items-center justify-center"
                title="Collapse side panel"
                aria-label="Collapse side panel"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Collapse toggle tab on the left border */}
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="absolute -left-3 top-3 z-20 w-3 h-8 bg-white border border-slate-200 border-r-0 rounded-l-md shadow-xs flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              title="Collapse side panel"
              aria-label="Collapse side panel tab"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
            {/* Search & Filter */}
            <div className="p-3 border-b border-slate-100 space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search technician or customer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
                {['ALL', 'LIVE', 'WARNING', 'STALE', 'UNTRACKED'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={cn(
                      'px-2 py-0.5 rounded-full font-medium whitespace-nowrap transition-colors',
                      statusFilter === st
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    )}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {filteredTechnicians.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  No active technicians match filter.
                </div>
              ) : (
                filteredTechnicians.map((tech) => {
                  const isSelected = tech.technicianId === selectedTechId;
                  return (
                    <div
                      key={tech.technicianId}
                      onClick={() => handleSelectTech(tech)}
                      className={cn(
                        'p-3 hover:bg-slate-50 cursor-pointer transition-colors text-xs',
                        isSelected && 'bg-primary-50/60 border-l-2 border-primary-600'
                      )}
                    >
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <span className="font-bold text-slate-900 truncate">
                          {tech.technicianName}
                        </span>
                        <span
                          className={cn(
                            'text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0',
                            tech.trackingStatus === 'UNTRACKED'
                              ? 'bg-slate-100 text-slate-600 border border-slate-300'
                              : tech.statusFreshness === 'LIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : tech.statusFreshness === 'WARNING'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          )}
                        >
                          {tech.trackingStatus === 'UNTRACKED'
                            ? 'UNTRACKED'
                            : tech.statusFreshness === 'LIVE'
                            ? 'LIVE TRACKING'
                            : 'STALE LOCATION'}
                        </span>
                      </div>

                      {tech.customerName && (
                        <p className="text-[11px] text-slate-600 font-medium truncate mb-1">
                          → {tech.customerName}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>
                          {tech.trackingStatus === 'UNTRACKED'
                            ? 'Untracked'
                            : tech.trackingStatus === 'NAVIGATION_STARTING'
                            ? 'Starting Nav...'
                            : tech.trackingStatus === 'NAVIGATION_ERROR'
                            ? 'Nav Error'
                            : tech.statusFreshness === 'LIVE'
                            ? 'Live Tracking'
                            : 'Stale Location'}
                        </span>
                        <span>
                          {tech.trackingStatus === 'UNTRACKED'
                            ? (tech.secondsAgo < 999999 && tech.secondsAgo > 0 ? `Last: ${tech.secondsAgo}s ago` : 'Not Navigating')
                            : (tech.secondsAgo < 5 ? 'Just now' : `${tech.secondsAgo}s ago`)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
