import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { TechniciansDirectory } from './TechniciansDirectory';
import { TechnicianDetailDrawer } from './components/TechnicianDetailDrawer';
import { TechnicianModal } from './components/TechnicianModal';
import { ToastProvider } from '../../providers/ToastProvider';
import type { TechnicianItem } from './technicians.api';

const mockTogglePortalMutateAsync = vi.fn().mockResolvedValue({ success: true });
const mockUpdateMutateAsync = vi.fn().mockResolvedValue({ success: true });
const mockCreateMutateAsync = vi.fn().mockResolvedValue({ success: true });

vi.mock('./technicians.api', () => ({
  useTechnicianKPIsQuery: () => ({
    data: {
      totalTechnicians: 2,
      activeTechnicians: 2,
      onLeave: 0,
      inactiveTechnicians: 0,
    },
    isLoading: false,
  }),
  useTechniciansQuery: () => ({
    data: {
      data: [
        {
          id: 'tech-1',
          fullName: 'Suresh Kumar',
          phone: '9876543210',
          email: 'suresh.k@srenterprises.com',
          status: 'ACTIVE',
          portalEnabled: true,
          skills: ['RO Installation'],
          address: 'Sector 14, Gurgaon',
          emergencyContact: '9811122233',
          userId: null,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          activeJobsCount: 2,
          completedJobsCount: 15,
        },
        {
          id: 'tech-2',
          fullName: 'Ramesh Sharma',
          phone: '9876543211',
          email: 'ramesh.s@srenterprises.com',
          status: 'ACTIVE',
          portalEnabled: false,
          skills: ['Filter Replacement'],
          address: 'Sector 22, Gurgaon',
          emergencyContact: '9811122234',
          userId: null,
          createdAt: '2026-01-02T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
          activeJobsCount: 0,
          completedJobsCount: 5,
        },
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      },
    },
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useTechnicianDetailQuery: (id?: string) => ({
    data: id === 'tech-1'
      ? {
          id: 'tech-1',
          fullName: 'Suresh Kumar',
          phone: '9876543210',
          email: 'suresh.k@srenterprises.com',
          status: 'ACTIVE',
          portalEnabled: true,
          skills: ['RO Installation'],
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          recentJobs: [],
        }
      : id === 'tech-2'
      ? {
          id: 'tech-2',
          fullName: 'Ramesh Sharma',
          phone: '9876543211',
          email: 'ramesh.s@srenterprises.com',
          status: 'ACTIVE',
          portalEnabled: false,
          skills: ['Filter Replacement'],
          createdAt: '2026-01-02T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
          recentJobs: [],
        }
      : null,
    isLoading: false,
  }),
  useCreateTechnicianMutation: () => ({
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
  }),
  useUpdateTechnicianMutation: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  }),
  useDeleteTechnicianMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useTogglePortalAccessMutation: () => ({
    mutateAsync: mockTogglePortalMutateAsync,
    isPending: false,
  }),
}));

describe('Technician Portal Access Control Frontend Suite', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const renderDirectory = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <BrowserRouter>
            <TechniciansDirectory />
          </BrowserRouter>
        </ToastProvider>
      </QueryClientProvider>
    );

  it('renders Portal Access column in Technician Table with Enabled and Disabled badges', () => {
    renderDirectory();

    // Table header should have Portal Access
    expect(screen.getByText('Portal Access')).toBeInTheDocument();

    // Row 1 (Suresh Kumar) should show Enabled
    expect(screen.getByText('Enabled')).toBeInTheDocument();

    // Row 2 (Ramesh Sharma) should show Disabled
    expect(screen.getByText('Disabled')).toBeInTheDocument();
  });

  it('renders Technician Portal Access control card in Detail Drawer separate from Workforce Availability', () => {
    const tech: TechnicianItem = {
      id: 'tech-2',
      fullName: 'Ramesh Sharma',
      phone: '9876543211',
      email: 'ramesh.s@srenterprises.com',
      status: 'ACTIVE',
      portalEnabled: false,
      skills: ['Filter Replacement'],
      address: null,
      emergencyContact: null,
      userId: null,
      createdAt: '2026-01-02T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
      activeJobsCount: 0,
      completedJobsCount: 5,
    };

    render(
      <QueryClientProvider client={queryClient}>
        <TechnicianDetailDrawer
          isOpen={true}
          onClose={vi.fn()}
          technician={tech}
          onEdit={vi.fn()}
          onViewJobCard={vi.fn()}
        />
      </QueryClientProvider>
    );

    // Both distinct sections must exist
    expect(screen.getByText('Workforce Availability')).toBeInTheDocument();
    expect(screen.getByText('Technician Portal Access')).toBeInTheDocument();

    // Status badge is DISABLED
    const badge = screen.getByTestId('portal-access-status-badge');
    expect(badge).toHaveTextContent('DISABLED');

    // Enable Access button should be active, Disable Access button should be disabled
    const enableBtn = screen.getByTestId('enable-portal-access-button');
    const disableBtn = screen.getByTestId('disable-portal-access-button');

    expect(enableBtn).toBeEnabled();
    expect(disableBtn).toBeDisabled();

    // Click Enable Access
    fireEvent.click(enableBtn);
    expect(mockTogglePortalMutateAsync).toHaveBeenCalledWith({
      id: 'tech-2',
      portalEnabled: true,
    });
  });

  it('allows disabling portal access for a technician who currently has access enabled', () => {
    const tech: TechnicianItem = {
      id: 'tech-1',
      fullName: 'Suresh Kumar',
      phone: '9876543210',
      email: 'suresh.k@srenterprises.com',
      status: 'ACTIVE',
      portalEnabled: true,
      skills: ['RO Installation'],
      address: null,
      emergencyContact: null,
      userId: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      activeJobsCount: 2,
      completedJobsCount: 15,
    };

    render(
      <QueryClientProvider client={queryClient}>
        <TechnicianDetailDrawer
          isOpen={true}
          onClose={vi.fn()}
          technician={tech}
          onEdit={vi.fn()}
          onViewJobCard={vi.fn()}
        />
      </QueryClientProvider>
    );

    const badge = screen.getByTestId('portal-access-status-badge');
    expect(badge).toHaveTextContent('ENABLED');

    const enableBtn = screen.getByTestId('enable-portal-access-button');
    const disableBtn = screen.getByTestId('disable-portal-access-button');

    expect(enableBtn).toBeDisabled();
    expect(disableBtn).toBeEnabled();

    // Click Disable Access
    fireEvent.click(disableBtn);
    expect(mockTogglePortalMutateAsync).toHaveBeenCalledWith({
      id: 'tech-1',
      portalEnabled: false,
    });
  });

  it('renders Technician Portal Access field in create/edit modal', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TechnicianModal
          isOpen={true}
          onClose={vi.fn()}
          technician={null}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText('Technician Portal Access')).toBeInTheDocument();
    expect(screen.getByText('DISABLED (Default)')).toBeInTheDocument();
  });
});
