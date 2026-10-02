import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TechnicianProfilePage } from './TechnicianProfilePage';
import { ToastProvider } from '../../providers/ToastProvider';
import * as techniciansApi from './technicians.api';
import type { TechnicianAdmin360Profile } from './technicians.api';

// Mock API hooks
vi.mock('./technicians.api', async () => {
  const actual = await vi.importActual<typeof techniciansApi>('./technicians.api');
  return {
    ...actual,
    useTechnician360Query: vi.fn(),
    useTogglePortalAccessMutation: vi.fn(),
  };
});

describe('TechnicianProfilePage Component (Admin 360° Profile)', () => {
  let queryClient: QueryClient;
  const mockMutateAsync = vi.fn();

  const mockProfile: TechnicianAdmin360Profile = {
    technician: {
      id: 'tech-123',
      fullName: 'Rahul Sharma',
      phone: '9876543210',
      email: 'rahul@srenterprises.com',
      status: 'ACTIVE',
      availability: 'AVAILABLE',
      portalEnabled: true,
      skills: ['RO Installation', 'Membrane Cleaning'],
      address: 'Shop 4, Market Complex, Pune',
      emergencyContact: '9876500000',
      createdAt: '2026-01-15T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    },
    workSummary: {
      currentWorkload: 2,
      assignedCount: 5,
      inProgressCount: 1,
      upcomingCount: 1,
      completedCount: 3,
      completionRate: 60,
      averageCompletionTimeMinutes: 45,
      averageCompletionTimeFormatted: '45m',
      isAverageCompletionTimeReliable: true,
      sampleSize: 3,
    },
    financialSummary: {
      totalInvoiced: 4500,
      totalCollected: 3500,
      pendingBalance: 1000,
      collectionsCount: 1,
    },
    currentWork: [
      {
        id: 'srv-1',
        serviceNumber: 'SRV-2026-001',
        serviceType: 'REPAIR',
        serviceClassification: 'AMC',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        scheduledDate: '2026-10-01T10:00:00.000Z',
        scheduledTimeSlot: '10:00 AM - 12:00 PM',
        customerId: 'cust-1',
        customerName: 'Pooja Patil',
        customerPhone: '9988776655',
        assetId: 'ast-1',
        machineName: 'Commercial RO 50 LPH',
        serviceLocation: 'Pune',
        jobCardId: 'jc-1',
        jobCardNumber: 'JC-2026-001',
        createdAt: '2026-10-01T09:00:00.000Z',
      },
    ],
    upcomingWork: [
      {
        id: 'srv-2',
        serviceNumber: 'SRV-2026-002',
        serviceType: 'PERIODIC_MAINTENANCE',
        serviceClassification: 'REGULAR',
        status: 'SCHEDULED',
        priority: 'MEDIUM',
        scheduledDate: '2026-10-02T14:00:00.000Z',
        scheduledTimeSlot: '02:00 PM - 04:00 PM',
        customerId: 'cust-2',
        customerName: 'Anand Kulkarni',
        customerPhone: '9911223344',
        assetId: 'ast-2',
        machineName: 'Domestic RO System',
        serviceLocation: 'Pune',
        jobCardId: null,
        jobCardNumber: null,
        createdAt: '2026-10-01T09:00:00.000Z',
      },
    ],
    completedServices: [
      {
        id: 'srv-3',
        serviceNumber: 'SRV-2026-003',
        serviceType: 'INSTALLATION',
        serviceClassification: 'NEW',
        status: 'COMPLETED',
        priority: 'LOW',
        scheduledDate: '2026-09-20T09:00:00.000Z',
        completedAt: '2026-09-20T10:30:00.000Z',
        customerId: 'cust-3',
        customerName: 'Nisha Verma',
        customerPhone: '9822334455',
        assetId: 'ast-3',
        machineName: 'Industrial Water Plant 250 LPH',
        serviceLocation: 'Pune',
        jobCardId: 'jc-3',
        jobCardNumber: 'JC-2026-003',
        invoiceNumber: 'INV-2026-003',
        invoiceTotal: '3500.00',
        invoiceStatus: 'PAID',
        createdAt: '2026-09-20T08:00:00.000Z',
      },
    ],
    assignedServices: [
      {
        id: 'srv-1',
        serviceNumber: 'SRV-2026-001',
        serviceType: 'REPAIR',
        serviceClassification: 'AMC',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        scheduledDate: '2026-10-01T10:00:00.000Z',
        scheduledTimeSlot: '10:00 AM - 12:00 PM',
        customerId: 'cust-1',
        customerName: 'Pooja Patil',
        customerPhone: '9988776655',
        assetId: 'ast-1',
        machineName: 'Commercial RO 50 LPH',
        serviceLocation: 'Pune',
        jobCardId: 'jc-1',
        jobCardNumber: 'JC-2026-001',
        createdAt: '2026-10-01T09:00:00.000Z',
      },
    ],
    jobCards: [
      {
        id: 'jc-1',
        jobCardNumber: 'JC-2026-001',
        serviceId: 'srv-1',
        serviceNumber: 'SRV-2026-001',
        status: 'IN_PROGRESS',
        customerId: 'cust-1',
        customerName: 'Pooja Patil',
        customerPhone: '9988776655',
        assetId: 'ast-1',
        assetName: 'Commercial RO 50 LPH',
        problemReported: 'Low water pressure',
        workPerformed: 'Checked pump and filter',
        laborCharges: '500.00',
        partsCharges: '700.00',
        totalCharges: '1200.00',
        startedAt: '2026-10-01T10:15:00.000Z',
        completedAt: null,
        createdAt: '2026-10-01T10:00:00.000Z',
      },
    ],
    customersHandled: [
      {
        customerId: 'cust-1',
        customerName: 'Pooja Patil',
        phone: '9988776655',
        totalServices: 1,
        lastServiceDate: '2026-10-01T10:00:00.000Z',
      },
    ],
    assetsHandled: [
      {
        assetId: 'ast-1',
        customerId: 'cust-1',
        assetName: 'Commercial RO 50 LPH',
        serialNumber: 'SN-RO-50-881',
        customerName: 'Pooja Patil',
        totalServices: 1,
        lastServiceDate: '2026-10-01T10:00:00.000Z',
      },
    ],
    partsUsed: [
      {
        partName: 'RO Membrane 75 GPD',
        partSku: 'MEM-75',
        quantity: 1,
        price: '1500.00',
        isWarrantyCovered: false,
        jobCardId: 'jc-1',
        jobCardNumber: 'JC-2026-001',
        date: '2026-10-01T10:00:00.000Z',
      },
    ],
    payments: [
      {
        id: 'pay-1',
        paymentNumber: 'PAY-2026-001',
        invoiceId: 'inv-3',
        invoiceNumber: 'INV-2026-003',
        customerId: 'cust-3',
        customerName: 'Nisha Verma',
        amount: '3500.00',
        paymentMethod: 'UPI',
        referenceNumber: 'UPI-REF-9988',
        paymentDate: '2026-09-20T11:00:00.000Z',
        status: 'COMPLETED',
      },
    ],
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();

    vi.mocked(techniciansApi.useTogglePortalAccessMutation).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as any);
  });

  const renderComponent = (techId = 'tech-123') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={[`/technicians/${techId}`]}>
            <Routes>
              <Route path="/technicians/:id" element={<TechnicianProfilePage />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );
  };

  it('renders loading state with skeleton indicators', () => {
    vi.mocked(techniciansApi.useTechnician360Query).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as any);

    const { container } = renderComponent();
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders error state when technician is not found or fails to load', () => {
    vi.mocked(techniciansApi.useTechnician360Query).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    } as any);

    renderComponent('unknown-tech');
    expect(screen.getByText('Technician Profile Not Found')).toBeInTheDocument();
    expect(screen.getByText(/Back to Technicians Roster/i)).toBeInTheDocument();
  });

  it('renders complete authoritative 360 profile header, KPIs, and overview data', () => {
    vi.mocked(techniciansApi.useTechnician360Query).mockReturnValue({
      data: mockProfile,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    renderComponent();

    // Identity and badges
    expect(screen.getAllByText('Rahul Sharma').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('9876543210').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('rahul@srenterprises.com').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('RO Installation')).toBeInTheDocument();
    expect(screen.getByText('Membrane Cleaning')).toBeInTheDocument();
    expect(screen.getByText(/Portal: ENABLED/i)).toBeInTheDocument();

    // Authoritative Performance KPIs
    expect(screen.getByText('2')).toBeInTheDocument(); // workload
    expect(screen.getByText('60%')).toBeInTheDocument(); // completion rate
    expect(screen.getByText('45m')).toBeInTheDocument(); // avg duration

    // Overview Highlights
    expect(screen.getByText('SRV-2026-001')).toBeInTheDocument();
    expect(screen.getByText(/Pooja Patil/)).toBeInTheDocument();
    expect(screen.getByText(/SRV-2026-002/)).toBeInTheDocument();
    expect(screen.getByText(/Anand Kulkarni/)).toBeInTheDocument();
  });

  it('navigates across tabs correctly (Job Cards, Completed, Customers, Assets, Parts, Payments)', () => {
    vi.mocked(techniciansApi.useTechnician360Query).mockReturnValue({
      data: mockProfile,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    renderComponent();

    // Switch to Job Cards tab
    const jobCardsTab = screen.getByRole('button', { name: /Job Cards/i });
    fireEvent.click(jobCardsTab);
    expect(screen.getByText('JC-2026-001')).toBeInTheDocument();
    expect(screen.getByText('Low water pressure')).toBeInTheDocument();

    // Switch to Completed tab
    const completedTab = screen.getByRole('button', { name: /Completed/i });
    fireEvent.click(completedTab);
    expect(screen.getByText('SRV-2026-003')).toBeInTheDocument();
    expect(screen.getByText('Nisha Verma')).toBeInTheDocument();

    // Switch to Parts Consumed tab
    const partsTab = screen.getByRole('button', { name: /Parts Consumed/i });
    fireEvent.click(partsTab);
    expect(screen.getByText('RO Membrane 75 GPD')).toBeInTheDocument();
    expect(screen.getByText('MEM-75')).toBeInTheDocument();

    // Switch to Collections tab
    const paymentsTab = screen.getByRole('button', { name: /Collections/i });
    fireEvent.click(paymentsTab);
    expect(screen.getByText('PAY-2026-001')).toBeInTheDocument();
    expect(screen.getByText('UPI-REF-9988')).toBeInTheDocument();
  });

  it('toggles portal access using authoritative mutation', async () => {
    vi.mocked(techniciansApi.useTechnician360Query).mockReturnValue({
      data: mockProfile,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    renderComponent();

    const disableBtn = screen.getByRole('button', { name: /Disable Portal Access/i });
    fireEvent.click(disableBtn);

    expect(mockMutateAsync).toHaveBeenCalledWith({
      id: 'tech-123',
      portalEnabled: false,
    });
  });

  it('renders clean empty states for technician with zero work records', () => {
    const emptyProfile: TechnicianAdmin360Profile = {
      ...mockProfile,
      workSummary: {
        currentWorkload: 0,
        assignedCount: 0,
        inProgressCount: 0,
        upcomingCount: 0,
        completedCount: 0,
        completionRate: 0,
        averageCompletionTimeMinutes: null,
        averageCompletionTimeFormatted: null,
        isAverageCompletionTimeReliable: false,
        sampleSize: 0,
      },
      currentWork: [],
      upcomingWork: [],
      completedServices: [],
      assignedServices: [],
      jobCards: [],
      customersHandled: [],
      assetsHandled: [],
      partsUsed: [],
      payments: [],
    };

    vi.mocked(techniciansApi.useTechnician360Query).mockReturnValue({
      data: emptyProfile,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    renderComponent();

    // Empty state on Overview
    expect(
      screen.getByText('No active jobs in progress for this technician right now.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('No upcoming scheduled assignments recorded.')
    ).toBeInTheDocument();
    expect(screen.getByText('N/A')).toBeInTheDocument(); // Duration N/A
  });
});
