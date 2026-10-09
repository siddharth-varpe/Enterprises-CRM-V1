import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AdminLiveTechnicianMap, type ActiveTechnicianLocation } from './AdminLiveTechnicianMap';
import { apiClient } from '../../../lib/api-client';

// Mock Socket.IO
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

// Mock Google Maps JS API Loader
vi.mock('@googlemaps/js-api-loader', () => ({
  setOptions: vi.fn(),
  importLibrary: vi.fn().mockImplementation((lib: string) => {
    if (lib === 'maps') {
      return Promise.resolve({
        Map: vi.fn().mockImplementation(() => ({
          setCenter: vi.fn(),
          setZoom: vi.fn(),
          panTo: vi.fn(),
          fitBounds: vi.fn(),
        })),
      });
    }
    return Promise.resolve({});
  }),
}));

// Mock API Client
vi.mock('../../../lib/api-client', () => ({
  getApiBaseUrl: vi.fn().mockReturnValue('http://localhost:3000'),
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('AdminLiveTechnicianMap Component Suite', () => {
  const mockConfig = {
    apiKey: 'mock-browser-maps-key-12345',
    mapId: 'mock-map-id-67890',
    stalenessThresholds: {
      liveSeconds: 30,
      warningSeconds: 90,
      staleSeconds: 900,
      offlineSeconds: 3600,
    },
  };

  const mockTechnicians: ActiveTechnicianLocation[] = [
    {
      technicianId: 'tech-01',
      technicianName: 'Rajesh Sharma',
      technicianPhone: '9876543210',
      serviceId: 'srv-101',
      jobCardId: 'jc-201',
      trackingStatus: 'ON_THE_WAY',
      latitude: 18.5204,
      longitude: 73.8567,
      accuracy: 12,
      customerName: 'Aarav Patel',
      customerAddress: 'Flat 402, Green Acres, Baner, Pune',
      customerLatitude: 18.5590,
      customerLongitude: 73.7868,
      distanceKm: 8.4,
      etaMinutes: 22,
      lastUpdated: new Date().toISOString(),
      statusFreshness: 'LIVE',
      secondsAgo: 5,
    },
    {
      technicianId: 'tech-02',
      technicianName: 'Amit Verma',
      technicianPhone: '9811223344',
      serviceId: 'srv-102',
      jobCardId: 'jc-202',
      trackingStatus: 'AT_CUSTOMER',
      latitude: 18.5089,
      longitude: 73.9260,
      accuracy: 8,
      customerName: 'Priya Joshi',
      customerAddress: 'B-12, Kothrud, Pune',
      customerLatitude: 18.5089,
      customerLongitude: 73.9260,
      distanceKm: 0.1,
      etaMinutes: 1,
      lastUpdated: new Date(Date.now() - 45000).toISOString(),
      statusFreshness: 'WARNING',
      secondsAgo: 45,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (apiClient.get as any).mockImplementation((url: string) => {
      if (url === '/maps/admin/config') {
        return Promise.resolve({ data: mockConfig });
      }
      if (url === '/maps/admin/live-technicians') {
        return Promise.resolve({ data: mockTechnicians });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });
  });

  const renderComponent = (props = {}) =>
    render(
      <BrowserRouter>
        <AdminLiveTechnicianMap {...props} />
      </BrowserRouter>
    );

  it('renders Admin Live Technician Map header and active technician telemetry metrics', async () => {
    renderComponent();

    expect(screen.getByText(/Admin Live Technician Map/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Rajesh Sharma')).toBeInTheDocument();
      expect(screen.getByText('Amit Verma')).toBeInTheDocument();
    });

    // Verify counter counts
    expect(screen.getByText('Active:')).toBeInTheDocument();
    expect(screen.getByText('Live:')).toBeInTheDocument();
  });

  it('filters active technicians list via search input', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Rajesh Sharma')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search technician or customer/i);
    fireEvent.change(searchInput, { target: { value: 'Rajesh' } });

    expect(screen.getByText('Rajesh Sharma')).toBeInTheDocument();
    expect(screen.queryByText('Amit Verma')).not.toBeInTheDocument();
  });

  it('opens detailed floating card with operational info when technician is clicked', async () => {
    const mockOnViewJobCard = vi.fn();
    renderComponent({ onViewJobCard: mockOnViewJobCard });

    await waitFor(() => {
      expect(screen.getByText('Rajesh Sharma')).toBeInTheDocument();
    });

    // Click on Rajesh Sharma in list
    fireEvent.click(screen.getByText('Rajesh Sharma'));

    // Check floating card details
    await waitFor(() => {
      expect(screen.getByText('Destination Customer')).toBeInTheDocument();
      expect(screen.getByText('Aarav Patel')).toBeInTheDocument();
      expect(screen.getByText(/Flat 402, Green Acres/i)).toBeInTheDocument();
      expect(screen.getByText('8.4 km')).toBeInTheDocument();
      expect(screen.getByText('~22 mins')).toBeInTheDocument();
      expect(screen.getByText('±12m')).toBeInTheDocument();
      expect(screen.getByText('View Job Card')).toBeInTheDocument();
    });

    // Click View Job Card action button
    fireEvent.click(screen.getByText('View Job Card'));
    expect(mockOnViewJobCard).toHaveBeenCalledWith('jc-201');
  });

  it('displays empty state banner when no technicians are active', async () => {
    (apiClient.get as any).mockImplementation((url: string) => {
      if (url === '/maps/admin/config') return Promise.resolve({ data: mockConfig });
      if (url === '/maps/admin/live-technicians') return Promise.resolve({ data: [] });
      return Promise.reject(new Error('Not found'));
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/No Active Navigating Technicians/i)).toBeInTheDocument();
    });
  });

  it('displays graceful error banner if Google Maps config fails to load', async () => {
    (apiClient.get as any).mockImplementation((url: string) => {
      if (url === '/maps/admin/config') return Promise.reject(new Error('Network error loading config'));
      if (url === '/maps/admin/live-technicians') return Promise.resolve({ data: [] });
      return Promise.reject(new Error('Not found'));
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Google Maps Initialization Error/i)).toBeInTheDocument();
      expect(screen.getByText(/Network error loading config/i)).toBeInTheDocument();
    });
  });

  it('displays clear Unavailable state when destination coordinates are missing without endless Calculating...', async () => {
    const techWithoutDest: ActiveTechnicianLocation = {
      technicianId: 'tech-kartik',
      technicianName: 'Kartik',
      technicianPhone: '8432708662',
      serviceId: '',
      trackingStatus: 'ON_THE_WAY',
      latitude: 18.5883,
      longitude: 73.7819,
      accuracy: 11,
      lastUpdated: new Date(Date.now() - 200000).toISOString(),
      statusFreshness: 'STALE',
      secondsAgo: 200,
      routeStatus: 'UNAVAILABLE',
      routeErrorCode: 'MISSING_DESTINATION',
    };

    (apiClient.get as any).mockImplementation((url: string) => {
      if (url === '/maps/admin/config') return Promise.resolve({ data: mockConfig });
      if (url === '/maps/admin/live-technicians') return Promise.resolve({ data: [techWithoutDest] });
      return Promise.reject(new Error('Not found'));
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Kartik')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Kartik'));

    await waitFor(() => {
      // Both distance and ETA should say 'Unavailable', NEVER stuck on 'Calculating...'
      const unavailables = screen.getAllByText('Unavailable');
      expect(unavailables.length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('Destination coordinates not set')).toBeInTheDocument();
      expect(screen.queryByText('Calculating...')).not.toBeInTheDocument();
    });
  });

  it('handles route error and allows retrying route recalculation', async () => {
    const techWithError: ActiveTechnicianLocation = {
      technicianId: 'tech-error',
      technicianName: 'Suresh Kumar',
      serviceId: 'srv-999',
      trackingStatus: 'ON_THE_WAY',
      latitude: 18.5204,
      longitude: 73.8567,
      customerName: 'Target Customer',
      customerAddress: 'Kalyani Nagar, Pune',
      customerLatitude: 18.5500,
      customerLongitude: 73.9000,
      accuracy: 10,
      lastUpdated: new Date().toISOString(),
      statusFreshness: 'LIVE',
      secondsAgo: 5,
      routeStatus: 'ERROR',
      routeErrorCode: 'PROVIDER_RATE_LIMITED',
    };

    (apiClient.get as any).mockImplementation((url: string) => {
      if (url === '/maps/admin/config') return Promise.resolve({ data: mockConfig });
      if (url === '/maps/admin/live-technicians') return Promise.resolve({ data: [techWithError] });
      return Promise.reject(new Error('Not found'));
    });

    (apiClient.post as any).mockResolvedValueOnce({
      data: {
        technicianId: 'tech-error',
        routeStatus: 'SUCCESS',
        distanceKm: 6.2,
        etaMinutes: 18,
        distanceMeters: 6200,
        etaSeconds: 1080,
      },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Suresh Kumar')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Suresh Kumar'));

    await waitFor(() => {
      expect(screen.getByText('Rate limit reached (quota)')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    // Click Retry
    fireEvent.click(screen.getByText('Retry'));

    expect(apiClient.post).toHaveBeenCalledWith('/maps/admin/recalculate-route', {
      technicianId: 'tech-error',
    });

    await waitFor(() => {
      expect(screen.getByText('6.2 km')).toBeInTheDocument();
      expect(screen.getByText('~18 mins')).toBeInTheDocument();
      expect(screen.getByText('Live road route')).toBeInTheDocument();
    });
  });

  it('TEST A & G — Displays assigned technician who has not clicked Navigate as UNTRACKED without fake live coordinates', async () => {
    const untrackedTech: ActiveTechnicianLocation = {
      technicianId: 'tech-untracked-01',
      technicianName: 'Vikas Deshmukh',
      technicianPhone: '9988776655',
      serviceId: 'srv-pending-01',
      trackingStatus: 'UNTRACKED',
      latitude: null,
      longitude: null,
      customerName: 'Rohit Sharma',
      customerAddress: 'Hadapsar, Pune',
      customerLatitude: 18.5089,
      customerLongitude: 73.9260,
      lastUpdated: new Date().toISOString(),
      statusFreshness: 'STALE',
      secondsAgo: 999999,
      routeStatus: 'IDLE',
    };

    (apiClient.get as any).mockImplementation((url: string) => {
      if (url === '/maps/admin/config') return Promise.resolve({ data: mockConfig });
      if (url === '/maps/admin/live-technicians') return Promise.resolve({ data: [untrackedTech] });
      return Promise.reject(new Error('Not found'));
    });

    renderComponent();

    // Verify Untracked counter badge in top bar
    await waitFor(() => {
      expect(screen.getByText('Untracked:')).toBeInTheDocument();
      expect(screen.getByText('Vikas Deshmukh')).toBeInTheDocument();
    });

    // In list: UNTRACKED badge and 'Not Navigating' indicator
    expect(screen.getAllByText('UNTRACKED').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Not Navigating')).toBeInTheDocument();

    // Click on technician to view floating card
    fireEvent.click(screen.getByText('Vikas Deshmukh'));

    await waitFor(() => {
      // Floating card verifies UNTRACKED state and NO fake route/distance/ETA
      const untrackedBadges = screen.getAllByText('UNTRACKED');
      expect(untrackedBadges.length).toBeGreaterThanOrEqual(1);

      const notNavigatingLabels = screen.getAllByText('Not Navigating');
      // Both Road Distance and Estimated ETA display 'Not Navigating'
      expect(notNavigatingLabels.length).toBeGreaterThanOrEqual(2);

      expect(screen.getByText('Navigation not started (Untracked)')).toBeInTheDocument();
      expect(screen.getByText('No active session')).toBeInTheDocument();
      expect(screen.getByText('N/A')).toBeInTheDocument(); // GPS Accuracy: N/A
    });
  });

  it('TEST Filter — Allows filtering list specifically by UNTRACKED technicians', async () => {
    const mixedTechnicians: ActiveTechnicianLocation[] = [
      {
        technicianId: 'tech-live-1',
        technicianName: 'Live Navigating Tech',
        serviceId: 'srv-live-1',
        trackingStatus: 'ON_THE_WAY',
        statusFreshness: 'LIVE',
        latitude: 18.5204,
        longitude: 73.8567,
        lastUpdated: new Date().toISOString(),
        secondsAgo: 5,
      },
      {
        technicianId: 'tech-untracked-1',
        technicianName: 'Idle Untracked Tech',
        serviceId: 'srv-untracked-1',
        trackingStatus: 'UNTRACKED',
        statusFreshness: 'STALE',
        latitude: null,
        longitude: null,
        lastUpdated: new Date().toISOString(),
        secondsAgo: 999999,
      },
    ];

    (apiClient.get as any).mockImplementation((url: string) => {
      if (url === '/maps/admin/config') return Promise.resolve({ data: mockConfig });
      if (url === '/maps/admin/live-technicians') return Promise.resolve({ data: mixedTechnicians });
      return Promise.reject(new Error('Not found'));
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Live Navigating Tech')).toBeInTheDocument();
      expect(screen.getByText('Idle Untracked Tech')).toBeInTheDocument();
    });

    // Click UNTRACKED filter tab
    const untrackedTab = screen.getByRole('button', { name: 'UNTRACKED' });
    fireEvent.click(untrackedTab);

    // Only untracked tech should be visible in list
    expect(screen.getByText('Idle Untracked Tech')).toBeInTheDocument();
    expect(screen.queryByText('Live Navigating Tech')).not.toBeInTheDocument();

    // Click LIVE filter tab
    const liveTab = screen.getByRole('button', { name: 'LIVE' });
    fireEvent.click(liveTab);

    // Only live tech should be visible in list
    expect(screen.getByText('Live Navigating Tech')).toBeInTheDocument();
    expect(screen.queryByText('Idle Untracked Tech')).not.toBeInTheDocument();
  });

  it('TEST E & F — Rejects invalid or out-of-range coordinates without crashing map component', async () => {
    const invalidCoordsTech: ActiveTechnicianLocation = {
      technicianId: 'tech-invalid-coords',
      technicianName: 'Invalid Coords Tech',
      serviceId: 'srv-inv-01',
      trackingStatus: 'ON_THE_WAY',
      statusFreshness: 'LIVE',
      latitude: 999.999 as any, // Out of range (>90)
      longitude: NaN as any,
      lastUpdated: new Date().toISOString(),
      secondsAgo: 1,
    };

    (apiClient.get as any).mockImplementation((url: string) => {
      if (url === '/maps/admin/config') return Promise.resolve({ data: mockConfig });
      if (url === '/maps/admin/live-technicians') return Promise.resolve({ data: [invalidCoordsTech] });
      return Promise.reject(new Error('Not found'));
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Invalid Coords Tech')).toBeInTheDocument();
    });

    // Map component renders safely without crashing
    expect(screen.getByText(/Admin Live Technician Map/i)).toBeInTheDocument();
    // Since coordinates are invalid, empty state banner correctly indicates no valid tracking
    expect(screen.getByText(/No Active Navigating Technicians/i)).toBeInTheDocument();
  });

  it('TEST J — Correctly identifies stale locations and renders honest warning indicators without falsely showing fresh live status', async () => {
    const staleTech: ActiveTechnicianLocation = {
      technicianId: 'tech-stale-01',
      technicianName: 'Stale Navigating Tech',
      serviceId: 'srv-stale-01',
      trackingStatus: 'ON_THE_WAY',
      statusFreshness: 'STALE',
      latitude: 18.5204,
      longitude: 73.8567,
      customerName: 'Stale Customer Target',
      customerAddress: 'Hadapsar, Pune',
      customerLatitude: 18.5089,
      customerLongitude: 73.9260,
      lastUpdated: new Date(Date.now() - 300000).toISOString(),
      secondsAgo: 300,
    };

    (apiClient.get as any).mockImplementation((url: string) => {
      if (url === '/maps/admin/config') return Promise.resolve({ data: mockConfig });
      if (url === '/maps/admin/live-technicians') return Promise.resolve({ data: [staleTech] });
      return Promise.reject(new Error('Not found'));
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Stale Navigating Tech')).toBeInTheDocument();
      expect(screen.getByText('STALE LOCATION')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Stale Navigating Tech'));

    await waitFor(() => {
      const staleBadges = screen.getAllByText('NAVIGATING / STALE LOCATION');
      expect(staleBadges.length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('300s ago').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Location warning: Current position cannot be confirmed.')).toBeInTheDocument();
    });
  });

  it('supports collapsing and expanding the technicians side panel via panel header, border tab, floating button, and top bar', async () => {
    renderComponent();

    // 1. Initial state: side panel is open with header title visible
    await waitFor(() => {
      expect(screen.getByText('Technicians Roster')).toBeInTheDocument();
      expect(screen.getByText('Rajesh Sharma')).toBeInTheDocument();
    });

    // 2. Collapse via side panel header collapse button
    const collapseHeaderBtn = screen.getByRole('button', { name: 'Collapse side panel' });
    fireEvent.click(collapseHeaderBtn);

    // Side panel is collapsed
    expect(screen.queryByText('Technicians Roster')).not.toBeInTheDocument();
    expect(screen.queryByText('Rajesh Sharma')).not.toBeInTheDocument();

    // Floating expand button on map is visible
    const floatingExpandBtn = screen.getByRole('button', { name: 'Open technicians roster' });
    expect(floatingExpandBtn).toBeInTheDocument();
    expect(screen.getByText('Show Technicians')).toBeInTheDocument();

    // Top bar indicates 'Show List'
    expect(screen.getByText('Show List')).toBeInTheDocument();

    // 3. Expand via floating button
    fireEvent.click(floatingExpandBtn);
    expect(screen.getByText('Technicians Roster')).toBeInTheDocument();
    expect(screen.getByText('Rajesh Sharma')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open technicians roster' })).not.toBeInTheDocument();

    // 4. Collapse via border tab
    const borderTabBtn = screen.getByRole('button', { name: 'Collapse side panel tab' });
    fireEvent.click(borderTabBtn);
    expect(screen.queryByText('Technicians Roster')).not.toBeInTheDocument();

    // 5. Expand via top bar button
    const topBarToggle = screen.getByRole('button', { name: /Show List/i });
    fireEvent.click(topBarToggle);
    expect(screen.getByText('Technicians Roster')).toBeInTheDocument();

    // 6. Collapse via top bar button
    const topBarHide = screen.getByRole('button', { name: /Hide List/i });
    fireEvent.click(topBarHide);
    expect(screen.queryByText('Technicians Roster')).not.toBeInTheDocument();
  });
});

