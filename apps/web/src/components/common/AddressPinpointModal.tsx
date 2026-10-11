import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapPin,
  Navigation,
  Search,
  ExternalLink,
  Crosshair,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Copy,
  Check,
  Compass,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { apiClient } from '../../lib/api-client';

export interface AddressPinpointModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLatitude?: number | null;
  initialLongitude?: number | null;
  addressText?: string;
  title?: string;
  subtitle?: string;
  onSave: (coords: { latitude: number; longitude: number }) => void | Promise<void>;
}

export const AddressPinpointModal: React.FC<AddressPinpointModalProps> = ({
  isOpen,
  onClose,
  initialLatitude,
  initialLongitude,
  addressText = '',
  title = 'Pinpoint Exact Customer Location',
  subtitle = 'Provide precise GPS coordinates so technicians navigate directly to the customer doorstep.',
  onSave,
}) => {
  const [lat, setLat] = useState<number>(() => {
    return typeof initialLatitude === 'number' && !isNaN(initialLatitude) ? initialLatitude : 18.5204;
  });
  const [lng, setLng] = useState<number>(() => {
    return typeof initialLongitude === 'number' && !isNaN(initialLongitude) ? initialLongitude : 73.8567;
  });
  const [hasValidPin, setHasValidPin] = useState<boolean>(() => {
    return Boolean(
      typeof initialLatitude === 'number' &&
      !isNaN(initialLatitude) &&
      typeof initialLongitude === 'number' &&
      !isNaN(initialLongitude)
    );
  });

  const [pasteInput, setPasteInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      if (typeof initialLatitude === 'number' && !isNaN(initialLatitude) && typeof initialLongitude === 'number' && !isNaN(initialLongitude)) {
        setLat(initialLatitude);
        setLng(initialLongitude);
        setHasValidPin(true);
        setStatusMessage({ type: 'success', text: 'Verified coordinates loaded.' });
      } else {
        setLat(18.5204);
        setLng(73.8567);
        setHasValidPin(false);
        setStatusMessage({ type: 'info', text: 'No pinpoint set yet. Use GPS, search address, or paste a Google Maps link.' });
      }
      setPasteInput('');
      setIsSaving(false);
    }
  }, [isOpen, initialLatitude, initialLongitude]);

  // Handle parsing a pasted link or coordinates string
  const handleParseInput = async (customText?: string) => {
    const textToParse = (customText ?? pasteInput).trim();
    if (!textToParse) return;

    setIsLoading(true);
    setStatusMessage(null);

    try {
      const res = await apiClient.post<{ success: boolean; data: { latitude: number; longitude: number; formattedAddress?: string } }>(
        '/maps/geocode',
        { query: textToParse }
      );

      if (res?.data?.latitude && res?.data?.longitude) {
        const newLat = Number(res.data.latitude);
        const newLng = Number(res.data.longitude);
        setLat(newLat);
        setLng(newLng);
        setHasValidPin(true);
        setStatusMessage({
          type: 'success',
          text: `Extracted pinpoint: ${newLat.toFixed(5)}, ${newLng.toFixed(5)} ${res.data.formattedAddress ? `(${res.data.formattedAddress})` : ''}`,
        });
        updateMapCenter(newLat, newLng);
      } else {
        setStatusMessage({
          type: 'error',
          text: 'Could not extract coordinates from that link. Try pasting "lat, lng" coordinates or using GPS.',
        });
      }
    } catch (err: any) {
      // Client-side regex fallback
      const coordMatch = textToParse.match(/([-+]?[0-9]{1,2}(?:\.[0-9]+)?)[,\s]+([-+]?[0-9]{1,3}(?:\.[0-9]+)?)/);
      if (coordMatch) {
        const parsedLat = parseFloat(coordMatch[1]);
        const parsedLng = parseFloat(coordMatch[2]);
        if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
          setLat(parsedLat);
          setLng(parsedLng);
          setHasValidPin(true);
          setStatusMessage({ type: 'success', text: `Detected coordinates: ${parsedLat.toFixed(5)}, ${parsedLng.toFixed(5)}` });
          updateMapCenter(parsedLat, parsedLng);
          setIsLoading(false);
          return;
        }
      }
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to resolve location from input.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Use device current GPS
  const handleUseCurrentGps = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setStatusMessage({ type: 'error', text: 'Geolocation is not supported by this browser.' });
      return;
    }

    setIsLoading(true);
    setStatusMessage({ type: 'info', text: 'Acquiring high-accuracy device GPS...' });

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLat = pos.coords.latitude;
        const newLng = pos.coords.longitude;
        setLat(newLat);
        setLng(newLng);
        setHasValidPin(true);
        setStatusMessage({
          type: 'success',
          text: `GPS acquired! Accuracy: ~${Math.round(pos.coords.accuracy || 10)} meters (${newLat.toFixed(5)}, ${newLng.toFixed(5)})`,
        });
        updateMapCenter(newLat, newLng);
        setIsLoading(false);
      },
      (err) => {
        setIsLoading(false);
        setStatusMessage({
          type: 'error',
          text: err.code === 1 ? 'Location permission denied. Please allow location in your browser settings.' : 'Could not acquire GPS position.',
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Geocode from addressText
  const handleGeocodeAddress = async () => {
    if (!addressText.trim()) {
      setStatusMessage({ type: 'error', text: 'No address text available to geocode.' });
      return;
    }

    setIsLoading(true);
    setStatusMessage({ type: 'info', text: `Searching coordinates for "${addressText}"...` });

    try {
      const res = await apiClient.post<{ success: boolean; data: { latitude: number; longitude: number; formattedAddress?: string } }>(
        '/maps/geocode',
        { address: addressText }
      );

      if (res?.data?.latitude && res?.data?.longitude) {
        const newLat = Number(res.data.latitude);
        const newLng = Number(res.data.longitude);
        setLat(newLat);
        setLng(newLng);
        setHasValidPin(true);
        setStatusMessage({
          type: 'success',
          text: `Found location: ${newLat.toFixed(5)}, ${newLng.toFixed(5)} ${res.data.formattedAddress ? `(${res.data.formattedAddress})` : ''}`,
        });
        updateMapCenter(newLat, newLng);
      } else {
        setStatusMessage({
          type: 'error',
          text: 'No exact coordinates found for this address text. You can drag the pin or paste a Google Maps link.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Geocoding failed for this address.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to recenter map
  const updateMapCenter = (targetLat: number, targetLng: number) => {
    if (mapInstanceRef.current && typeof mapInstanceRef.current.panTo === 'function') {
      mapInstanceRef.current.panTo({ lat: targetLat, lng: targetLng });
      mapInstanceRef.current.setZoom(16);
    }
    if (markerRef.current && typeof markerRef.current.setPosition === 'function') {
      markerRef.current.setPosition({ lat: targetLat, lng: targetLng });
    }
  };

  // Initialize interactive map if container is mounted
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    let isCancelled = false;

    const initMap = async () => {
      try {
        const { setOptions, importLibrary } = await import('@googlemaps/js-api-loader');
        const configRes = await apiClient.get<{ success: boolean; data: { apiKey: string; mapId?: string } }>('/maps/admin/config').catch(() => null);
        const apiKey = configRes?.data?.apiKey || (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';

        if (!apiKey) throw new Error('No API key');

        setOptions({
          key: apiKey,
          v: 'weekly',
          libraries: ['places', 'geometry'],
        });

        const mapsLib = (await importLibrary('maps')) as google.maps.MapsLibrary;
        if (isCancelled || !mapContainerRef.current) return;

        const center = { lat, lng };
        const map = new mapsLib.Map(mapContainerRef.current, {
          center,
          zoom: hasValidPin ? 16 : 12,
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
        });
        mapInstanceRef.current = map;

        const marker = new google.maps.Marker({
          position: center,
          map,
          draggable: true,
          title: 'Customer Pinpoint Location',
          animation: google.maps.Animation.DROP,
        });
        markerRef.current = marker;

        marker.addListener('dragend', () => {
          const pos = marker.getPosition();
          if (pos) {
            const newLat = pos.lat();
            const newLng = pos.lng();
            setLat(newLat);
            setLng(newLng);
            setHasValidPin(true);
            setStatusMessage({ type: 'success', text: `Pin placed at: ${newLat.toFixed(5)}, ${newLng.toFixed(5)}` });
          }
        });

        map.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (e.latLng) {
            const newLat = e.latLng.lat();
            const newLng = e.latLng.lng();
            marker.setPosition(e.latLng);
            setLat(newLat);
            setLng(newLng);
            setHasValidPin(true);
            setStatusMessage({ type: 'success', text: `Pin moved to: ${newLat.toFixed(5)}, ${newLng.toFixed(5)}` });
          }
        });
      } catch {
        // Fallback: Embed interactive OpenStreetMap or canvas
      }
    };

    initMap();

    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  const handleSave = async () => {
    if (!hasValidPin) {
      setStatusMessage({ type: 'error', text: 'Please place or verify a pin before saving.' });
      return;
    }

    setIsSaving(true);
    try {
      await onSave({ latitude: lat, longitude: lng });
      onClose();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Failed to save pinpoint.' });
    } finally {
      setIsSaving(false);
    }
  };

  const googleMapsPreviewUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  const copyCoords = () => {
    navigator.clipboard.writeText(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <div className="space-y-4">
        <p className="text-xs text-slate-500">{subtitle}</p>

        {/* Current Pinpoint Status Card */}
        <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
          hasValidPin
            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
            : 'bg-amber-50/80 border-amber-200 text-amber-950'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              hasValidPin ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}>
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold flex items-center gap-1.5">
                <span>{hasValidPin ? 'Precise GPS Pinpoint Set' : 'Approximate Area (No Exact Pin)'}</span>
                {hasValidPin && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
              </div>
              <div className="text-[11px] font-mono mt-0.5 opacity-90">
                Lat: <strong>{lat.toFixed(5)}</strong>, Lng: <strong>{lng.toFixed(5)}</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {hasValidPin && (
              <button
                type="button"
                onClick={copyCoords}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-2xs font-semibold rounded-lg bg-white/90 border border-emerald-300 text-emerald-800 hover:bg-emerald-100/60 transition-colors cursor-pointer"
                title="Copy coordinates"
              >
                {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{isCopied ? 'Copied' : 'Copy'}</span>
              </button>
            )}

            <a
              href={googleMapsPreviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg bg-white border border-slate-200 text-primary-700 hover:bg-primary-50 shadow-2xs transition-colors cursor-pointer"
            >
              <span>Test Pin on Maps</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Quick Tools: 1-Click GPS & Address Geocode */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={handleUseCurrentGps}
            disabled={isLoading}
            className="w-full justify-center text-xs py-2 bg-white hover:bg-blue-50 border-blue-200 text-blue-700 flex items-center gap-2 cursor-pointer shadow-2xs"
          >
            <Crosshair className="w-3.5 h-3.5 text-blue-600" />
            <span>Use My Current Device GPS</span>
          </Button>

          {addressText && (
            <Button
              type="button"
              variant="outline"
              onClick={handleGeocodeAddress}
              disabled={isLoading}
              className="w-full justify-center text-xs py-2 bg-white hover:bg-slate-50 border-slate-200 text-slate-700 flex items-center gap-2 cursor-pointer shadow-2xs"
            >
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <span>Locate From Address Text</span>
            </Button>
          )}
        </div>

        {/* Paste Google Maps Link or Coordinates Input */}
        <div className="space-y-1.5 pt-1">
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-slate-500" />
            <span>Paste Google Maps Link or Coordinates</span>
          </label>
          <div className="flex items-center gap-2">
            <Input
              placeholder="e.g. 18.52043, 73.85674 or https://maps.app.goo.gl/... or WhatsApp shared location"
              value={pasteInput}
              onChange={(e) => {
                setPasteInput(e.target.value);
                if (e.target.value.includes(',') || e.target.value.includes('maps')) {
                  handleParseInput(e.target.value);
                }
              }}
              className="text-xs"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => handleParseInput()}
              disabled={isLoading || !pasteInput.trim()}
              className="shrink-0 text-xs py-2 px-3 bg-white"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Extract</span>}
            </Button>
          </div>
        </div>

        {/* Status Notification */}
        {statusMessage && (
          <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : statusMessage.type === 'error'
              ? 'bg-rose-50 text-rose-800 border border-rose-200'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}>
            {statusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {statusMessage.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
            {statusMessage.type === 'info' && <Compass className="w-4 h-4 text-blue-600 shrink-0" />}
            <span className="leading-tight">{statusMessage.text}</span>
          </div>
        )}

        {/* Interactive Map Canvas */}
        <div className="relative rounded-xl border border-slate-200 overflow-hidden bg-slate-100 h-56 sm:h-64 shadow-inner">
          <div ref={mapContainerRef} className="w-full h-full" />
          
          {/* Overlay Instruction */}
          <div className="absolute bottom-2.5 left-2.5 right-2.5 bg-slate-900/80 backdrop-blur-xs text-white text-[11px] px-3 py-1.5 rounded-lg flex items-center justify-between pointer-events-none shadow-sm">
            <span>Click or drag pin to adjust exact doorstep.</span>
            <span className="font-mono opacity-80">{lat.toFixed(4)}, {lng.toFixed(4)}</span>
          </div>
        </div>

        {/* Manual Latitude & Longitude Fine-Tuning */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <label className="text-[11px] font-semibold text-slate-500">Latitude</label>
            <input
              type="number"
              step="0.000001"
              value={lat}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) {
                  setLat(val);
                  setHasValidPin(true);
                  updateMapCenter(val, lng);
                }
              }}
              className="w-full mt-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-mono bg-white"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-500">Longitude</label>
            <input
              type="number"
              step="0.000001"
              value={lng}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) {
                  setLng(val);
                  setHasValidPin(true);
                  updateMapCenter(lat, val);
                }
              }}
              className="w-full mt-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-mono bg-white"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
            className="text-xs py-2 px-4"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSave}
            disabled={isSaving || !hasValidPin}
            className="text-xs py-2 px-5 flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold cursor-pointer shadow-xs"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
            <span>Confirm & Save Pinpoint</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
};
