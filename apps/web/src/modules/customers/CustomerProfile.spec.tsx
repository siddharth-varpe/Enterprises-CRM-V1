import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CustomerProfile } from './CustomerProfile';
import { ToastProvider } from '../../providers/ToastProvider';

vi.mock('../../providers/AuthBoundary', () => ({
  useAuth: () => ({
    user: {
      userId: '1',
      username: 'admin',
      displayName: 'System Admin',
      role: 'Super Admin',
      permissions: [
        'customers.view',
        'customers.create',
        'customers.update',
        'customers.archive',
        'invoices.view',
        'payments.view',
      ],
    },
    hasPermission: () => true,
  }),
}));

vi.mock('./customer.api', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    useCustomerDetailQuery: () => ({
      data: {
        id: '11111111-1111-1111-1111-111111111111',
        customerNumber: 'CUST-2026-0001',
        fullName: 'Rajesh Kumar',
        phone: '9826123456',
        email: 'rajesh@example.com',
        customerType: 'INDIVIDUAL',
        status: 'ACTIVE',
        createdAt: '2026-01-10T10:00:00Z',
        updatedAt: '2026-01-10T10:00:00Z',
        addresses: [
          {
            id: 'addr-1',
            customerId: '11111111-1111-1111-1111-111111111111',
            addressType: 'SERVICE',
            addressLine1: 'Plot 42, Civil Lines',
            city: 'Raipur',
            state: 'Chhattisgarh',
            postalCode: '492001',
            isDefault: true,
          },
        ],
        notes: 'Preferred visit timing: After 4 PM',
      },
      isLoading: false,
      isError: false,
    }),
    useCustomerFinancialSummaryQuery: () => ({
      data: {
        customerId: '11111111-1111-1111-1111-111111111111',
        totalBilled: '32000.00',
        totalPaid: '22000.00',
        outstanding: '10000.00',
        overdue: '0.00',
        paymentHealth: 'PARTIALLY_PAID',
        lastPaymentDate: '2026-02-15T10:00:00Z',
        lastPaymentAmount: '5000.00',
        lastPaymentMethod: 'UPI',
      },
      isLoading: false,
      isError: false,
    }),
    useCustomerAssetsQuery: () => ({
      data: [
        {
          id: 'asset-1',
          assetType: 'RO_MACHINE',
          serialNumber: 'RO-2026-X800',
          purchaseDate: '2026-01-15T00:00:00Z',
          status: 'ACTIVE',
          product: { name: 'AquaFlow Pro 15L RO+UV', sku: 'AF-PRO-15', brand: 'AquaFlow' },
          warranties: [
            {
              id: 'warr-1',
              status: 'ACTIVE',
              startDate: '2026-01-15T00:00:00Z',
              endDate: '2027-01-15T00:00:00Z',
              warrantyType: 'STANDARD_MACHINE',
            },
          ],
        },
      ],
      isLoading: false,
      isError: false,
    }),
    useCustomerActivitiesQuery: () => ({
      data: {
        data: [
          {
            id: 'act-1',
            eventType: 'CUSTOMER_CREATED',
            entityType: 'CUSTOMER',
            entityId: '11111111-1111-1111-1111-111111111111',
            description: 'Customer account created (CUST-2026-0001)',
            actorName: 'System Admin',
            timestamp: '2026-01-10T10:00:00Z',
          },
        ],
        pagination: { page: 1, pageSize: 50, total: 1 },
      },
      isLoading: false,
      isError: false,
    }),
    useAddCustomerNoteMutation: () => ({
      mutateAsync: vi.fn(),
      isPending: false,
    }),
  };
});

vi.mock('../services/services.api', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    useServicesQuery: () => ({
      data: {
        data: [
          {
            id: 'srv-101',
            serviceNumber: 'SRV-2026-0001',
            serviceType: 'PERIODIC_MAINTENANCE',
            scheduledDate: '2026-02-20T10:00:00Z',
            scheduledTimeSlot: '10:00 AM - 12:00 PM',
            productName: 'AquaFlow Pro 15L RO+UV',
            technicianName: 'Suresh Verma',
            technicianPhone: '9876543210',
            serviceClassification: 'WARRANTY',
            status: 'SCHEDULED',
            totalCharges: '0',
          },
        ],
        pagination: { total: 1, page: 1, limit: 100, totalPages: 1 },
      },
      isLoading: false,
      refetch: vi.fn(),
    }),
  };
});

