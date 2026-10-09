/// <reference types="@types/google.maps" />
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import {
  MapPin,
  Navigation,
  ChevronRight,
  RotateCw,
  FileText,
  Layers,
  Map as MapIcon,
  Crosshair,
  Compass,
  AlertCircle,
  Car,
} from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { useTechnicianTracking } from '../hooks/useTechnicianTracking';
import { isValidCoordinate } from '../../technicians/components/AdminLiveTechnicianMap';

export interface AdminMapsConfig {
  apiKey: string;
  mapId: string | null;
}

export const TechnicianActiveNavigationPage: React.FC = () => {
  const navigate = useNavigate();
  const tracking = useTechnicianTracking();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const techMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  const [mapsConfig, setMapsConfig] = useState<AdminMapsConfig | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [calculatedDistance, setCalculatedDistance] = useState<string | null>(null);
  const [calculatedDuration, setCalculatedDuration] = useState<string | null>(null);

  // Get active destination from tracking state or localStorage fallback
  const activeDest = tracking.destination;
  const activeServiceId = tracking.activeServiceId || (typeof window !== 'undefined' ? localStorage.getItem('technician_current_job_id') : null);

  const [cachedJobData, setCachedJobData] = useState<any>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('technician_current_job_data') : null;
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('technician_current_job_data') : null;
      if (raw) setCachedJobData(JSON.parse(raw));
    } catch {}
  }, [activeServiceId]);

  // 1. Fetch Google Maps API Key
  useEffect(() => {
    let mounted = true;
    const fetchConfig = async () => {
      try {
        const res = await apiClient.get<AdminMapsConfig>('/maps/admin/config');
        if (mounted && res?.data?.apiKey) {
          setMapsConfig(res.data);
        }
      } catch (err: any) {
        if (mounted) setMapError(err?.message || 'Failed to load Google Maps configuration.');
      }
    };

    fetchConfig();
    return () => {
      mounted = false;
    };
  }, []);

  // 2. Fetch current technician device coordinates if available
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCurrentCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
      );
    }
  }, []);

  // 3. Initialize Google Maps
  useEffect(() => {
    if (!mapsConfig?.apiKey || !mapContainerRef.current) return;
    let isCancelled = false;

    async function initMap() {
      try {
        setOptions({
          key: mapsConfig!.apiKey,
          v: 'weekly',
          mapIds: mapsConfig!.mapId ? [mapsConfig!.mapId] : undefined,
        });

        const [{ Map }] = await Promise.all([
          importLibrary('maps') as Promise<google.maps.MapsLibrary>,
          importLibrary('marker').catch(() => null),
          importLibrary('geometry').catch(() => null),
        ]);

        if (isCancelled || !mapContainerRef.current) return;

        // Center priority: technician coordinates -> destination coordinates -> fallback
        const centerPos = currentCoords || (activeDest && isValidCoordinate(activeDest.latitude, activeDest.longitude)
          ? { lat: activeDest.latitude, lng: activeDest.longitude }
          : { lat: 18.5204, lng: 73.8567 });

        const mapOptions: google.maps.MapOptions = {
          center: centerPos,
          zoom: 14,
          mapId: mapsConfig!.mapId || undefined,
          disableDefaultUI: true,
          zoomControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        };

        const map = new Map(mapContainerRef.current, mapOptions);
        mapInstanceRef.current = map;
        setMapLoaded(true);
      } catch (err: any) {
        if (!isCancelled) {
          setMapError(err?.message || 'Unable to initialize map.');
        }
      }
    }

    initMap();
    return () => {
      isCancelled = true;
    };
  }, [mapsConfig, currentCoords, activeDest]);

  // 4. Render Markers and Route Polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !(window as any).google?.maps || !mapLoaded) return;
    const google = (window as any).google;

    // Clean up existing markers and polyline
    if (techMarkerRef.current) {
      if (typeof techMarkerRef.current.setMap === 'function') techMarkerRef.current.setMap(null);
      else if ('map' in techMarkerRef.current) techMarkerRef.current.map = null;
      techMarkerRef.current = null;
    }
    if (destMarkerRef.current) {
      if (typeof destMarkerRef.current.setMap === 'function') destMarkerRef.current.setMap(null);
      else if ('map' in destMarkerRef.current) destMarkerRef.current.map = null;
      destMarkerRef.current = null;
    }
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    // A. Technician Position Marker (Blue pulsating circle)
    if (currentCoords && isValidCoordinate(currentCoords.lat, currentCoords.lng)) {
      const pos = { lat: currentCoords.lat, lng: currentCoords.lng };
      bounds.extend(pos);
      hasPoints = true;

      techMarkerRef.current = new google.maps.Marker({
        map,
        position: pos,
        title: 'Your Location',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: '#2563eb',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
      });
    }

    // B. Destination Marker (Red Pin with Info)
    const destLat = activeDest?.latitude ?? cachedJobData?.latitude;
    const destLng = activeDest?.longitude ?? cachedJobData?.longitude;

    if (isValidCoordinate(destLat, destLng)) {
      const destPos = { lat: destLat as number, lng: destLng as number };
      bounds.extend(destPos);
      hasPoints = true;

      destMarkerRef.current = new google.maps.Marker({
        map,
        position: destPos,
        title: activeDest?.customerName || cachedJobData?.customerName || 'Destination',
        icon: {
          path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
          fillColor: '#ef4444',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 1.5,
          scale: 1.5,
          anchor: new google.maps.Point(12, 22),
        },
      });

      // C. Directions & Route Polyline
      if (
        currentCoords &&
        isValidCoordinate(currentCoords.lat, currentCoords.lng) &&
        google.maps.DirectionsService
      ) {
        const directionsService = new google.maps.DirectionsService();
        directionsService.route(
          {
            origin: { lat: currentCoords.lat, lng: currentCoords.lng },
            destination: destPos,
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (result: any, status: any) => {
            if (status === 'OK' && result?.routes?.[0]) {
              const route = result.routes[0];
              if (route.overview_path) {
                polylineRef.current = new google.maps.Polyline({
                  map,
                  path: route.overview_path,
                  strokeColor: '#2563eb',
                  strokeWeight: 5,
                  strokeOpacity: 0.9,
                  zIndex: 10,
                });
              }

              // Save calculated leg distance and duration if available
              if (route.legs?.[0]) {
                const leg = route.legs[0];
                if (leg.distance?.text) setCalculatedDistance(leg.distance.text);
                if (leg.duration?.text) setCalculatedDuration(leg.duration.text);
              }
            }
          }
        );
      }
    }

    if (hasPoints) {
      map.fitBounds(bounds, 80);
    }
  }, [mapLoaded, currentCoords, activeDest, cachedJobData]);

  const handleRecenter = () => {
    if (mapInstanceRef.current && currentCoords) {
      mapInstanceRef.current.panTo(currentCoords);
      mapInstanceRef.current.setZoom(15);
    }
  };

  const handleOpenGoogleMaps = () => {
    const destLat = activeDest?.latitude ?? cachedJobData?.latitude;
    const destLng = activeDest?.longitude ?? cachedJobData?.longitude;
    const destAddress = activeDest?.address || cachedJobData?.serviceAddress || 'Customer Location';

    let url = '';
    if (isValidCoordinate(destLat, destLng)) {
      url = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`;
    } else {
      url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destAddress)}`;
    }

    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const customerName = activeDest?.customerName || cachedJobData?.customerName || 'Customer';
  const serviceNumber = activeDest?.serviceNumber || cachedJobData?.serviceNumber || 'SRV-PENDING';
  const serviceType = cachedJobData?.serviceType || 'Field Service';
  const serviceAddress = activeDest?.address || cachedJobData?.serviceAddress || 'Service Location';
  const priority = cachedJobData?.priority || 'HIGH';
  const assetName = cachedJobData?.productName ? `Asset: ${cachedJobData.productName}` : 'Commercial Equipment';

  // Distance and ETA display
  const displayEta = tracking.etaText || calculatedDuration || null;
  const displayDistance = tracking.distanceText || calculatedDistance || null;

  return (
    <div className="space-y-3 max-w-2xl mx-auto pb-6">
      {/* 1. Header matching Reference Screen 3 */}
      <div>
        <h1 className="text-xl sm:text-2xl font-display font-extrabold tracking-tight text-slate-900">
          My Work
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Live route to current job
        </p>
      </div>

      {/* 2. Filter Navigation Pills matching Reference Screen 3 */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80">
        <button
          type="button"
          onClick={() => navigate('/technician/services')}
          className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 transition-all cursor-pointer text-center"
        >
          Today's Jobs
        </button>
        <button
          type="button"
          onClick={() => navigate('/technician/services')}
          className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 transition-all cursor-pointer text-center"
        >
          Upcoming
        </button>
        <button
          type="button"
          className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-primary-600 text-white shadow-2xs transition-all cursor-default text-center flex items-center justify-center gap-1"
        >
          <MapIcon className="w-3.5 h-3.5" />
          <span>Map</span>
        </button>
      </div>

      {/* 3. Main Map Surface matching Reference Screen 3 */}
      <div className="relative w-full h-[60vh] min-h-[380px] max-h-[560px] rounded-3xl overflow-hidden border border-slate-200/90 shadow-2xs bg-slate-100">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Floating Route Metric Badge (Car icon + ETA + Distance) matching Reference */}
        {(displayEta || displayDistance) && (
          <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-20 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-md border border-slate-200/90 flex items-center gap-2 text-xs font-bold text-slate-900 pointer-events-none">
            <Car className="w-4 h-4 text-primary-600 shrink-0" />
            <span>
              {displayEta}
              {displayEta && displayDistance ? ' • ' : ''}
              {displayDistance}
            </span>
          </div>
        )}

        {/* Floating Destination Callout Badge matching Reference */}
        {activeDest && (
          <div className="absolute top-14 right-3 max-w-[200px] z-20 bg-white/95 backdrop-blur-md p-2.5 rounded-2xl shadow-md border border-slate-200/90 text-left text-xs space-y-0.5 pointer-events-none hidden sm:block">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
              <span className="truncate">{customerName}</span>
            </div>
            <p className="text-[11px] text-slate-500 line-clamp-2 leading-tight">
              {serviceAddress}
            </p>
          </div>
        )}

        {/* Floating Map Controls on Right */}
        <div className="absolute bottom-28 sm:bottom-24 right-3 z-20 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleRecenter}
            className="w-10 h-10 rounded-full bg-white/95 backdrop-blur-md shadow-md border border-slate-200 flex items-center justify-center text-slate-700 hover:text-primary-600 active:bg-slate-100 transition-colors cursor-pointer"
            title="Recenter to My Location"
          >
            <Crosshair className="w-5 h-5" />
          </button>
        </div>

        {/* Error / Fallback State if Map API fails */}
        {mapError && (
          <div className="absolute inset-0 bg-slate-100/90 backdrop-blur-xs flex items-center justify-center p-4 text-center z-30">
            <div className="bg-white p-5 rounded-2xl shadow-lg border border-slate-200 max-w-sm space-y-2">
              <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
              <h4 className="text-sm font-bold text-slate-900">Map Loading Notice</h4>
              <p className="text-xs text-slate-600">{mapError}</p>
              <button
                type="button"
                onClick={handleOpenGoogleMaps}
                className="mt-2 px-3 py-1.5 bg-primary-600 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Open in External Google Maps
              </button>
            </div>
          </div>
        )}

        {/* Floating / Docked Current Job Card inside / over the map matching Reference Screen 3 */}
        <div className="absolute bottom-2 left-2 right-2 z-20">
          {activeServiceId ? (
            <div className="bg-white/98 backdrop-blur-md border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-lg space-y-2.5">
              {/* Top row: Pulse dot + Current Job + In Progress */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 animate-pulse" />
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                    Current Job
                  </h3>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  In Progress
                </span>
              </div>

              {/* Badges: Service Number + Priority */}
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-sky-50 text-blue-700 border border-blue-200">
                  {serviceNumber}
                </span>
                <span
                  className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                    priority === 'URGENT'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-red-50 text-red-600 border-red-200'
                  }`}
                >
                  {priority}
                </span>
              </div>

              {/* Customer Name & Link */}
              <Link
                to={`/technician/services/${activeServiceId}`}
                className="flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-primary-700 transition-colors">
                    {customerName}
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium uppercase tracking-tight">
                    {serviceType}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-primary-600 transition-transform group-hover:translate-x-0.5" />
              </Link>

              {/* Location & Asset */}
              <div className="space-y-1 text-xs text-slate-600 pt-0.5">
                <div className="flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span className="line-clamp-1">{serviceAddress}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{assetName}</span>
                </div>
              </div>

              {/* Action Buttons: View Job Card & Navigate / Open External Maps */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                <Link
                  to={`/technician/services/${activeServiceId}`}
                  className="py-2 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer text-center"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>View Job Card</span>
                </Link>

                <button
                  type="button"
                  onClick={handleOpenGoogleMaps}
                  className="py-2 px-3 rounded-xl bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer text-center"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Navigate</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-4 text-center space-y-2 shadow-lg">
              <Compass className="w-7 h-7 text-primary-600 mx-auto" />
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                No Active Destination
              </h4>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                Select an assigned service from My Work or Assigned Services and tap Navigate to begin live routing.
              </p>
              <button
                type="button"
                onClick={() => navigate('/technician/services')}
                className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                View Assigned Work
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
