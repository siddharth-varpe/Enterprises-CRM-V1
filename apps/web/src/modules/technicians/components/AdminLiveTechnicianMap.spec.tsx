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
});