describe('CustomerProfile Component', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={['/customers/11111111-1111-1111-1111-111111111111']}>
            <Routes>
              <Route path="/customers/:id" element={<CustomerProfile />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );

  it('renders customer profile header with name, ID badge, and contact links', () => {
    renderComponent();
    expect(screen.getAllByText('Rajesh Kumar').length).toBeGreaterThan(0);
    expect(screen.getAllByText('CUST-2026-0001').length).toBeGreaterThan(0);
    expect(screen.getAllByText('9826123456').length).toBeGreaterThan(0);
    expect(screen.getAllByText('rajesh@example.com').length).toBeGreaterThan(0);
  });

  it('renders authoritative financial summary panel on right side', () => {
    renderComponent();
    expect(screen.getByText('Financial Position')).toBeInTheDocument();
    expect(screen.getByText('₹10,000.00')).toBeInTheDocument();
    expect(screen.getByText('₹32,000.00')).toBeInTheDocument();
    expect(screen.getByText('₹22,000.00')).toBeInTheDocument();
  });

  it('renders overview tab with addresses, customer notes, dynamic Payment Trend, Delete Customer button, and removes Top Services card', () => {
    renderComponent();
    expect(screen.getAllByText('Registered Locations & Addresses').length).toBeGreaterThan(0);
    expect(screen.getByText(/Plot 42, Civil Lines/i)).toBeInTheDocument();
    expect(screen.getByText(/Preferred visit timing: After 4 PM/i)).toBeInTheDocument();
    expect(screen.getByText('Payment Trend')).toBeInTheDocument();
    expect(screen.getByText('Delete Customer')).toBeInTheDocument();
    expect(screen.queryByText('Top Services by Spend')).not.toBeInTheDocument();
  });

  it('opens ScheduleServiceModal directly on the profile page with customer auto-selected when New Service is clicked', () => {
    renderComponent();
    const newServiceBtn = screen.getByRole('button', { name: /New Service/i });
    expect(newServiceBtn).toBeInTheDocument();
    fireEvent.click(newServiceBtn);

    // Form modal opens on profile page
    expect(screen.getByText('Schedule Service Visit')).toBeInTheDocument();
    // Customer name is auto-selected in the modal dropdown
    expect(screen.getByRole('option', { name: /Rajesh Kumar/i })).toBeInTheDocument();
  });

  it('lists customer services in the Overview tab and in the Services tab table', () => {
    renderComponent();
    // Overview tab recent services
    expect(screen.getByText('Recent Services')).toBeInTheDocument();
    expect(screen.getAllByText(/SRV-2026-0001/i).length).toBeGreaterThan(0);

    // Click Services tab
    const servicesTab = screen.getByRole('button', { name: /Services \(1\)/i });
    expect(servicesTab).toBeInTheDocument();
    fireEvent.click(servicesTab);

    // Full Services Table is rendered
    expect(screen.getByText('Service Visits & Maintenance History')).toBeInTheDocument();
    expect(screen.getAllByText('SRV-2026-0001').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Periodic Maintenance/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Suresh Verma')).toBeInTheDocument();
    expect(screen.getByText('Under Warranty')).toBeInTheDocument();
  });

  it('renders genuine customer data in Communication card and does not contain dummy values', () => {
    renderComponent();
    expect(screen.getByText('Communication')).toBeInTheDocument();
    // Genuine customer data present
    expect(screen.getAllByText('rajesh@example.com').length).toBeGreaterThan(0);
    expect(screen.getAllByText('9826123456').length).toBeGreaterThan(0);
    // Dummy placeholders strictly removed
    expect(screen.queryByText('rahul.patil@example.com')).not.toBeInTheDocument();
    expect(screen.queryByText('+91 98765 43210')).not.toBeInTheDocument();
    expect(screen.queryByText(/tel:\s*9826123456/i)).not.toBeInTheDocument();
    expect(screen.queryByText('↑ 12.5% vs last year')).not.toBeInTheDocument();
  });
});
