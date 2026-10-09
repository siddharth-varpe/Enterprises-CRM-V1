/**
 * Maps & Technician Live Tracking Types
 * Isolated operational tracking state definition per Master Implementation Prompt.
 * Note: Tracking state is temporary operational state and strictly separate from job card execution state.
 */

export const TRACKING_STATUSES = {
  UNTRACKED: 'UNTRACKED',
  NOT_TRACKING: 'UNTRACKED',
  NAVIGATION_STARTING: 'NAVIGATION_STARTING',
  NAVIGATION_SELECTED: 'NAVIGATION_STARTING',
  ON_THE_WAY: 'ON_THE_WAY',
  ARRIVAL_PENDING: 'ARRIVAL_PENDING',
  AT_CUSTOMER: 'AT_CUSTOMER',
  STALE: 'STALE',
  OFFLINE: 'OFFLINE',
  NAVIGATION_ERROR: 'NAVIGATION_ERROR',
  NAVIGATION_ENDED: 'NAVIGATION_ENDED',
  STOPPED_ON_WAY: 'STOPPED_ON_WAY',
} as const;

export type TrackingStatus = (typeof TRACKING_STATUSES)[keyof typeof TRACKING_STATUSES];

export const FRESHNESS_THRESHOLDS = {
  LIVE_MAX_AGE_SEC: 30,
  WARNING_MAX_AGE_SEC: 90,
  OFFLINE_MIN_AGE_SEC: 900, // 15 minutes
} as const;

export type StatusFreshness = 'LIVE' | 'WARNING' | 'STALE' | 'OFFLINE';

export interface TechnicianLocationPing {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
}

export interface ActiveDestinationRecord {
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
  scheduledDate?: string | Date | null;
  scheduledTimeSlot?: string | null;
  startedAt: number;
}

export type RouteCalculationStatus = 'IDLE' | 'LOADING' | 'SUCCESS' | 'UNAVAILABLE' | 'ERROR';

export type RouteErrorCode =
  | 'MISSING_ORIGIN'
  | 'MISSING_DESTINATION'
  | 'INVALID_COORDINATES'
  | 'LOCATION_STALE'
  | 'PROVIDER_CONFIGURATION_ERROR'
  | 'PROVIDER_AUTHORIZATION_ERROR'
  | 'PROVIDER_RATE_LIMITED'
  | 'PROVIDER_INVALID_RESPONSE'
  | 'NETWORK_ERROR'
  | 'REQUEST_TIMEOUT'
  | 'UNKNOWN_ROUTE_ERROR';

export interface TravelledPathPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
}

export interface TechnicianTrackingRecord {
  technicianId: string;
  technicianName: string;
  technicianPhone?: string;
  trackingStatus: TrackingStatus;
  activeDestination: ActiveDestinationRecord | null;
  currentLocation: TechnicianLocationPing | null;
  distanceMeters?: number | null;
  distanceText?: string | null;
  etaSeconds?: number | null;
  etaText?: string | null;
  routeStatus?: RouteCalculationStatus;
  routeErrorCode?: RouteErrorCode | null;
  routeErrorMessage?: string | null;
  routeCalculatedAt?: number | null;
  routeOriginLat?: number | null;
  routeOriginLng?: number | null;
  routePolyline?: string | null;
  travelledPath?: TravelledPathPoint[];
  arrivalPendingSince?: number | null;
  arrivalPendingSamples?: number;
  lastUpdate: number;
  freshness: StatusFreshness;
}

export interface RoutesCalculationResult {
  status: RouteCalculationStatus;
  distanceMeters: number;
  durationSeconds: number;
  distanceText: string;
  durationText: string;
  source: 'GOOGLE_ROUTES_API' | 'HAVERSINE_ESTIMATE';
  polyline?: string | null;
  errorCode?: RouteErrorCode | null;
  errorMessage?: string | null;
  calculatedAt?: number;
}


