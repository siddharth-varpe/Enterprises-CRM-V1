import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CustomerFormModal } from './CustomerFormModal';
import { ToastProvider } from '../../../providers/ToastProvider';

vi.mock('../customer.api', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    useCreateCustomerMutation: () => ({
      mutateAsync: vi.fn(),
      isPending: false,
    }),
    useUpdateCustomerMutation: () => ({
      mutateAsync: vi.fn(),
      isPending: false,
    }),
    checkCustomerDuplicateApi: vi.fn().mockResolvedValue({
      isDuplicate: false,
      matchField: null,
      existingCustomer: null,
    }),
  };
});

describe('CustomerFormModal Component', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const renderModal = (isOpen = true, customer = null) =>
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <CustomerFormModal
            isOpen={isOpen}
            onClose={vi.fn()}
            customer={customer}
          />
        </ToastProvider>
      </QueryClientProvider>
    );

  it('renders creation form modal with required identity fields and direct customer address fields', () => {
    renderModal(true);
    expect(screen.getByText('Add New Customer')).toBeInTheDocument();
    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Phone Number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Address Line 1/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/City/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/State/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Pincode/i)).toBeInTheDocument();
    expect(screen.getByText('Create Customer')).toBeInTheDocument();
  });

  it('TEST 1 & 2: displays address input fields directly without requiring dropdown selection', () => {
    renderModal(true);
    // Address fields are rendered directly without any dropdown
    expect(screen.queryByLabelText(/SELECT SERVICE & INSTALLATION ADDRESS/i)).toBeNull();
    const addressInput = screen.getByLabelText(/Address Line 1/i);
    expect(addressInput).toBeInTheDocument();
    fireEvent.change(addressInput, { target: { value: 'Flat 101, Galaxy Heights' } });
    expect(screen.getByDisplayValue('Flat 101, Galaxy Heights')).toBeInTheDocument();
  });

  it('TEST 3, 4, 5: Customer with multiple addresses displays all address records directly', () => {
    const mockCustomer: any = {
      id: 'cust-multi-1',
      customerNumber: 'CUST-2026-0002',
      fullName: 'Vikram Malhotra',
      phone: '9826333444',
      email: 'vikram@example.com',
      customerType: 'INDIVIDUAL',
      addresses: [
        {
          id: 'addr-1',
          addressType: 'SERVICE',
          addressLine1: 'Flat 402, Green Park',
          landmark: 'Opp Metro Pillar 42',
          city: 'Pune',
          state: 'Maharashtra',
          postalCode: '411017',
          isDefault: true,
        },
        {
          id: 'addr-2',
          addressType: 'SERVICE',
          addressLine1: 'Branch Office - Shop 12',
          landmark: 'Near City Mall',
          city: 'Pimpri',
          state: 'Maharashtra',
          postalCode: '411018',
          isDefault: false,
        },
      ],
    };

    renderModal(true, mockCustomer);

    // Both addresses are directly rendered in the form
    expect(screen.getByText('Address #1')).toBeInTheDocument();
    expect(screen.getByText('Address #2')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Flat 402, Green Park')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Branch Office - Shop 12')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Pune')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Pimpri')).toBeInTheDocument();
    expect(screen.getByDisplayValue('411017')).toBeInTheDocument();
    expect(screen.getByDisplayValue('411018')).toBeInTheDocument();
  });

  it('TEST 6 & 7: Add another address appends new address block with remove capability', () => {
    renderModal(true);

    const addBtn = screen.getByRole('button', { name: /Add Another Address/i });
    expect(addBtn).toBeInTheDocument();

    fireEvent.click(addBtn);

    // Address #2 block is now present with remove button
    expect(screen.getByText('Address #2')).toBeInTheDocument();
    const removeBtns = screen.getAllByRole('button', { name: /Remove/i });
    expect(removeBtns.length).toBeGreaterThanOrEqual(1);

    // Click remove to remove Address #2
    fireEvent.click(removeBtns[1] || removeBtns[0]);
    expect(screen.queryByText('Address #2')).toBeNull();
  });

  it('TEST 8, 9, 10: Editing an address updates specific address fields and preserves customer fields', () => {
    const mockCustomer: any = {
      id: 'cust-edit-1',
      customerNumber: 'CUST-2026-0003',
      fullName: 'Sunil Sharma',
      phone: '9826111222',
      email: 'sunil@example.com',
      customerType: 'COMMERCIAL',
      companyName: 'Sharma RO Systems',
      addresses: [
        {
          id: 'addr-1',
          addressType: 'SERVICE',
          addressLine1: 'Office 101',
          city: 'Pune',
          state: 'Maharashtra',
          postalCode: '411001',
          isDefault: true,
        },
      ],
    };

    renderModal(true, mockCustomer);

    // Verify identity fields are intact
    expect(screen.getByDisplayValue('Sunil Sharma')).toBeInTheDocument();
    expect(screen.getByDisplayValue('9826111222')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Sharma RO Systems')).toBeInTheDocument();

    // Verify address field is intact and editable
    const addrInput = screen.getByDisplayValue('Office 101');
    fireEvent.change(addrInput, { target: { value: 'Office 202' } });
    expect(screen.getByDisplayValue('Office 202')).toBeInTheDocument();
  });
});
